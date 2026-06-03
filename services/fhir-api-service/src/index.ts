/**
 * OmniHealth FHIR R4 API Service — Entry Point
 *
 * Core clinical data API. In-memory storage for now.
 * All endpoints mounted at /fhir/r4/ per architecture spec.
 *
 * @packageDocumentation
 */

import express from 'express';
import { InMemoryRepository } from './repository/InMemoryRepository';
import { createFhirRouter } from './routes/fhir-routes';

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ──────────────────────────────────────────────
// App
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  const app = express();

  // Repository (in-memory — swap for DB-backed later)
  const repo = new InMemoryRepository();

  // Seed some demo data
  await seedDemoData(repo);

  // ── Middleware ──────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
    res.setHeader('Access-Control-Expose-Headers', 'Location, ETag, Last-Modified, X-Correlation-ID');
    if (_req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Correlation ID
  app.use((req, _res, next) => {
    const correlationId = req.headers['x-correlation-id'] as string ||
      `oh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
    (req as any).correlationId = correlationId;
    _res.setHeader('X-Correlation-ID', correlationId);
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'fhir-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // FHIR API routes
  const fhirRouter = createFhirRouter(repo);
  app.use('/fhir/r4', fhirRouter);

  // Root redirect
  app.get('/', (_req, res) => {
    res.redirect('/fhir/r4/metadata');
  });

  // 404
  app.use((_req, res) => {
    res.status(404).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'not-found', details: { text: `Route not found: ${_req.method} ${_req.path}` } }],
    });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server] Error:', err);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', details: { text: 'Internal server error' }, diagnostics: process.env.NODE_ENV === 'development' ? err.message : undefined }],
    });
  });

  // Start
  app.listen(PORT, HOST, () => {
    console.log(`\n  🏥 OmniHealth FHIR API Service`);
    console.log(`  ─────────────────────────────`);
    console.log(`  Server:     http://${HOST}:${PORT}`);
    console.log(`  FHIR R4:    http://${HOST}:${PORT}/fhir/r4/metadata`);
    console.log(`  Health:     http://${HOST}:${PORT}/health`);
    console.log(`  Resources:  Patient, Observation, Condition, Encounter, MedicationRequest`);
    console.log(`  Storage:    In-Memory (Map-based)`);
    console.log(`  Demo data:  2 Patients, 3 Observations, 2 Conditions, 2 Encounters, 2 MedicationRequests\n`);
  });
}

// ──────────────────────────────────────────────
// Demo Data Seeding
// ──────────────────────────────────────────────

async function seedDemoData(repo: InMemoryRepository): Promise<void> {
  // Patient 1
  const pat1 = await repo.create('Patient', {
    resourceType: 'Patient',
    name: [{ use: 'official', family: 'Smith', given: ['John', 'Robert'] }],
    gender: 'male',
    birthDate: '1980-01-15',
    active: true,
    telecom: [
      { system: 'email', value: 'john.smith@example.com', use: 'home' },
      { system: 'phone', value: '+1-555-0100', use: 'mobile' },
    ],
    address: [{ use: 'home', line: ['123 Main Street'], city: 'Springfield', state: 'IL', postalCode: '62701', country: 'USA' }],
    identifier: [
      { system: 'http://hospital.example.org/mrn', value: 'MRN-001' },
      { system: 'http://national-id.org/ssn', value: 'XXX-XX-0001' },
    ],
  });

  // Patient 2
  const pat2 = await repo.create('Patient', {
    resourceType: 'Patient',
    name: [{ use: 'official', family: 'Johnson', given: ['Sarah', 'Marie'] }],
    gender: 'female',
    birthDate: '1992-06-22',
    active: true,
    telecom: [
      { system: 'email', value: 'sarah.j@example.com', use: 'home' },
    ],
    address: [{ use: 'home', line: ['456 Oak Avenue'], city: 'Portland', state: 'OR', postalCode: '97201', country: 'USA' }],
    identifier: [
      { system: 'http://hospital.example.org/mrn', value: 'MRN-002' },
    ],
  });

  // Observations for Patient 1
  await repo.create('Observation', {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body Weight' }],
      text: 'Body Weight',
    },
    subject: { reference: `Patient/${pat1.id}` },
    effectiveDateTime: '2025-05-15T08:30:00Z',
    valueQuantity: { value: 82.5, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' },
  });

  await repo.create('Observation', {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic Blood Pressure' }],
      text: 'Systolic Blood Pressure',
    },
    subject: { reference: `Patient/${pat1.id}` },
    effectiveDateTime: '2025-05-15T08:30:00Z',
    valueQuantity: { value: 128, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
  });

  // Observation for Patient 2
  await repo.create('Observation', {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }],
      text: 'Hemoglobin A1c',
    },
    subject: { reference: `Patient/${pat2.id}` },
    effectiveDateTime: '2025-05-20T10:15:00Z',
    valueQuantity: { value: 5.6, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
  });

  // Conditions
  await repo.create('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Type 2 Diabetes' }], text: 'Type 2 Diabetes' },
    subject: { reference: `Patient/${pat1.id}` },
    onsetDateTime: '2019-03-01',
    recordedDate: '2019-03-15',
  });

  await repo.create('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertension' }], text: 'Hypertension' },
    subject: { reference: `Patient/${pat1.id}` },
    onsetDateTime: '2018-06-01',
    recordedDate: '2018-06-10',
  });

  // Encounters
  await repo.create('Encounter', {
    resourceType: 'Encounter',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    type: [{ coding: [{ system: 'http://snomed.info/sct', code: '185463005', display: 'Annual checkup' }] }],
    subject: { reference: `Patient/${pat1.id}` },
    period: { start: '2025-01-15T09:00:00Z', end: '2025-01-15T09:30:00Z' },
  });

  await repo.create('Encounter', {
    resourceType: 'Encounter',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    type: [{ coding: [{ system: 'http://snomed.info/sct', code: '308466008', display: 'Follow-up visit' }] }],
    subject: { reference: `Patient/${pat2.id}` },
    period: { start: '2025-03-20T14:00:00Z', end: '2025-03-20T14:20:00Z' },
  });

  // Medication Requests
  await repo.create('MedicationRequest', {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860254', display: 'Metformin 500mg' }], text: 'Metformin 500mg' },
    subject: { reference: `Patient/${pat1.id}` },
    authoredOn: '2025-01-15',
    requester: { reference: 'Practitioner/dr-williams' },
    dosageInstruction: [{ text: 'Take one tablet twice daily with meals' }],
  });

  await repo.create('MedicationRequest', {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '312764', display: 'Lisinopril 10mg' }], text: 'Lisinopril 10mg' },
    subject: { reference: `Patient/${pat1.id}` },
    authoredOn: '2018-06-10',
    requester: { reference: 'Practitioner/dr-williams' },
    dosageInstruction: [{ text: 'Take one tablet daily' }],
  });

  console.log(`  [Seed] Created ${2} patients, ${3} observations, ${2} conditions, ${2} encounters, ${2} medication requests`);
}

// ──────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────

main().catch((error) => {
  console.error('[Server] Fatal:', error);
  process.exit(1);
});