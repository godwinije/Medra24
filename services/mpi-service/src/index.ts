import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { Patient } from '@omnihealth/fhir-types';
import { MatchingEngine } from './matching';
import * as idGen from '@omnihealth/id-gen';
import { Kafka, Producer } from 'kafkajs';

const kafka = new Kafka({
    clientId: 'mpi-service',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});
const producer = kafka.producer();

async function publishEvent(topic: string, message: any) {
    try {
        await producer.send({
            topic,
            messages: [{ value: JSON.stringify(message) }]
        });
    } catch (error) {
        console.error(`Error publishing to ${topic}:`, error);
    }
}

const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mpi'
});

/**
 * Resolve Patient Identity
 */
app.post('/identify', async (req: Request, res: Response) => {
    const patient: Patient = req.body;

    try {
        // 1. Deterministic Match
        const { rows: existingIdentifiers } = await pool.query(
            'SELECT system, value, golden_patient_id FROM patient_identifiers'
        );
        
        const detMatch = MatchingEngine.findDeterministicMatch(patient, existingIdentifiers.map(i => ({
            system: i.system,
            value: i.value,
            goldenPatientId: i.golden_patient_id
        })));

        if (detMatch) {
            return res.json({
                goldenPatientId: detMatch.goldenPatientId,
                method: 'deterministic',
                score: 1.0
            });
        }

        // 2. Probabilistic Match
        const { rows: goldenPatients } = await pool.query('SELECT * FROM golden_patients');
        let bestMatch = { goldenPatientId: '', score: 0 };

        for (const gp of goldenPatients) {
            const score = MatchingEngine.calculateProbabilisticScore(patient, gp);
            if (score > bestMatch.score) {
                bestMatch = { goldenPatientId: gp.id, score };
            }
        }

        if (bestMatch.score > 0.9) {
            return res.json({
                goldenPatientId: bestMatch.goldenPatientId,
                method: 'probabilistic',
                score: bestMatch.score
            });
        }

        return res.status(404).json({ message: 'No match found' });
    } catch (error) {
        console.error('Error identifying patient:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Link Records
 */
app.post('/link', async (req: Request, res: Response) => {
    const { goldenPatientId, system, value } = req.body;
    try {
        await pool.query(
            'INSERT INTO patient_identifiers (golden_patient_id, system, value) VALUES ($1, $2, $3) ON CONFLICT (system, value) DO UPDATE SET golden_patient_id = $1',
            [goldenPatientId, system, value]
        );
        return res.json({ success: true });
    } catch (error) {
        console.error('Error linking record:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Get Patient Links
 */
app.get('/patients/:id/links', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'SELECT system, value FROM patient_identifiers WHERE golden_patient_id = $1',
            [id]
        );
        return res.json({ links: rows });
    } catch (error) {
        console.error('Error fetching links:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Merge Golden Records
 */
app.post('/merge', async (req: Request, res: Response) => {
    const { sourceGoldenId, targetGoldenId } = req.body;

    try {
        await pool.query('BEGIN');
        await pool.query(
            'UPDATE patient_identifiers SET golden_patient_id = $1 WHERE golden_patient_id = $2',
            [targetGoldenId, sourceGoldenId]
        );
        await pool.query('DELETE FROM golden_patients WHERE id = $1', [sourceGoldenId]);
        await pool.query(
            'INSERT INTO identity_audit_log (action, golden_patient_id, details) VALUES ($1, $2, $3)',
            ['merge', targetGoldenId, JSON.stringify({ sourceGoldenId })]
        );
        await pool.query('COMMIT');
        
        await publishEvent('identity.patient.matched', {
            goldenPatientId: targetGoldenId,
            method: 'merge',
            mergedFrom: sourceGoldenId
        });

        return res.json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error merging records:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Unmerge Golden Records
 */
app.post('/unmerge', async (req: Request, res: Response) => {
    const { goldenPatientId, identifierSystem, identifierValue } = req.body;

    try {
        await pool.query('BEGIN');
        const newGoldenId = idGen.uuid();
        await pool.query('INSERT INTO golden_patients (id) VALUES ($1)', [newGoldenId]);
        await pool.query(
            'UPDATE patient_identifiers SET golden_patient_id = $1 WHERE golden_patient_id = $2 AND system = $3 AND value = $4',
            [newGoldenId, goldenPatientId, identifierSystem, identifierValue]
        );
        await pool.query(
            'INSERT INTO identity_audit_log (action, golden_patient_id, details) VALUES ($1, $2, $3)',
            ['unmerge', goldenPatientId, JSON.stringify({ newGoldenId, identifierSystem, identifierValue })]
        );
        await pool.query('COMMIT');

        await publishEvent('identity.patient.matched', {
            goldenPatientId: newGoldenId,
            method: 'unmerge',
            unmergedFrom: goldenPatientId
        });

        return res.json({ success: true, newGoldenId });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error unmerging records:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

const startServer = async () => {
    try {
        await producer.connect();
        const PORT = process.env.PORT || 3002;
        app.listen(PORT, () => {
            console.log(`MPI Service listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
};

startServer();
