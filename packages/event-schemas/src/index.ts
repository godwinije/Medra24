/**
 * @omnihealth/event-schemas
 * Kafka event schemas and TypeScript types for OmniHealth's event-driven architecture.
 *
 * Each topic has a corresponding event envelope and a set of payload types.
 * Services produce and consume these events via Apache Kafka.
 *
 * @packageDocumentation
 */

// ──────────────────────────────────────────────
// Event Envelope
// ──────────────────────────────────────────────

/**
 * Standard event envelope wrapping every message published to OmniHealth Kafka topics.
 * Ensures consistent metadata across all events for auditing and traceability.
 */
export interface EventEnvelope<T = unknown> {
  /** Unique event ID (UUID v4) */
  id: string;
  /** Event type discriminator — tells consumers how to deserialize `data` */
  type: string;
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string;
  /** Source service that produced the event */
  source: string;
  /** The event payload */
  data: T;
  /** Correlation ID for tracing across service boundaries */
  correlationId?: string;
  /** ID of the authenticated user/principal who triggered this event (if applicable) */
  principalId?: string;
  /** ID of the facility/tenant that owns the data */
  facilityId?: string;
  /** FHIR resource type associated with the event (if applicable) */
  resourceType?: string;
  /** FHIR resource ID associated with the event (if applicable) */
  resourceId?: string;
  /** FHIR versionId for optimistic concurrency */
  versionId?: string;
  /** Schema version for forward/backward compatibility */
  schemaVersion: number;
}

// ──────────────────────────────────────────────
// Topic Registry
// ──────────────────────────────────────────────

/** All Kafka topics in the OmniHealth event-driven architecture */
export const TOPICS = {
  /** Raw ingested clinical messages before transformation (HL7 v2, C-CDA, raw FHIR) */
  CLINICAL_RAW: 'clinical.raw' as const,
  /** Validated and enriched FHIR R4 resources ready for persistence */
  CLINICAL_ENRICHED: 'clinical.enriched' as const,
  /** Patient identity matching/merging events */
  IDENTITY_MATCHED: 'identity.patient.matched' as const,
  /** New patient golden records created by the MPI */
  IDENTITY_CREATED: 'identity.patient.created' as const,
  /** Patient consent changes */
  CONSENT_CHANGED: 'consent.changed' as const,
  /** PHI access audit events */
  AUDIT_ACCESS: 'audit.access' as const,
  /** Administrative configuration changes */
  AUDIT_ADMIN: 'audit.admin' as const,
  /** Clinical alerts from population health / decision support */
  CLINICAL_ALERT: 'clinical.alert' as const,
  /** Outbound notifications (email, SMS, push, webhook) */
  NOTIFICATION_SEND: 'notification.send' as const,
} as const;

export type TopicName = typeof TOPICS[keyof typeof TOPICS];

// ──────────────────────────────────────────────
// Topic-Specific Event Payloads
// ──────────────────────────────────────────────

// ── clinical.raw (Data Ingestion Pipeline → Kafka) ──

