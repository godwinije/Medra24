/**
 * @omnihealth/auth-middleware
 * Express middleware for JWT validation, scope enforcement, and RBAC/ABAC authorization.
 *
 * All OmniHealth HTTP services use this middleware to authenticate requests
 * forwarded by the Kong API Gateway (which performs initial token validation).
 *
 * @packageDocumentation
 */

import type { Request, Response, NextFunction } from 'express';

// ──────────────────────────────────────────────
// Core Types
// ──────────────────────────────────────────────

export interface JWTPayload {
  /** Subject — the user or system principal ID */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string | string[];
  /** Expiration time (Unix epoch seconds) */
  exp: number;
  /** Issued at (Unix epoch seconds) */
  iat: number;
  /** Not before (Unix epoch seconds) */
  nbf?: number;
  /** JWT ID — unique token identifier */
  jti?: string;
  /** User's roles */
  roles?: string[];
  /** User's permissions/scopes */
  scopes?: string[];
  /** The type of principal */
  principal_type?: 'user' | 'system' | 'facility' | 'patient' | 'admin';
  /** The facility/tenant this token is scoped to */
  facility_id?: string;
  /** The patient ID (for patient-scoped tokens) */
  patient_id?: string;
  /** User's name (for audit logging) */
  name?: string;
  /** User's email */
  email?: string;
}

/**
 * Extended Express Request with authentication context.
 * All OmniHealth services should use this type for their request handlers.
 */
export interface AuthenticatedRequest extends Request {
  /** Decoded and verified JWT payload */
  user?: JWTPayload;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Request ID for audit logging */
  requestId?: string;
}

// ──────────────────────────────────────────────
// Auth Configuration
// ──────────────────────────────────────────────

export interface AuthConfig {
  /** Expected JWT issuer (matches Kong plugin configuration) */
  issuer: string;
  /** Expected JWT audience */
  audience: string;
  /** JWKS URI for public key retrieval */
  jwksUri: string;
  /** Whether to skip validation in development */
  skipValidation?: boolean;
  /** If true, validates the token but doesn't reject if missing (for optional auth) */
  optional?: boolean;
}

const DEFAULT_AUTH_CONFIG: Partial<AuthConfig> = {
  skipValidation: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
};

// ──────────────────────────────────────────────
// Permission/Scope Definitions
// ──────────────────────────────────────────────

/**
 * OmniHealth permission scopes following FHIR resource conventions.
 * Pattern: {action}.{resource_type}[.{scope}]
 */

export const PERMISSIONS = {
  // Patient Record Permissions
  PATIENT_READ: 'read.Patient',
  PATIENT_WRITE: 'write.Patient',
  PATIENT_SEARCH: 'search.Patient',

  // Clinical Data Permissions
  OBSERVATION_READ: 'read.Observation',
  OBSERVATION_WRITE: 'write.Observation',
  CONDITION_READ: 'read.Condition',
  CONDITION_WRITE: 'write.Condition',
  ENCOUNTER_READ: 'read.Encounter',
  ENCOUNTER_WRITE: 'write.Encounter',
  MEDICATION_REQUEST_READ: 'read.MedicationRequest',
  MEDICATION_REQUEST_WRITE: 'write.MedicationRequest',
  PROCEDURE_READ: 'read.Procedure',
  PROCEDURE_WRITE: 'write.Procedure',
  ALLERGY_READ: 'read.AllergyIntolerance',
  ALLERGY_WRITE: 'write.AllergyIntolerance',
  IMMUNIZATION_READ: 'read.Immunization',
  IMMUNIZATION_WRITE: 'write.Immunization',

  // Document Permissions
  DOCUMENT_READ: 'read.DocumentReference',
  DOCUMENT_WRITE: 'write.DocumentReference',

  // Administrative Permissions
  ADMIN_USERS: 'admin.users',
  ADMIN_CONFIG: 'admin.config',
  ADMIN_AUDIT: 'admin.audit',
  ADMIN_FACILITIES: 'admin.facilities',

  // Patient-Facing Permissions
  PATIENT_OWN_READ: 'patient.own.read',

  // System Permissions
  SYSTEM_INGEST: 'system.ingest',
  SYSTEM_EXPORT: 'system.export',
  SYSTEM_HEALTH: 'system.health',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ──────────────────────────────────────────────
// Middleware: JWT Authentication
// ──────────────────────────────────────────────

/**
 * Express middleware that validates the JWT bearer token from the Authorization header.
 *
 * Expected usage:
 *   import { authenticate } from '@omnihealth/auth-middleware';
 *   app.use(authenticate({ issuer: 'https://iam.omnihealth.io', audience: 'fhir-api', jwksUri: 'https://iam.omnihealth.io/.well-known/jwks.json' }));
 */
export function authenticate(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Merge with defaults
    const authConfig: AuthConfig = { ...DEFAULT_AUTH_CONFIG, ...config } as AuthConfig;

    // Inject correlation ID from header or generate one
    const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    (req as AuthenticatedRequest).correlationId = correlationId;

    if (authConfig.skipValidation) {
      // In development/test, inject a mock user context
      (req as AuthenticatedRequest).user = {
        sub: 'dev-user',
        iss: 'development',
        aud: 'development',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        roles: ['admin'],
        scopes: ['*'],
        principal_type: 'admin',
        name: 'Development User',
      };
      res.setHeader('X-Correlation-ID', correlationId);
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      if (authConfig.optional) {
        res.setHeader('X-Correlation-ID', correlationId);
        return next();
      }
      res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'login',
          details: { text: 'Missing Authorization header. Expected: Bearer <token>' },
        }],
      });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          details: { text: 'Invalid Authorization header format. Expected: Bearer <token>' },
        }],
      });
      return;
    }

    const token = parts[1];

    // Validate JWT
    try {
      const decoded = validateTokenLocally(token, authConfig);

      // Verify issuer
      if (decoded.iss !== authConfig.issuer) {
        throw new AuthError('Invalid token issuer');
      }

      // Verify audience
      const audiences = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
      if (!audiences.includes(authConfig.audience)) {
        throw new AuthError('Invalid token audience');
      }

      // Verify expiration
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new AuthError('Token expired');
      }

      (req as AuthenticatedRequest).user = decoded;
      res.setHeader('X-Correlation-ID', correlationId);
      next();
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(401).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'security',
            details: { text: error.message },
          }],
        });
        return;
      }
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          details: { text: 'Authentication service error' },
        }],
      });
    }
  };
}

