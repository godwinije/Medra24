/**
 * @omnihealth/audit-client
 * Structured audit log emission for OmniHealth services.
 *
 * Produces HIPAA-compliant audit events to the `audit.access` Kafka topic.
 * Every PHI access, administrative change, and security event is captured.
 *
 * Usage:
 *   import { AuditClient } from '@omnihealth/audit-client';
 *   const audit = new AuditClient({ serviceName: 'fhir-api' });
 *   await audit.record('read', 'Patient', 'pat-123', { principalId: 'user-456', outcome: 'success' });
 *
 * @packageDocumentation
 */

import type {
  AuditAccessEventPayload,
  AuditAdminEventPayload,
} from '@omnihealth/event-schemas';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface AuditClientConfig {
  /** Name of the service producing audit events */
  serviceName: string;
  /** Kafka brokers (if using inline Kafka producer) */
  kafkaBrokers?: string[];
  /** Whether to emit audit events (disable in test/dev) */
  enabled?: boolean;
  /** Fallback: write to stdout if Kafka unavailable */
  fallbackToStdout?: boolean;
}

export interface AuditRecordOptions {
  principalId: string;
  principalType?: 'user' | 'system' | 'facility' | 'patient';
  resourceId?: string;
  facilityId?: string;
  subjectPatientId?: string;
  request?: {
    method?: string;
    path?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  outcome?: 'success' | 'denied' | 'error';
  denialReason?: string;
  correlationId?: string;
}

export interface AdminAuditRecordOptions {
  principalId: string;
  action: AuditAdminEventPayload['action'];
  target: string;
  previousValue?: string;
  newValue?: string;
  correlationId?: string;
}

// ──────────────────────────────────────────────
// Audit Client
// ──────────────────────────────────────────────

export class AuditClient {
  private readonly config: Required<AuditClientConfig>;
  private producer: KafkaProducer | null = null;

  constructor(config: AuditClientConfig) {
    this.config = {
      serviceName: config.serviceName,
      kafkaBrokers: config.kafkaBrokers || ['localhost:9092'],
      enabled: config.enabled ?? true,
      fallbackToStdout: config.fallbackToStdout ?? (process.env.NODE_ENV === 'development'),
    };
  }

  /**
   * Record a PHI access audit event (HIPAA-required).
   * Emitted for every create, read, update, delete, search, or export of Protected Health Information.
   */
  async record(
    action: AuditAccessEventPayload['action'],
    resourceType: string,
    resourceId: string | undefined,
    options: AuditRecordOptions,
  ): Promise<void> {
    if (!this.config.enabled) return;

    const event: AuditAccessEventPayload = {
      principalId: options.principalId,
      principalType: options.principalType || 'user',
      action,
      resourceType,
      resourceId,
      serviceName: this.config.serviceName,
      facilityId: options.facilityId,
      subjectPatientId: options.subjectPatientId,
      request: options.request || {
        method: 'UNKNOWN',
        path: 'UNKNOWN',
      },
      outcome: options.outcome || 'success',
      denialReason: options.denialReason,
      timestamp: new Date().toISOString(),
      correlationId: options.correlationId,
    };

    await this.emit('audit.access', event);
  }

  /**
   * Record an administrative audit event (configuration changes, user role changes, etc.).
   */
  async recordAdmin(action: AdminAuditRecordOptions['action'], options: AdminAuditRecordOptions): Promise<void> {
    if (!this.config.enabled) return;

    const event: AuditAdminEventPayload = {
      principalId: options.principalId,
      action,
      target: options.target,
      previousValue: options.previousValue,
      newValue: options.newValue,
      timestamp: new Date().toISOString(),
      correlationId: options.correlationId,
    };

    await this.emit('audit.admin', event);
  }

  /**
   * Convenience method: record a successful read of a patient record.
   */
  async recordPatientRead(
    patientId: string,
    principalId: string,
    options?: Partial<AuditRecordOptions>,
  ): Promise<void> {
    return this.record('read', 'Patient', patientId, {
      principalId,
      subjectPatientId: patientId,
      ...options,
    });
  }

  /**
   * Convenience method: record a denied access attempt (important for HIPAA breach detection).
   */
  async recordDeniedAccess(
    resourceType: string,
    principalId: string,
    reason: string,
    options?: Partial<AuditRecordOptions>,
  ): Promise<void> {
    return this.record('read', resourceType, options?.resourceId, {
      principalId,
      outcome: 'denied',
      denialReason: reason,
      ...options,
    });
  }

  /**
   * Emit the audit event to Kafka (or stdout fallback).
   */
  private async emit(topic: string, payload: unknown): Promise<void> {
    if (this.config.fallbackToStdout) {
      const entry = {
        topic,
        timestamp: new Date().toISOString(),
        payload,
      };
      console.log(JSON.stringify(entry));
      return;
    }

    try {
      const producer = await this.getProducer();
      await producer.send(topic, payload);
    } catch (error) {
      // Fallback to stdout if Kafka is unavailable
      console.error('[AuditClient] Failed to emit audit event to Kafka, falling back to stdout:', error);
      console.log(JSON.stringify({ topic, payload }));
    }
  }

  private async getProducer(): Promise<KafkaProducer> {
    if (!this.producer) {
      // TODO: Initialize real Kafka producer when Kafka infrastructure is available.
      // Example with kafkajs:
      //   const { Kafka } = require('kafkajs');
      //   const kafka = new Kafka({ clientId: this.config.serviceName, brokers: this.config.kafkaBrokers });
      //   this.producer = kafka.producer();
      //   await this.producer.connect();
      this.producer = new StubKafkaProducer();
    }
    return this.producer;
  }

  /**
   * Gracefully disconnect the Kafka producer.
   */
  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
  }
}

// ──────────────────────────────────────────────
// Kafka Producer Interface
// ──────────────────────────────────────────────

interface KafkaProducer {
  send(topic: string, message: unknown): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Stub Kafka producer for development — logs to console.
 * Replace with actual KafkaJS producer in production.
 */
class StubKafkaProducer implements KafkaProducer {
  async send(topic: string, message: unknown): Promise<void> {
    console.debug(`[AuditClient:Kafka] Topic=${topic}`, JSON.stringify(message).substring(0, 200));
  }

  async disconnect(): Promise<void> {
    // No-op for stub
  }
}

// ──────────────────────────────────────────────
// Express Middleware Helper
// ──────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';

/**
 * Express middleware that automatically audits all requests to a route.
 * Ties into the AuthenticatedRequest pattern from @omnihealth/auth-middleware.
 *
 * Usage:
 *   import { AuditClient, auditMiddleware } from '@omnihealth/audit-client';
 *   const audit = new AuditClient({ serviceName: 'fhir-api' });
 *   app.get('/fhir/r4/Patient/:id', auditMiddleware(audit, 'read', 'Patient'), handler);
 */
export function auditMiddleware(auditClient: AuditClient, action: AuditAccessEventPayload['action'], resourceType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send.bind(res);

    res.send = function (body: unknown): Response {
      const user = (req as any).user;
      const resourceId = req.params.id || (req.query._id as string);

      // Record audit asynchronously (don't block response)
      auditClient.record(action, resourceType, resourceId, {
        principalId: user?.sub || 'anonymous',
        principalType: user?.principal_type,
        resourceId,
        facilityId: user?.facility_id,
        request: {
          method: req.method,
          path: req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
        outcome: res.statusCode < 400 ? 'success' : 'error',
        correlationId: (req as any).correlationId,
      }).catch((err: Error) => console.error('[AuditMiddleware] Error recording audit:', err));

      return originalSend(body);
    };

    next();
  };
}