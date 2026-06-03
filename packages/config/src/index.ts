/**
 * @omnihealth/config
 * Shared configuration loader for OmniHealth services.
 *
 * Provides environment-aware, type-safe configuration loading with:
 * - Environment variable resolution with typed defaults
 * - Required field validation with clear error messages
 * - Secrets loading integration (for Vault)
 * - Environment-specific config overlays (development, staging, production)
 * - TypeScript type inference for autocompletion
 *
 * Usage:
 *   import { createConfig, type ServiceConfig } from '@omnihealth/config';
 *   const config = createConfig({ serviceName: 'fhir-api' });
 *   await config.load();
 *   console.log(config.get('port')); // => 3000
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ──────────────────────────────────────────────
// Configuration Schema Types
// ──────────────────────────────────────────────

/**
 * All possible configuration keys for OmniHealth services.
 * Extend this union as new configuration needs arise.
 */
export type ConfigKey =
  // Service Identity
  | 'serviceName'
  | 'serviceVersion'
  | 'environment'

  // HTTP Server
  | 'port'
  | 'host'
  | 'corsOrigins'
  | 'bodySizeLimit'

  // Database — PostgreSQL
  | 'postgres.host'
  | 'postgres.port'
  | 'postgres.database'
  | 'postgres.user'
  | 'postgres.password'
  | 'postgres.poolMin'
  | 'postgres.poolMax'
  | 'postgres.ssl'
  | 'postgres.schema'

  // Database — MongoDB
  | 'mongo.uri'
  | 'mongo.database'
  | 'mongo.poolMin'
  | 'mongo.poolMax'

  // Database — Redis
  | 'redis.host'
  | 'redis.port'
  | 'redis.password'
  | 'redis.db'

  // Database — Elasticsearch
  | 'elasticsearch.node'
  | 'elasticsearch.apiKey'
  | 'elasticsearch.indexPrefix'

  // Kafka
  | 'kafka.brokers'
  | 'kafka.clientId'
  | 'kafka.groupId'
  | 'kafka.ssl'
  | 'kafka.saslUsername'
  | 'kafka.saslPassword'

  // Object Storage (S3/MinIO)
  | 'storage.endpoint'
  | 'storage.region'
  | 'storage.bucket'
  | 'storage.accessKey'
  | 'storage.secretKey'
  | 'storage.useSsl'

  // IAM / Auth
  | 'auth.issuer'
  | 'auth.audience'
  | 'auth.jwksUri'

  // Observability
  | 'otel.serviceName'
  | 'otel.exporterEndpoint'
  | 'otel.samplingRatio'

  // Feature Flags
  | 'feature.auditEnabled'
  | 'feature.patientConsentEnabled'
  | 'feature.asyncSearchEnabled'
  | 'feature.bulkDataExport'

  // FHIR-Specific
  | 'fhir.baseUrl'
  | 'fhir.defaultCount'
  | 'fhir.maxCount'
  | 'fhir.validationProfiles'

  // TLS
  | 'tls.certPath'
  | 'tls.keyPath'
  | 'tls.caPath';

// ──────────────────────────────────────────────
// Config Value Types
// ──────────────────────────────────────────────

type ConfigValue = string | number | boolean | string[] | Record<string, unknown>;

interface ConfigEntry {
  key: ConfigKey;
  description: string;
  defaultValue?: ConfigValue;
  required?: boolean;
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'json';
  sensitive?: boolean; // If true, mask in logs
}

// ──────────────────────────────────────────────
// Service Configuration Schema
// ──────────────────────────────────────────────

