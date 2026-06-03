/**
 * In-Memory FHIR Resource Repository
 *
 * Map-based storage for FHIR resources. Implements the Repository pattern
 * so it can be swapped for MongoDB/PostgreSQL later without changing routes.
 *
 * @packageDocumentation
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Resource,
  Patient,
  Observation,
  Condition,
  Encounter,
  MedicationRequest,
  Bundle,
  BundleEntry,
  OperationOutcome,
} from '../fhir-types';

// ──────────────────────────────────────────────
// Repository Interface
// ──────────────────────────────────────────────

export interface IResourceRepository {
  create(resourceType: string, resource: any): Promise<Resource>;
  read(resourceType: string, id: string): Promise<Resource | null>;
  update(resourceType: string, id: string, resource: any): Promise<Resource | null>;
  delete(resourceType: string, id: string): Promise<boolean>;
  search(resourceType: string, params: Record<string, string | undefined>): Promise<{ resources: Resource[]; total: number }>;
  patientEverything(patientId: string): Promise<{ resources: Resource[]; total: number }>;
}

// ──────────────────────────────────────────────
// In-Memory Implementation
// ──────────────────────────────────────────────

export class InMemoryRepository implements IResourceRepository {
  /** Main storage: Map<resourceType, Map<id, resource>> */
  private store: Map<string, Map<string, Resource>> = new Map();

  /** Secondary indexes: identifier.system + identifier.value → resource id */
  private identifierIndex: Map<string, string> = new Map();

  /** Patient reference index: patient reference → [resource ids] */
  private patientRefIndex: Map<string, string[]> = new Map();

  constructor() {
    // Initialize store maps for each resource type
    for (const type of ['Patient', 'Observation', 'Condition', 'Encounter', 'MedicationRequest']) {
      this.store.set(type, new Map());
    }
  }

  // ── Create ────────────────────────────────
  async create(resourceType: string, resource: any): Promise<Resource> {
    const id = resource.id || uuidv4();
    const versionId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const stored: Resource = {
      ...resource,
      resourceType,
      id,
      meta: {
        ...(resource.meta || {}),
        versionId,
        lastUpdated: now,
        profile: resource.meta?.profile || ['https://fhir.omnihealth.io/StructureDefinition/omnihealth-resource'],
      },
    };

    // Store in resource-type map
    const typeStore = this.store.get(resourceType);
    if (typeStore) {
      typeStore.set(id, stored);
    }

    // Update identifier index
    this.indexIdentifiers(stored, id);

    // Update patient reference index
    this.indexPatientRef(stored, id);

    return stored;
  }

  // ── Read ──────────────────────────────────
  async read(resourceType: string, id: string): Promise<Resource | null> {
    const typeStore = this.store.get(resourceType);
    if (!typeStore) return null;
    return typeStore.get(id) || null;
  }

  // ── Update ────────────────────────────────
  async update(resourceType: string, id: string, resource: any): Promise<Resource | null> {
    const typeStore = this.store.get(resourceType);
    if (!typeStore) return null;
    if (!typeStore.has(id)) return null;

    const versionId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const stored: Resource = {
      ...resource,
      resourceType,
      id,
      meta: {
        ...(resource.meta || {}),
        versionId,
        lastUpdated: now,
      },
    };

    typeStore.set(id, stored);
    this.indexIdentifiers(stored, id);
    this.indexPatientRef(stored, id);

    return stored;
  }

  // ── Delete ────────────────────────────────
  async delete(resourceType: string, id: string): Promise<boolean> {
    const typeStore = this.store.get(resourceType);
    if (!typeStore) return false;
    return typeStore.delete(id);
  }

  // ── Search ────────────────────────────────
  async search(
    resourceType: string,
    params: Record<string, string | undefined>,
  ): Promise<{ resources: Resource[]; total: number }> {
    const typeStore = this.store.get(resourceType);
    if (!typeStore) return { resources: [], total: 0 };

    let results = Array.from(typeStore.values());

    // Apply search filters
    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;

      // Common params
      if (key === '_id') {
        results = results.filter(r => r.id === value);
        continue;
      }
      if (key === '_count') continue;
      if (key === '_sort') continue;
      if (key === '_summary' && value === 'count') {
        return { resources: [], total: results.length };
      }

      // Resource-specific search
      results = this.applySearchFilter(resourceType, results, key, value);
    }

    // Pagination
    const count = parseInt(params._count || '20', 10);
    const total = results.length;
    const paged = results.slice(0, Math.min(count, 1000));

    return { resources: paged, total };
  }

  // ── Patient $everything ───────────────────
  async patientEverything(patientId: string): Promise<{ resources: Resource[]; total: number }> {
    const patientRef = `Patient/${patientId}`;
    const results: Resource[] = [];

    // Get the Patient resource
    const patient = await this.read('Patient', patientId);
    if (patient) results.push(patient);

    // Get all resources linked to this patient
    const linkedIds = this.patientRefIndex.get(patientRef) || [];
    for (const id of linkedIds) {
      for (const [type, typeStore] of this.store.entries()) {
        if (type === 'Patient') continue;
        const resource = typeStore.get(id);
        if (resource) results.push(resource);
      }
    }

    return { resources: results, total: results.length };
  }

  // ── Private Helpers ───────────────────────

  private applySearchFilter(
    resourceType: string,
    results: Resource[],
    key: string,
    value: string,
  ): Resource[] {
    switch (resourceType) {
      case 'Patient':
        return this.filterPatient(results as Patient[], key, value);
      case 'Observation':
        return this.filterObservation(results as Observation[], key, value);
      case 'Condition':
        return this.filterCondition(results as Condition[], key, value);
      case 'Encounter':
        return this.filterEncounter(results as Encounter[], key, value);
      case 'MedicationRequest':
        return this.filterMedicationRequest(results as MedicationRequest[], key, value);
      default:
        return results;
    }
  }

  private filterPatient(results: Patient[], key: string, value: string): Patient[] {
    switch (key) {
      case 'identifier': {
        const parts = value.split('|');
        const sys = parts[0];
        const val = parts[1] || parts[0];
        return results.filter(p =>
          p.identifier?.some(id =>
            (!sys || id.system === sys) && id.value === val
          )
        );
      }
      case 'name':
        const nameLower = value.toLowerCase();
        return results.filter(p =>
          p.name?.some(n =>
            n.family?.toLowerCase().includes(nameLower) ||
            n.given?.some(g => g.toLowerCase().includes(nameLower))
          )
        );
      case 'family':
        return results.filter(p =>
          p.name?.some(n => n.family?.toLowerCase() === value.toLowerCase())
        );
      case 'given':
        return results.filter(p =>
          p.name?.some(n =>
            n.given?.some(g => g.toLowerCase() === value.toLowerCase())
          )
        );
      case 'birthdate':
        return results.filter(p => p.birthDate === value);
      case 'gender':
        return results.filter(p => p.gender === value);
      case 'active':
        return results.filter(p => p.active === (value === 'true'));
      case 'telecom':
        return results.filter(p =>
          p.telecom?.some(t => t.value === value)
        );
      case 'email':
        return results.filter(p =>
          p.telecom?.some(t => t.system === 'email' && t.value === value)
        );
      case 'phone':
        return results.filter(p =>
          p.telecom?.some(t => t.system === 'phone' && t.value === value)
        );
      case 'address':
        const addrLower = value.toLowerCase();
        return results.filter(p =>
          p.address?.some(a =>
            a.line?.some(l => l.toLowerCase().includes(addrLower)) ||
            a.city?.toLowerCase().includes(addrLower) ||
            a.state?.toLowerCase().includes(addrLower) ||
            a.postalCode?.includes(value)
          )
        );
      default:
        return results;
    }
  }

  private filterObservation(results: Observation[], key: string, value: string): Observation[] {
    switch (key) {
      case 'patient':
        return results.filter(o =>
          o.subject?.reference === `Patient/${value}` ||
          o.subject?.reference === value
        );
      case 'subject':
        return results.filter(o => o.subject?.reference === value);
      case 'code': {
        const parts = value.split('|');
        const sys = parts[0];
        const code = parts[1] || parts[0];
        return results.filter(o =>
          o.code?.coding?.some(c =>
            (!sys || c.system === sys) && c.code === code
          )
        );
      }
      case 'date':
        return results.filter(o =>
          o.effectiveDateTime?.startsWith(value) ||
          o.effectivePeriod?.start?.startsWith(value)
        );
      case 'status':
        return results.filter(o => o.status === value);
      case 'category':
        return results.filter(o =>
          o.category?.some(c => c.coding?.some(co => co.code === value))
        );
      case 'encounter':
        return results.filter(o =>
          o.encounter?.reference === `Encounter/${value}` ||
          o.encounter?.reference === value
        );
      default:
        return results;
    }
  }

  private filterCondition(results: Condition[], key: string, value: string): Condition[] {
    switch (key) {
      case 'patient':
        return results.filter(c =>
          c.subject?.reference === `Patient/${value}` ||
          c.subject?.reference === value
        );
      case 'subject':
        return results.filter(c => c.subject?.reference === value);
      case 'code': {
        const parts = value.split('|');
        const sys = parts[0];
        const code = parts[1] || parts[0];
        return results.filter(c =>
          c.code?.coding?.some(cd =>
            (!sys || cd.system === sys) && cd.code === code
          )
        );
      }
      case 'clinical-status':
        return results.filter(c => c.clinicalStatus?.coding?.[0]?.code === value);
      case 'encounter':
        return results.filter(c =>
          c.encounter?.reference === `Encounter/${value}` ||
          c.encounter?.reference === value
        );
      case 'onset-date':
        return results.filter(c => c.onsetDateTime?.startsWith(value));
      case 'recorded-date':
        return results.filter(c => c.recordedDate?.startsWith(value));
      default:
        return results;
    }
  }

  private filterEncounter(results: Encounter[], key: string, value: string): Encounter[] {
    switch (key) {
      case 'patient':
      case 'subject':
        return results.filter(e =>
          e.subject?.reference === `Patient/${value}` ||
          e.subject?.reference === value
        );
      case 'date':
        return results.filter(e =>
          e.period?.start?.startsWith(value) ||
          e.period?.end?.startsWith(value)
        );
      case 'status':
        return results.filter(e => e.status === value);
      case 'type':
        return results.filter(e =>
          e.type?.some(t => t.coding?.some(c => c.code === value))
        );
      case 'class':
        return results.filter(e => e.class?.code === value);
      case 'practitioner':
        return results.filter(e =>
          e.participant?.some(p =>
            p.individual?.reference === `Practitioner/${value}` ||
            p.individual?.reference === value
          )
        );
      default:
        return results;
    }
  }

  private filterMedicationRequest(results: MedicationRequest[], key: string, value: string): MedicationRequest[] {
    switch (key) {
      case 'patient':
      case 'subject':
        return results.filter(m =>
          m.subject?.reference === `Patient/${value}` ||
          m.subject?.reference === value
        );
      case 'code': {
        const parts = value.split('|');
        const sys = parts[0];
        const code = parts[1] || parts[0];
        return results.filter(m =>
          m.medicationCodeableConcept?.coding?.some(c =>
            (!sys || c.system === sys) && c.code === code
          )
        );
      }
      case 'status':
        return results.filter(m => m.status === value);
      case 'intent':
        return results.filter(m => m.intent === value);
      case 'authoredon':
        return results.filter(m => m.authoredOn?.startsWith(value));
      case 'encounter':
        return results.filter(m =>
          m.encounter?.reference === `Encounter/${value}` ||
          m.encounter?.reference === value
        );
      default:
        return results;
    }
  }

  private indexIdentifiers(resource: Resource, id: string): void {
    const identifiers = (resource as any).identifier;
    if (!Array.isArray(identifiers)) return;
    for (const idObj of identifiers) {
      if (idObj.system && idObj.value) {
        this.identifierIndex.set(`${idObj.system}|${idObj.value}`, id);
      }
    }
  }

  private indexPatientRef(resource: Resource, id: string): void {
    if (resource.resourceType === 'Patient') return;
    const ref = (resource as any).subject?.reference || (resource as any).patient?.reference;
    if (!ref) return;

    const existing = this.patientRefIndex.get(ref) || [];
    if (!existing.includes(id)) {
      existing.push(id);
      this.patientRefIndex.set(ref, existing);
    }
  }
}