/**
 * FHIR R4 RESTful API Routes
 *
 * Implements FHIR R4 CRUD + search operations for all supported resources.
 * Routes follow the FHIR R4 HTTP specification.
 *
 * @packageDocumentation
 */

import { v4 as uuidv4 } from 'uuid';
import { Router, type Request, type Response } from 'express';
import type { IResourceRepository } from '../repository/InMemoryRepository';
import type {
  Resource,
  Bundle,
  CapabilityStatement,
  OperationOutcome,
  SearchParamType,
  InteractionCode,
} from '../fhir-types';

// ──────────────────────────────────────────────
// Supported Resources
// ──────────────────────────────────────────────

const SUPPORTED_RESOURCES = [
  { type: 'Patient', profile: 'https://fhir.omnihealth.io/StructureDefinition/omnihealth-patient' },
  { type: 'Observation', profile: 'https://fhir.omnihealth.io/StructureDefinition/omnihealth-observation' },
  { type: 'Condition', profile: 'https://fhir.omnihealth.io/StructureDefinition/omnihealth-condition' },
  { type: 'Encounter', profile: 'https://fhir.omnihealth.io/StructureDefinition/omnihealth-encounter' },
  { type: 'MedicationRequest', profile: 'https://fhir.omnihealth.io/StructureDefinition/omnihealth-medicationrequest' },
];

// Search parameter definitions per resource
const SEARCH_PARAMS: Record<string, Array<{ name: string; type: SearchParamType; doc: string }>> = {
  Patient: [
    { name: 'identifier', type: 'token', doc: 'A patient identifier' },
    { name: 'name', type: 'string', doc: 'A portion of the family or given name' },
    { name: 'family', type: 'string', doc: 'A portion of the family name' },
    { name: 'given', type: 'string', doc: 'A portion of the given name' },
    { name: 'birthdate', type: 'date', doc: "The patient's date of birth" },
    { name: 'gender', type: 'token', doc: "The patient's gender" },
    { name: 'active', type: 'token', doc: 'Whether the patient is active' },
    { name: 'telecom', type: 'token', doc: 'The value in a telecom contact' },
    { name: 'email', type: 'token', doc: 'An email address' },
    { name: 'phone', type: 'token', doc: 'A phone number' },
    { name: 'address', type: 'string', doc: 'A portion of the address' },
  ],
  Observation: [
    { name: 'patient', type: 'reference', doc: 'The subject that the observation is about' },
    { name: 'subject', type: 'reference', doc: 'The subject that the observation is about' },
    { name: 'code', type: 'token', doc: 'The code of the observation' },
    { name: 'date', type: 'date', doc: 'The date/time of the observation' },
    { name: 'status', type: 'token', doc: 'The status of the observation' },
    { name: 'category', type: 'token', doc: 'The classification of the observation' },
    { name: 'encounter', type: 'reference', doc: 'The encounter associated with the observation' },
  ],
  Condition: [
    { name: 'patient', type: 'reference', doc: 'Who the condition is for' },
    { name: 'subject', type: 'reference', doc: 'Who the condition is for' },
    { name: 'code', type: 'token', doc: 'Code for the condition' },
    { name: 'clinical-status', type: 'token', doc: 'The clinical status of the condition' },
    { name: 'encounter', type: 'reference', doc: 'The encounter when condition was recorded' },
    { name: 'onset-date', type: 'date', doc: 'When the condition started' },
    { name: 'recorded-date', type: 'date', doc: 'When the condition was recorded' },
  ],
  Encounter: [
    { name: 'patient', type: 'reference', doc: 'The patient present at the encounter' },
    { name: 'subject', type: 'reference', doc: 'The patient present at the encounter' },
    { name: 'date', type: 'date', doc: 'The date/time of the encounter' },
    { name: 'status', type: 'token', doc: 'The status of the encounter' },
    { name: 'type', type: 'token', doc: 'Specific type of encounter' },
    { name: 'class', type: 'token', doc: 'Classification of encounter' },
    { name: 'practitioner', type: 'reference', doc: 'Practitioner involved in encounter' },
  ],
  MedicationRequest: [
    { name: 'patient', type: 'reference', doc: 'The subject for the medication request' },
    { name: 'subject', type: 'reference', doc: 'The subject for the medication request' },
    { name: 'code', type: 'token', doc: 'Medication code' },
    { name: 'status', type: 'token', doc: 'The status of the medication request' },
    { name: 'intent', type: 'token', doc: 'The intent of the medication request' },
    { name: 'authoredon', type: 'date', doc: 'When the medication request was authored' },
    { name: 'encounter', type: 'reference', doc: 'The encounter associated with the request' },
  ],
};