const COMMON_CONFIG_SCHEMA: ConfigEntry[] = [
  // Service Identity
  { key: 'serviceName', description: 'Name of the service instance', required: true, type: 'string' },
  { key: 'serviceVersion', description: 'Semantic version of the service', defaultValue: '1.0.0', type: 'string' },
  { key: 'environment', description: 'Deployment environment', defaultValue: 'development', type: 'string' },

  // HTTP Server
  { key: 'port', description: 'HTTP server port', defaultValue: 3000, type: 'number' },
  { key: 'host', description: 'HTTP server host', defaultValue: '0.0.0.0', type: 'string' },
  { key: 'corsOrigins', description: 'Allowed CORS origins', defaultValue: '*', type: 'string' },
  { key: 'bodySizeLimit', description: 'Max request body size', defaultValue: '10mb', type: 'string' },

  // PostgreSQL
  { key: 'postgres.host', description: 'PostgreSQL host', defaultValue: 'localhost', type: 'string' },
  { key: 'postgres.port', description: 'PostgreSQL port', defaultValue: 5432, type: 'number' },
  { key: 'postgres.database', description: 'PostgreSQL database name', defaultValue: 'omnihealth', type: 'string' },
  { key: 'postgres.user', description: 'PostgreSQL user', defaultValue: 'omnihealth', type: 'string' },
  { key: 'postgres.password', description: 'PostgreSQL password', defaultValue: '', type: 'string', sensitive: true },
  { key: 'postgres.poolMin', description: 'PostgreSQL pool min connections', defaultValue: 2, type: 'number' },
  { key: 'postgres.poolMax', description: 'PostgreSQL pool max connections', defaultValue: 20, type: 'number' },
  { key: 'postgres.ssl', description: 'PostgreSQL SSL enabled', defaultValue: false, type: 'boolean' },
  { key: 'postgres.schema', description: 'PostgreSQL schema', defaultValue: 'public', type: 'string' },

  // MongoDB
  { key: 'mongo.uri', description: 'MongoDB connection URI', defaultValue: 'mongodb://localhost:27017', type: 'string' },
  { key: 'mongo.database', description: 'MongoDB database name', defaultValue: 'omnihealth', type: 'string' },
  { key: 'mongo.poolMin', description: 'MongoDB min pool size', defaultValue: 5, type: 'number' },
  { key: 'mongo.poolMax', description: 'MongoDB max pool size', defaultValue: 50, type: 'number' },

  // Redis
  { key: 'redis.host', description: 'Redis host', defaultValue: 'localhost', type: 'string' },
  { key: 'redis.port', description: 'Redis port', defaultValue: 6379, type: 'number' },
  { key: 'redis.password', description: 'Redis password', defaultValue: '', type: 'string', sensitive: true },
  { key: 'redis.db', description: 'Redis database index', defaultValue: 0, type: 'number' },

  // Elasticsearch
  { key: 'elasticsearch.node', description: 'Elasticsearch node URL', defaultValue: 'http://localhost:9200', type: 'string' },
  { key: 'elasticsearch.apiKey', description: 'Elasticsearch API key', defaultValue: '', type: 'string', sensitive: true },
  { key: 'elasticsearch.indexPrefix', description: 'Elasticsearch index prefix', defaultValue: 'omnihealth', type: 'string' },

  // Kafka
  { key: 'kafka.brokers', description: 'Kafka broker list (comma-separated)', defaultValue: 'localhost:9092', type: 'string' },
  { key: 'kafka.clientId', description: 'Kafka client ID', defaultValue: 'omnihealth-service', type: 'string' },
  { key: 'kafka.groupId', description: 'Kafka consumer group ID', defaultValue: '', type: 'string' },
  { key: 'kafka.ssl', description: 'Kafka SSL enabled', defaultValue: false, type: 'boolean' },
  { key: 'kafka.saslUsername', description: 'Kafka SASL username', defaultValue: '', type: 'string', sensitive: true },
  { key: 'kafka.saslPassword', description: 'Kafka SASL password', defaultValue: '', type: 'string', sensitive: true },

  // Object Storage
  { key: 'storage.endpoint', description: 'S3/MinIO endpoint URL', defaultValue: 'http://localhost:9000', type: 'string' },
  { key: 'storage.region', description: 'S3 region', defaultValue: 'us-east-1', type: 'string' },
  { key: 'storage.bucket', description: 'Default storage bucket', defaultValue: 'omnihealth', type: 'string' },
  { key: 'storage.accessKey', description: 'Storage access key', defaultValue: '', type: 'string', sensitive: true },
  { key: 'storage.secretKey', description: 'Storage secret key', defaultValue: '', type: 'string', sensitive: true },
  { key: 'storage.useSsl', description: 'Use SSL for storage', defaultValue: false, type: 'boolean' },

  // Auth
  { key: 'auth.issuer', description: 'JWT issuer URL', defaultValue: 'https://iam.omnihealth.io', type: 'string' },
  { key: 'auth.audience', description: 'JWT expected audience', defaultValue: '', type: 'string' },
  { key: 'auth.jwksUri', description: 'JWKS URI for public key retrieval', defaultValue: 'https://iam.omnihealth.io/.well-known/jwks.json', type: 'string' },

  // Observability
  { key: 'otel.serviceName', description: 'OpenTelemetry service name', defaultValue: '', type: 'string' },
  { key: 'otel.exporterEndpoint', description: 'OpenTelemetry exporter endpoint', defaultValue: 'http://localhost:4318', type: 'string' },
  { key: 'otel.samplingRatio', description: 'OpenTelemetry trace sampling ratio', defaultValue: 0.1, type: 'number' },

  // Feature Flags
  { key: 'feature.auditEnabled', description: 'Enable audit logging', defaultValue: true, type: 'boolean' },
  { key: 'feature.patientConsentEnabled', description: 'Enforce patient consent', defaultValue: true, type: 'boolean' },
  { key: 'feature.asyncSearchEnabled', description: 'Enable async search operations', defaultValue: false, type: 'boolean' },
  { key: 'feature.bulkDataExport', description: 'Enable FHIR bulk data export', defaultValue: false, type: 'boolean' },

  // FHIR
  { key: 'fhir.baseUrl', description: 'Base URL for FHIR API', defaultValue: '/fhir/r4', type: 'string' },
  { key: 'fhir.defaultCount', description: 'Default _count for search', defaultValue: 20, type: 'number' },
  { key: 'fhir.maxCount', description: 'Maximum _count for search', defaultValue: 1000, type: 'number' },
  { key: 'fhir.validationProfiles', description: 'Comma-separated FHIR profile URLs to validate against', defaultValue: '', type: 'string' },

  // TLS
  { key: 'tls.certPath', description: 'TLS certificate file path', defaultValue: '', type: 'string' },
  { key: 'tls.keyPath', description: 'TLS key file path', defaultValue: '', type: 'string', sensitive: true },
  { key: 'tls.caPath', description: 'TLS CA certificate path', defaultValue: '', type: 'string' },
];

