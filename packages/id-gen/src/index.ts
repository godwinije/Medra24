/**
 * @omnihealth/id-gen
 * ID generation utilities for OmniHealth.
 *
 * Provides deterministic and UUID-based ID generation for:
 * - FHIR resource logical IDs (UUID v4)
 * - Patient golden record IDs (UUID v4)
 * - Deterministic IDs for idempotent operations (hash-based)
 * - Correlation IDs for distributed tracing
 * - Short IDs for logging and display
 *
 * @packageDocumentation
 */

import * as crypto from 'node:crypto';

// ──────────────────────────────────────────────
// UUID v4 Generation
// ──────────────────────────────────────────────

/**
 * Generate a UUID v4 for FHIR resource logical IDs.
 * These are immutable, globally unique identifiers.
 *
 * Used for:
 * - Patient.id, Observation.id, etc. (FHIR resource logical IDs)
 * - OmniHealth golden patient record IDs
 * - Bundle entry fullUrl values
 * - Event IDs
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Generate a UUID v4 prefixed with a resource type hint.
 * Useful for debugging (the ID is self-describing).
 *
 * Example: `Patient-550e8400-e29b-41d4-a716-446655440000`
 */
export function typedUuid(resourceType: string): string {
  return `${resourceType}-${crypto.randomUUID()}`;
}

// ──────────────────────────────────────────────
// Deterministic ID Generation
// ──────────────────────────────────────────────

/**
 * Generate a deterministic FHIR resource ID from a namespace + seed value.
 * Ensures idempotent creation — the same inputs always produce the same ID.
 *
 * Useful for:
 * - Deduplication: generating the same ID for the same source record
 * - MPI: deterministic hash of facility MRN + facility ID
 * - Terminology: stable IDs for code system concepts
 *
 * @param namespace - A namespace string (e.g., 'Patient', 'facility-123')
 * @param seed - The seed value (e.g., MRN, national ID, source system ID)
 * @returns A UUID v5 (deterministic) string
 */
export function deterministicId(namespace: string, seed: string): string {
  const namespaceUuid = createNamespaceUuid(namespace);
  return crypto.createHash('sha256')
    .update(namespaceUuid + seed)
    .digest('hex')
    .substring(0, 32)
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
    .toLowerCase();
}

/**
 * Create a UUID v5 from a namespace string for use as a base for deterministic IDs.
 */
function createNamespaceUuid(namespace: string): string {
  const ns = crypto.createHash('md5').update(namespace).digest('hex');
  return `${ns.substring(0, 8)}-${ns.substring(8, 12)}-${ns.substring(12, 16)}-${ns.substring(16, 20)}-${ns.substring(20, 32)}`;
}

/**
 * Generate a deterministic ID for a FHIR resource based on its source system identifiers.
 *
 * @param facilityId - The facility/scoping identifier
 * @param sourceId - The source record's ID in the facility's system
 * @param resourceType - The FHIR resource type
 */
export function fhirResourceId(facilityId: string, sourceId: string, resourceType: string): string {
  return deterministicId(`${facilityId}:${resourceType}`, sourceId);
}

// ──────────────────────────────────────────────
// Correlation ID
// ──────────────────────────────────────────────

/**
 * Generate a correlation ID for distributed tracing across service boundaries.
 * Format: `oh-{timestamp-base36}-{random8}`
 *
 * These are lightweight, URL-safe, and human-readable.
 */
export function correlationId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `oh-${timestamp}-${random}`;
}

/**
 * Generate a short correlation ID suitable for logging (no prefix, shorter).
 */
export function shortCorrelationId(): string {
  return crypto.randomBytes(6).toString('hex');
}

// ──────────────────────────────────────────────
// Patient ID (OmniHealth Golden Record)
// ──────────────────────────────────────────────

/**
 * Generate a new OmniHealth golden patient record ID.
 * This is a UUID v4 specifically for the MPI golden record.
 */
export function patientId(): string {
  return uuid();
}

/**
 * Generate a deterministic patient ID from a national identifier (e.g., SSN, national ID).
 * This allows the MPI to create a predictable golden record ID for deterministic matches.
 */
export function deterministicPatientId(nationalId: string): string {
  return deterministicId('omnihealth-patient', nationalId);
}

// ──────────────────────────────────────────────
// Facility/Organization IDs
// ──────────────────────────────────────────────

/**
 * Generate a facility ID from a facility OID.
 * Common OID formats: urn:oid:1.2.3.4.5.6.7
 */
export function facilityIdFromOid(oid: string): string {
  return deterministicId('facility', oid);
}

// ──────────────────────────────────────────────
// Short IDs for Logging & Display
// ──────────────────────────────────────────────

/**
 * Truncate a UUID to its first N characters for display in logs.
 */
export function shortId(id: string, length: number = 8): string {
  return id.substring(0, length);
}

/**
 * Generate a short, human-readable request ID for logging.
 * Format: 8 hex characters
 */
export function requestId(): string {
  return crypto.randomBytes(4).toString('hex');
}

// ──────────────────────────────────────────────
// Version ID (FHIR versionId)
// ──────────────────────────────────────────────

/**
 * Generate a FHIR versionId for a resource update.
 * Uses a timestamp-based scheme + random suffix for uniqueness.
 */
export function versionId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(2).toString('hex');
  return `${timestamp}-${random}`;
}

// ──────────────────────────────────────────────
// Sequence ID
// ──────────────────────────────────────────────

/**
 * Create a monotonically increasing sequence ID (e.g., for audit log ordering).
 * Wraps a simple incrementing counter with a timestamp prefix.
 *
 * NOTE: This is NOT distributed-safe. Use Kafka offsets or database sequences
 * for distributed ordering. This is for local single-process sequence generation.
 */
export class SequenceIdGenerator {
  private counter = 0;
  private readonly prefix: string;

  constructor(prefix: string = 'seq') {
    this.prefix = prefix;
  }

  next(): string {
    this.counter++;
    return `${this.prefix}-${Date.now().toString(36)}-${this.counter.toString(36).padStart(6, '0')}`;
  }
}