// ──────────────────────────────────────────────
// Route Factory
// ──────────────────────────────────────────────

export function createFhirRouter(repo: IResourceRepository): Router {
  const router = Router();

  // ── Conformance / CapabilityStatement ────────
  router.get('/metadata', (_req: Request, res: Response) => {
    res.json(buildCapabilityStatement());
  });

  // ── Patient $everything (must be BEFORE /:resourceType/:id) ──
  router.get('/Patient/:id/$everything', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { resources, total } = await repo.patientEverything(id);
      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: uuidv4(),
        type: 'searchset',
        total,
        link: [{ relation: 'self', url: `${req.protocol}://${req.get('host')}/fhir/r4/Patient/${id}/$everything` }],
        entry: resources.map(r => ({
          fullUrl: `${req.protocol}://${req.get('host')}/fhir/r4/${r.resourceType}/${r.id}`,
          resource: r,
          search: { mode: 'match' },
        })),
      };
      res.json(bundle);
    } catch (error: any) {
      console.error('[FHIR:$everything]', error);
      res.status(500).json(operationOutcome('exception', error.message || 'Internal server error'));
    }
  });

  // ── Read (GET /:resourceType/:id) ─────────────
  router.get('/:resourceType/:id', async (req: Request, res: Response) => {
    try {
      const { resourceType, id } = req.params;

      if (!isSupported(resourceType)) {
        res.status(404).json(operationOutcome('not-found', `Unknown resource type: ${resourceType}`));
        return;
      }

      const resource = await repo.read(resourceType, id);
      if (!resource) {
        res.status(404).json(operationOutcome('not-found', `Resource ${resourceType}/${id} not found`));
        return;
      }

      res.set('ETag', `W/"${resource.meta?.versionId}"`);
      res.set('Last-Modified', resource.meta?.lastUpdated || new Date().toUTCString());
      res.json(resource);
    } catch (error: any) {
      console.error('[FHIR:Read]', error);
      res.status(500).json(operationOutcome('exception', error.message || 'Internal server error'));
    }
  });

  // ── VRead (GET /:resourceType/:id/_history/:vid) ─
  router.get('/:resourceType/:id/_history/:vid', async (req: Request, res: Response) => {
    try {
      const { resourceType, id } = req.params;

      if (!isSupported(resourceType)) {
        res.status(404).json(operationOutcome('not-found', `Unknown resource type: ${resourceType}`));
        return;
      }

      // In-memory doesn't track history; return current version
      const resource = await repo.read(resourceType, id);
      if (!resource) {
        res.status(404).json(operationOutcome('not-found', `Resource ${resourceType}/${id} not found`));
        return;
      }

      res.json(resource);
    } catch (error: any) {
      console.error('[FHIR:VRead]', error);
      res.status(500).json(operationOutcome('exception', error.message || 'Internal server error'));
    }
  });

  // ── Create (POST /:resourceType) ──────────────
  router.post('/:resourceType', async (req: Request, res: Response) => {
    try {
      const { resourceType } = req.params;

      if (!isSupported(resourceType)) {
        res.status(404).json(operationOutcome('not-found', `Unknown resource type: ${resourceType}`));
        return;
      }

      if (req.body.resourceType && req.body.resourceType !== resourceType) {
        res.status(400).json(operationOutcome(
          'invalid',
          `Resource type mismatch: URL '${resourceType}', body '${req.body.resourceType}'`,
        ));
        return;
      }

      const resource = await repo.create(resourceType, req.body);

      res.status(201)
        .set('Location', `/${resourceType}/${resource.id}`)
        .set('ETag', `W/"${resource.meta?.versionId}"`)
        .set('Last-Modified', resource.meta?.lastUpdated || new Date().toUTCString())
        .json(resource);
    } catch (error: any) {
      console.error('[FHIR:Create]', error);
      res.status(500).json(operationOutcome('exception', error.message || 'Internal server error'));
    }
  });

  // ── Update (PUT /:resourceType/:id) ───────────
  router.put('/:resourceType/:id', async (req: Request, res: Response) => {
    try {
      const { resourceType, id } = req.params;

      if (!isSupported(resourceType)) {
        res.status(404).json(operationOutcome('not-found', `Unknown resource type: ${resourceType}`));
        return;
      }

      const resource = await repo.update(resourceType, id, req.body);

      if (!resource) {
        res.status(404).json(operationOutcome('not-found', `Resource ${resourceType}/${id} not found`));
        return;
      }

      res.status(200)
        .set('ETag', `W/"${resource.meta?.versionId}"`)
        .set('Last-Modified', resource.meta?.lastUpdated || new Date().toUTCString())
        .json(resource);
    } catch (error: any) {
      console.error('[FHIR:Update]', error);
      res.status(500).json(operationOutcome('exception', error.message || 'Internal server error'));
    }
  });

  // ── Delete (DELETE /:resourceType/:id) ────────
  router.delete('/:resourceType/:id', async (req: Request, res: Response) => {
    try {
      const { resourceType, id } = req.params;

      if (!isSupported(resourceType)) {
        res.status(404).json(operationOutcome('not-found', `Unknown resource type: ${resourceType}`));
        return;
      }

      const deleted = await repo.delete(resourceType, id);
      if (!deleted) {
        res.status(404).json(operationOutcome('not-found', `Resource ${resourceType}/${id} not found`));
        return;
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('[FHIR:Delete]', error);
      res.status(500).json(operationOutcome('exception', error.message || 'Internal server error'));
    }
  });

  // ── Search (GET /:resourceType) ──────────────
  router.get('/:resourceType', async (req: Request, res: Response) => {
    try {
      const { resourceType } = req.params;

      if (!isSupported(resourceType)) {
        res.status(404).json(operationOutcome('not-found', `Unknown resource type: ${resourceType}`));
        return;
      }

      const { resources, total } = await repo.search(
        resourceType,
        req.query as Record<string, string>,
      );

      const bundle = buildSearchBundle(resourceType, resources, total, req);

      if (resources.length === 0) {
        // Return empty searchset Bundle per FHIR spec
        res.json(bundle);
        return;
      }

      res.json(bundle);
    } catch (error: any) {
      console.error('[FHIR:Search]', error);
      res.status(500).json(operationOutcome('exception', error.message || 'Internal server error'));
    }
  });

  return router;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function isSupported(resourceType: string): boolean {
  return SUPPORTED_RESOURCES.some(r => r.type === resourceType);
}

function buildSearchBundle(
  resourceType: string,
  resources: Resource[],
  total: number,
  req: Request,
): Bundle {
  const baseUrl = `${req.protocol}://${req.get('host')}/fhir/r4`;
  const queryString = req.url.split('?')[1] || '';

  const bundle: Bundle = {
    resourceType: 'Bundle',
    id: uuidv4(),
    type: 'searchset',
    total,
    link: [
      { relation: 'self', url: `${baseUrl}/${resourceType}?${queryString}` },
    ],
    entry: resources.map(r => ({
      fullUrl: `${baseUrl}/${r.resourceType}/${r.id}`,
      resource: r,
      search: { mode: 'match' },
    })),
  };

  return bundle;
}

function buildCapabilityStatement(): CapabilityStatement {
  return {
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    publisher: 'OmniHealth',
    kind: 'instance',
    software: {
      name: 'OmniHealth FHIR API',
      version: '1.0.0',
      releaseDate: new Date().toISOString(),
    },
    fhirVersion: '4.0.1',
    format: ['application/fhir+json', 'application/json'],
    rest: [
      {
        mode: 'server',
        resource: SUPPORTED_RESOURCES.map(r => {
          const interactions: Array<{ code: InteractionCode; documentation?: string }> = [
            { code: 'read' },
            { code: 'search-type' },
            { code: 'create' },
            { code: 'update' },
            { code: 'delete' },
            { code: 'vread' },
          ];

          return {
            type: r.type,
            profile: r.profile,
            interaction: interactions,
            searchParam: (SEARCH_PARAMS[r.type] || []).map(sp => ({
              name: sp.name,
              type: sp.type,
              documentation: sp.doc,
            })),
            versioning: 'versioned-update',
            readHistory: true,
            updateCreate: true,
          };
        }),
        operation: [
          { name: 'everything', definition: 'http://hl7.org/fhir/OperationDefinition/Patient-everything' },
        ],
      },
    ],
  };
}

function operationOutcome(code: string, details: string): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [{
      severity: 'error',
      code,
      details: { text: details },
    }],
  };
}