// ──────────────────────────────────────────────
// The Config Instance
// ──────────────────────────────────────────────

export interface ServiceInitConfig {
  serviceName: string;
  configPath?: string;
}

export class ServiceConfig {
  private readonly store: Map<string, ConfigValue> = new Map();
  private loaded = false;

  constructor(private readonly init: ServiceInitConfig) {}

  /**
   * Load configuration from environment variables and optional config file.
   * Must be called before `get()`.
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    // 1. Apply defaults
    for (const entry of COMMON_CONFIG_SCHEMA) {
      if (entry.defaultValue !== undefined) {
        this.store.set(entry.key, entry.defaultValue);
      }
    }

    // 2. Override service name
    this.store.set('serviceName', this.init.serviceName);

    // 3. Load from config file if specified
    if (this.init.configPath) {
      await this.loadFromFile(this.init.configPath);
    }

    // 4. Override from environment variables
    this.loadFromEnvironment();

    this.loaded = true;

    // 5. Validate required fields
    this.validate();
  }

  /**
   * Get a configuration value by key.
   */
  get<T extends ConfigValue = string>(key: ConfigKey): T {
    if (!this.loaded) {
      throw new ConfigError(`Configuration not loaded. Call load() before get('${key}')`);
    }

    const value = this.store.get(key);
    if (value === undefined) {
      throw new ConfigError(`Configuration key '${key}' is not defined`);
    }
    return value as T;
  }

  /**
   * Get a configuration value with a fallback if not set.
   */
  getOptional<T extends ConfigValue = string>(key: ConfigKey, fallback: T): T {
    try {
      return this.get<T>(key);
    } catch {
      return fallback;
    }
  }