export interface ClinicalRawEventPayload {
  /** Facility that sent the message */
  facilityId: string;
  /** Original message format */
  sourceFormat: 'HL7_V2' | 'C_CDA' | 'FHIR_BUNDLE' | 'CSV' | 'OTHER';
  /** Original message content (may be base64-encoded binary) */
  rawPayload: string;
  /** Encoding of the raw payload */
  encoding: 'utf-8' | 'base64' | 'other';
  /** Message control ID from the original system */
  messageControlId?: string;
  /** Message timestamp from the original system */
  messageTimestamp?: string;
  /** Processing status */
  processingStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// ── clinical.enriched (Stream Processor → Persistence) ──

export interface ClinicalEnrichedEventPayload {
  /** The validated FHIR R4 resource (serialized as JSON) */
  resource: Record<string, unknown>;
  /** The FHIR resource type */
  resourceType: string;
  /** The FHIR resource logical ID */
  resourceId: string;
  /** The versionId for optimistic concurrency */
  versionId?: string;
  /** If this was created from a raw source, the original message ID */
  sourceMessageId?: string;
  /** The facility where the clinical event originated */
  facilityId?: string;
  /** The patient UUID in OmniHealth's golden record (if known) */
  omniPatientId?: string;
  /** The patient's facility-level MRN */
  facilityMrn?: string;
  /** Any validation warnings during processing */
  validationWarnings?: string[];
}

// ── identity.patient.matched (MPI → Services) ──

export interface IdentityMatchEventPayload {
  /** The OmniHealth golden record patient ID */
  goldenPatientId: string;
  /** Array of facility-specific patient records linked to this golden record */
  linkedRecords: LinkedRecord[];
  /** The match type that triggered this event */
  matchType: 'deterministic' | 'probabilistic' | 'manual';
  /** The Match confidence score (0.0–1.0) for probabilistic matches */
  confidenceScore?: number;
  /** Whether this was an auto-merge or requires review */
  autoMerged: boolean;
  /** Previous golden patient ID if this record was merged into another */
  supersededPatientId?: string;
}

export interface LinkedRecord {
  facilityId: string;
  mrn: string;
  relationship: 'replaced-by' | 'replaces' | 'seealso' | 'refer';
}

// ── identity.patient.created (MPI → Services) ──

export interface IdentityCreatedEventPayload {
  /** The new OmniHealth golden record patient ID */
  patientId: string;
  /** The facility where this patient was first seen */
  originatingFacilityId: string;
  /** The facility MRN */
  facilityMrn: string;
  /** Patient demographics summary */
  demographics: {
    name?: string;
    birthDate?: string;
    gender?: string;
  };
  /** Timestamp of creation */
  createdAt: string;
}

// ── consent.changed (Consent Service → FHIR API, MPI) ──

export interface ConsentChangeEventPayload {
  /** The OmniHealth patient ID */
  patientId: string;
  /** The FHIR Consent resource ID */
  consentId: string;
  /** New consent status */
  newStatus: 'active' | 'inactive' | 'rejected' | 'draft';
  /** Previous consent status (null if first creation) */
  previousStatus?: string;
  /** ISO 8601 timestamp of the change */
  changedAt: string;
  /** Scope of the change */
  scope: 'patient' | 'facility' | 'national';
  /** The facility this consent relates to (if facility-scoped) */
  facilityId?: string;
}

// ── audit.access (All Services → Audit Service) ──

export interface AuditAccessEventPayload {
  /** The authenticated user or system principal */
  principalId: string;
  /** The principal type */
  principalType: 'user' | 'system' | 'facility' | 'patient';
  /** The action performed */
  action: 'create' | 'read' | 'update' | 'delete' | 'search' | 'export' | 'login' | 'logout';
  /** The resource type accessed */
  resourceType: string;
  /** The resource ID accessed */
  resourceId?: string;
  /** The service that handled the request */
  serviceName: string;
  /** The facility context */
  facilityId?: string;
  /** The patient whose PHI was accessed */
  subjectPatientId?: string;
  /** Request details */
  request: {
    method?: string;
    path?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  /** Whether the action was permitted or denied */
  outcome: 'success' | 'denied' | 'error';
  /** Optional reason for denial */
  denialReason?: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Correlation ID linking this audit event to the original request */
  correlationId?: string;
}

// ── audit.admin (Admin Service → Audit Service) ──

export interface AuditAdminEventPayload {
  /** Admin user who made the change */
  principalId: string;
  /** Type of configuration change */
  action: 'config_update' | 'feature_toggle' | 'tenant_onboard' | 'tenant_offboard' | 'user_role_change' | 'system_update';
  /** The target of the change */
  target: string;
  /** Previous value (for sensitive changes) */
  previousValue?: string;
  /** New value */
  newValue?: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Correlation ID */
  correlationId?: string;
}

// ── clinical.alert (Population Health → Notification Service) ──

export interface ClinicalAlertEventPayload {
  /** Unique alert ID */
  alertId: string;
  /** Alert severity */
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  /** Alert type */
  alertType: 'notifiable_disease' | 'outbreak_detection' | 'abnormal_lab' | 'drug_interaction' | 'vaccine_due' | 'risk_stratification';
  /** Alert title */
  title: string;
  /** Alert description / message body */
  description: string;
  /** Patients affected (may be empty for population-level alerts) */
  patientIds?: string[];
  /** Facility context */
  facilityId?: string;
  /** Geographic region for population-level alerts */
  region?: string;
  /** FHIR resource references that triggered this alert */
  triggeringResources?: Array<{ resourceType: string; resourceId: string }>;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Suggested actions for recipients */
  suggestedAction?: string;
}

// ── notification.send (Any Service → Notification Service) ──

export interface NotificationSendEventPayload {
  /** Notification ID for deduplication */
  notificationId: string;
  /** Target channel */
  channel: 'email' | 'sms' | 'push' | 'webhook' | 'websocket';
  /** Recipient(s) */
  recipients: string[];
  /** Notification subject / title */
  subject: string;
  /** Notification body */
  body: string;
  /** Optional HTML body for email */
  htmlBody?: string;
  /** Priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Delivery schedule */
  schedule?: 'immediate' | 'digest' | 'scheduled';
  /** Scheduled time (ISO 8601) */
  scheduledAt?: string;
  /** Correlation ID for linking back to the triggering event */
  correlationId?: string;
  /** Callback webhook URL for delivery status */
  statusCallbackUrl?: string;
}

// ──────────────────────────────────────────────
// Event Type Maps
// ──────────────────────────────────────────────

/**
 * Maps each topic name to its expected payload type.
 * Use this for type-safe Kafka consumers/producers.
 */
export interface EventPayloadMap {
  [TOPICS.CLINICAL_RAW]: ClinicalRawEventPayload;
  [TOPICS.CLINICAL_ENRICHED]: ClinicalEnrichedEventPayload;
  [TOPICS.IDENTITY_MATCHED]: IdentityMatchEventPayload;
  [TOPICS.IDENTITY_CREATED]: IdentityCreatedEventPayload;
  [TOPICS.CONSENT_CHANGED]: ConsentChangeEventPayload;
  [TOPICS.AUDIT_ACCESS]: AuditAccessEventPayload;
  [TOPICS.AUDIT_ADMIN]: AuditAdminEventPayload;
  [TOPICS.CLINICAL_ALERT]: ClinicalAlertEventPayload;
  [TOPICS.NOTIFICATION_SEND]: NotificationSendEventPayload;
}

// ──────────────────────────────────────────────
// Consumer Group Constants
// ──────────────────────────────────────────────

export const CONSUMER_GROUPS = {
  STREAM_PROCESSOR: 'omnihealth-stream-processor',
  PERSISTENCE_WORKER: 'omnihealth-persistence-worker',
  ELASTICSEARCH_INDEXER: 'omnihealth-es-indexer',
  POPULATION_HEALTH: 'omnihealth-pop-health',
  AUDIT_SERVICE: 'omnihealth-audit-service',
  NOTIFICATION_SERVICE: 'omnihealth-notification-service',
  ARCHIVE_WORKER: 'omnihealth-archive-worker',
} as const;

export type ConsumerGroup = typeof CONSUMER_GROUPS[keyof typeof CONSUMER_GROUPS];

// ──────────────────────────────────────────────
// Topic Configuration
// ──────────────────────────────────────────────

export interface TopicConfig {
  name: TopicName;
  partitions: number;
  replicationFactor: number;
  retentionMs: number;
  cleanupPolicy: 'delete' | 'compact' | 'compact,delete';
  description: string;
}

export const TOPIC_CONFIGS: TopicConfig[] = [
  {
    name: TOPICS.CLINICAL_RAW,
    partitions: 12,
    replicationFactor: 3,
    retentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    cleanupPolicy: 'delete',
    description: 'Raw ingested clinical messages before transformation',
  },
  {
    name: TOPICS.CLINICAL_ENRICHED,
    partitions: 12,
    replicationFactor: 3,
    retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    cleanupPolicy: 'compact,delete',
    description: 'Validated and enriched FHIR R4 resources',
  },
  {
    name: TOPICS.IDENTITY_MATCHED,
    partitions: 6,
    replicationFactor: 3,
    retentionMs: 90 * 24 * 60 * 60 * 1000, // 90 days
    cleanupPolicy: 'compact',
    description: 'Patient identity matching/merging events',
  },
  {
    name: TOPICS.IDENTITY_CREATED,
    partitions: 6,
    replicationFactor: 3,
    retentionMs: 90 * 24 * 60 * 60 * 1000,
    cleanupPolicy: 'compact',
    description: 'New patient golden records',
  },
  {
    name: TOPICS.CONSENT_CHANGED,
    partitions: 3,
    replicationFactor: 3,
    retentionMs: 365 * 24 * 60 * 60 * 1000, // 1 year
    cleanupPolicy: 'compact',
    description: 'Patient consent changes',
  },
  {
    name: TOPICS.AUDIT_ACCESS,
    partitions: 12,
    replicationFactor: 3,
    retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days (archived to MinIO after)
    cleanupPolicy: 'delete',
    description: 'PHI access audit events',
  },
  {
    name: TOPICS.AUDIT_ADMIN,
    partitions: 3,
    replicationFactor: 3,
    retentionMs: 365 * 24 * 60 * 60 * 1000, // 1 year
    cleanupPolicy: 'compact',
    description: 'Administrative configuration changes',
  },
  {
    name: TOPICS.CLINICAL_ALERT,
    partitions: 3,
    replicationFactor: 3,
    retentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    cleanupPolicy: 'delete',
    description: 'Clinical decision support alerts',
  },
  {
    name: TOPICS.NOTIFICATION_SEND,
    partitions: 3,
    replicationFactor: 3,
    retentionMs: 3 * 24 * 60 * 60 * 1000, // 3 days
    cleanupPolicy: 'delete',
    description: 'Outbound notification requests',
  },
];