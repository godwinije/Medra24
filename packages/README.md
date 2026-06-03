# OmniHealth Shared Libraries (@omnihealth/*)

This monorepo workspace contains the foundational shared npm packages for the OmniHealth polyrepo architecture. Every service consumes these packages for consistent types, schemas, middleware, and utilities.

## Packages

| Package | Description | Consumers |
|---------|-------------|-----------|
| `@omnihealth/fhir-types` | TypeScript type definitions for FHIR R4 resources | All services |
| `@omnihealth/event-schemas` | Kafka event schemas & TypeScript types | All services |
| `@omnihealth/auth-middleware` | Express middleware for JWT validation, RBAC/ABAC | FHIR API, GraphQL, Admin, Patient Portal |
| `@omnihealth/audit-client` | Structured HIPAA-compliant audit log emission | All services |
| `@omnihealth/id-gen` | Deterministic + UUID ID generation | MPI, FHIR API, Ingestion |
| `@omnihealth/config` | Type-safe environment-aware configuration loader | All services |

## Development

### Prerequisites
- Node.js >= 22.0.0
- npm >= 10.0.0

### Setup

```bash
cd packages/
npm install          # Installs all workspace dependencies
npm run build        # Builds all packages
npm run typecheck    # TypeScript type-check all packages
npm test             # Run tests for all packages
npm run lint         # Lint all packages
```

### Publishing

Packages are published to GitHub Packages registry (`https://npm.pkg.github.com`). To publish:

```bash
# From the packages directory
npm publish --workspace packages/fhir-types
npm publish --workspace packages/event-schemas
# etc.
```

Services consume these as:
```json
{
  "dependencies": {
    "@omnihealth/fhir-types": "^1.0.0",
    "@omnihealth/auth-middleware": "^1.0.0"
  }
}
```

## Adding a New Package

1. Create a new directory under `packages/`
2. Add `package.json` with `name: "@omnihealth/<name>"`
3. Add `tsconfig.json` extending `../tsconfig.base.json`
4. Add entry to root `package.json` workspaces array
5. Run `npm install` to link the workspace

## Conventions

- **Exports**: All public APIs are exported from `src/index.ts`
- **Types**: Reuse `@omnihealth/fhir-types` for FHIR-related types
- **Audit**: All services must use `@omnihealth/audit-client` for PHI access logging
- **Auth**: All HTTP endpoints must use `@omnihealth/auth-middleware`
- **IDs**: Use `@omnihealth/id-gen` for all resource and correlation IDs
- **Config**: Use `@omnihealth/config` for all environment configuration
- **Testing**: Jest with TypeScript; test files co-located as `*.test.ts`