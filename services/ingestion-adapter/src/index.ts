import express from 'express';
import { Kafka, Partitioners } from 'kafkajs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as mllp from 'mllp-node';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(express.text({ type: ['application/xml', 'application/fhir+json', 'application/json'] }));

const kafka = new Kafka({
  clientId: 'ingestion-adapter',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });

const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'password',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = 'clinical-raw';
const CONVERTER_URL = process.env.CONVERTER_URL || 'http://localhost:3000/api/convert';

async function convertToFhir(data: string, format: string): Promise<any> {
  if (format !== 'hl7v2' && format !== 'c-cda') return null;

  try {
    const response = await axios.post(CONVERTER_URL, {
      inputData: data,
      inputFormat: format === 'hl7v2' ? 'Hl7v2' : 'Ccda',
      templateName: format === 'hl7v2' ? 'ADT_A01' : 'CCD', // Default templates
    });
    return response.data;
  } catch (error) {
    console.error('Error calling FHIR Converter:', error);
    return null;
  }
}

async function archiveAndPublish(data: string, format: string, source: string) {
  const messageId = uuidv4();
  const timestamp = new Date().toISOString();

  // 1. Archive to MinIO
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `raw/${format}/${messageId}`,
      Body: data,
      ContentType: format === 'hl7v2' ? 'text/plain' : 'application/fhir+json',
    }));
    console.log(`Archived message ${messageId} to MinIO`);
  } catch (error) {
    console.error('Error archiving to MinIO:', error);
  }

  // 2. Optional: Transform via Microsoft FHIR Converter
  const transformed = await convertToFhir(data, format);
  if (transformed) {
     try {
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `transformed/${messageId}.json`,
          Body: JSON.stringify(transformed),
          ContentType: 'application/fhir+json',
        }));
        console.log(`Archived transformed message ${messageId} to MinIO`);
      } catch (error) {
        console.error('Error archiving transformed message to MinIO:', error);
      }
  }

  // 3. Publish to Kafka
  try {
    await producer.send({
      topic: 'clinical.raw',
      messages: [
        {
          key: messageId,
          value: JSON.stringify({
            id: messageId,
            timestamp,
            format,
            source,
            s3Key: `raw/${format}/${messageId}`,
            transformedS3Key: transformed ? `transformed/${messageId}.json` : null,
          }),
        },
      ],
    });
    console.log(`Published message ${messageId} to Kafka topic clinical.raw`);
  } catch (error) {
    console.error('Error publishing to Kafka:', error);
  }
}

// REST Endpoint for FHIR Bundles and C-CDA
app.post('/ingest/:facilityId', async (req, res) => {
  const { facilityId } = req.params;
  const data = req.body;
  const contentType = req.headers['content-type'];

  let format = 'unknown';
  if (contentType?.includes('fhir+json')) format = 'fhir-bundle';
  else if (contentType?.includes('xml')) format = 'c-cda';

  await archiveAndPublish(data, format, facilityId);
  res.status(202).send({ messageId: uuidv4() }); // In reality, use the same ID
});

// MLLP Server for HL7 v2
const mllpServer = new mllp.MLLPServer('0.0.0.0', 1234);

mllpServer.on('hl7', async (data: string, ack: any) => {
  console.log('Received HL7 message');
  await archiveAndPublish(data, 'hl7v2', 'mllp-source');
  ack.send(); // Send default AA ACK
});

async function start() {
  await producer.connect();
  const port = process.env.PORT || 3007;
  app.listen(port, () => {
    console.log(`REST Ingestion Adapter listening on port ${port}`);
  });
  console.log(`MLLP Ingestion Adapter listening on port 1234`);
}

start().catch(console.error);