// ──────────────────────────────────────────────
// Middleware: Scope/Authorization Check
// ──────────────────────────────────────────────

/**
 * Express middleware that checks if the authenticated user has the required scope.
 *
 * Expected usage:
 *   import { authenticate, requireScope } from '@omnihealth/auth-middleware';
 *   app.get('/fhir/r4/Patient', authenticate(config), requireScope('read.Patient'), handler);
 */
export function requireScope(...requiredScopes: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'login', details: { text: 'Not authenticated' } }],
      });
      return;
    }

    // Admin wildcard check
    if (user.scopes?.includes('*') || user.scopes?.includes('admin.*')) {
      return next();
    }

    // Check all required scopes
    const userScopes = user.scopes || [];
    const hasScopes = requiredScopes.every(scope => userScopes.includes(scope));

    if (!hasScopes) {
      res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'forbidden',
          details: { text: `Insufficient permissions. Required: ${requiredScopes.join(', ')}` },
        }],
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that checks facility-level access.
 * Ensures the user's token is scoped to the requested facility.
 */
export function requireFacilityAccess() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    const requestedFacility = req.params.facilityId || req.query.facilityId as string;

    if (!user) {
      res.status(401).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'login', details: { text: 'Not authenticated' } }] });
      return;
    }

    // Admins and system users can access any facility
    if (user.principal_type === 'admin' || user.principal_type === 'system') {
      return next();
    }

    // If user has facility scope, it must match the requested facility
    if (user.facility_id && requestedFacility && user.facility_id !== requestedFacility) {
      res.status(403).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden', details: { text: `Access denied to facility ${requestedFacility}` } }] });
      return;
    }

    next();
  };
}

// ──────────────────────────────────────────────
// Internal JWT Validation
// ──────────────────────────────────────────────

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

function validateTokenLocally(token: string, _config: AuthConfig): JWTPayload {
  // In production, this function would:
  // 1. Fetch the JWKS from the configured JWKS URI
  // 2. Find the key matching the token's kid (key ID)
  // 3. Verify the token's signature using the public key
  // 4. Return the decoded payload
  //
  // For the scaffold, we provide a simplified validation that decodes without
  // cryptographic verification (actual verification requires the JWKS endpoint).
  //
  // TODO: Implement proper JWKS-based validation when IAM service is deployed.
  //       Use the `jwks-rsa` library with `jsonwebtoken`:
  //         const client = new JwksClient({ jwksUri: config.jwksUri });
  //         const key = await client.getSigningKey(kid);
  //         return jwt.verify(token, key.getPublicKey(), { algorithms: ['RS256'] });

  // Basic payload decoding (without signature verification — placeholder)
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError('Invalid JWT format');
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as JWTPayload;
    return payload;
  } catch {
    throw new AuthError('Invalid JWT payload');
  }
}

// ──────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────

function generateCorrelationId(): string {
  return `oh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Extract the authenticated user from a request (type-safe helper).
 */
export function getUser(req: Request): JWTPayload | undefined {
  return (req as AuthenticatedRequest).user;
}

/**
 * Get the correlation ID from a request.
 */
export function getCorrelationId(req: Request): string | undefined {
  return (req as AuthenticatedRequest).correlationId;
}

/**
 * Create an OperationOutcome-compatible error response for middleware usage.
 */
export function unauthorizedResponse(message: string) {
  return {
    resourceType: 'OperationOutcome' as const,
    issue: [{
      severity: 'error' as const,
      code: 'forbidden',
      details: { text: message },
    }],
  };
}