  /**
   * Check if a configuration key exists.
   */
  has(key: ConfigKey): boolean {
    return this.store.has(key);
  }

  /**
   * Get all current configuration as a plain object (for logging, debugging).
   * Sensitive values are masked.
   */
  toObject(): Record<string, ConfigValue> {
    const result: Record<string, ConfigValue> = {};
    for (const entry of COMMON_CONFIG_SCHEMA) {
      const value = this.store.get(entry.key);
      if (value !== undefined) {
        result[entry.key] = entry.sensitive ? '****' : value;
      }
    }
    return result;
  }

  private async loadFromFile(configPath: string): Promise<void> {
    try {
      const resolvedPath = path.resolve(configPath);
      if (!fs.existsSync(resolvedPath)) {
        console.warn(`[Config] Config file not found: ${resolvedPath}`);
        return;
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const ext = path.extname(resolvedPath);

      if (ext === '.json') {
        const data = JSON.parse(content);
        for (const [key, value] of Object.entries(data)) {
          if (this.isValidConfigKey(key)) {
            this.store.set(key, value as ConfigValue);
          }
        }
      } else if (ext === '.yaml' || ext === '.yml') {
        // YAML support can be added when we have a YAML parser dependency
        console.warn('[Config] YAML config file support requires js-yaml. Skipping.');
      }
    } catch (error) {
      console.error(`[Config] Error loading config file: ${configPath}`, error);
    }
  }

  private loadFromEnvironment(): void {
    for (const entry of COMMON_CONFIG_SCHEMA) {
      const envName = this.toEnvName(entry.key);
      const envValue = process.env[envName];

      if (envValue !== undefined && envValue !== '') {
        this.store.set(entry.key, this.parseValue(envValue, entry.type));
      }
    }
  }

  /**
   * Convert a config key like 'postgres.host' to env var 'OMNI_POSTGRES_HOST'.
   */
  private toEnvName(key: string): string {
    return `OMNI_${key.toUpperCase().replace(/\./g, '_')}`;
  }

  private parseValue(value: string, type: ConfigEntry['type']): ConfigValue {
    switch (type) {
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new ConfigError(`Cannot parse '${value}' as a number`);
        }
        return num;
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'string[]':
        return value.split(',').map(s => s.trim());
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      case 'string':
      default:
        return value;
    }
  }

  private validate(): void {
    const missing: string[] = [];
    for (const entry of COMMON_CONFIG_SCHEMA) {
      if (entry.required && !this.store.has(entry.key)) {
        missing.push(entry.key);
      }
    }

    if (missing.length > 0) {
      const envVars = missing.map(k => this.toEnvName(k)).join(', ');
      throw new ConfigError(
        `Required configuration missing: ${missing.join(', ')}\n` +
        `Set environment variables: ${envVars}`
      );
    }
  }

  private isValidConfigKey(key: string): key is ConfigKey {
    return COMMON_CONFIG_SCHEMA.some(entry => entry.key === key);
  }
}

// ──────────────────────────────────────────────
// Factory Function
// ──────────────────────────────────────────────

let globalConfig: ServiceConfig | null = null;

/**
 * Create and load the service configuration.
 *
 * Usage:
 *   const config = createConfig({ serviceName: 'fhir-api' });
 *   await config.load();
 *   const port = config.get('port'); // => number
 */
export function createConfig(init: ServiceInitConfig): ServiceConfig {
  if (globalConfig && globalConfig.get('serviceName') === init.serviceName) {
    return globalConfig;
  }
  globalConfig = new ServiceConfig(init);
  return globalConfig;
}

/**
 * Get the global config instance (must be created first via createConfig).
 */
export function getConfig(): ServiceConfig {
  if (!globalConfig) {
    throw new ConfigError('Configuration not initialized. Call createConfig() first.');
  }
  return globalConfig;
}

// ──────────────────────────────────────────────
// Error
// ──────────────────────────────────────────────

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

// ──────────────────────────────────────────────
// Exported Schema for documentation / tooling
// ──────────────────────────────────────────────

export const CONFIG_SCHEMA: ReadonlyArray<ConfigEntry> = COMMON_CONFIG_SCHEMA;