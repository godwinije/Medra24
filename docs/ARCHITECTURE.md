# OmniHealth — System Architecture & Service Decomposition

> **Status:** Draft v1  
> **Author:** Platform Architect  
> **Date:** 2025-05-26  
> **Version:** 1.0  

---

## Table of Contents

1. [Architecture Philosophy](#1-architecture-philosophy)
2. [Service Decomposition](#2-service-decomposition)
3. [Technology Stack](#3-technology-stack)
4. [Data Flow & Event Architecture](#4-data-flow--event-architecture)
5. [FHIR R4 Domain Mapping](#5-fhir-r4-domain-mapping)
6. [API Gateway Design](#6-api-gateway-design)
7. [Deployment Topology](#7-deployment-topology)
8. [Security & Compliance](#8-security--compliance)
9. [Monorepo vs Polyrepo Decision](#9-monorepo-vs-polyrepo-decision)
10. [Key Architecture Decisions (ADRs)](#10-key-architecture-decisions-adrs)

---

## 1. Architecture Philosophy

### Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Domain-driven microservices** | Each bounded context owns its data and logic independently |
| **Event-driven by default** | Async communication via message bus for scalability and auditability |
| **FHIR-native** | All clinical APIs expose FHIR R4 resources; internal storage may use FHIR or optimized schemas |
| **API-first** | All capabilities exposed via well-defined REST/GraphQL contracts |
| **Zero-trust security** | Every request authenticated, authorized, and audited — no trusted network zones |
| **Stateless services** | Horizontal scale-out; state persisted in databases/caches only |
| **Data sovereignty by design** | Multi-region deployment, tenant isolation, configurable data residency |

### Architectural Style

**Hexagonal (Ports & Adapters)** architecture per service:
- Core domain logic is framework-agnostic
- Adapters for HTTP, Kafka, database, FHIR serialization
- Enables testability and technology swap-out

---

## 2. Service Decomposition

```
                         ┌──────────────────────────────────────────────────────────────┐
                         │                       CLIENT TIER                           │
                         │  Hospital EMR  │  Gov Dashboard  │  Patient App  │  Research │
                         └────────┬──────────────┬──────────────┬──────────────┬────────┘
                                  │              │              │              │
                         ┌───────▼──────────────▼──────────────▼──────────────▼────────┐
                         │                    API GATEWAY (Kong)                       │
                         │  Auth │ Rate Limit │ Audit │ Routing │ TLS │ Transform      │
                         └───────┬──────────────┬──────────────┬───────────────────────┘
                                  │              │              │
          ┌───────────────────────┼──────────────┼──────────────┼───────────────────────┐
          │                       │              │              │                       │
          ▼                       ▼              ▼              ▼                       ▼
┌────────────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐
│  Identity & Access │  │  FHIR API    │  │  GraphQL    │  │  Admin     │  │  Patient Consent     │
│  Management (IAM)  │  │  Service     │  │  Gateway    │  │  Service   │  │  & Proxy Service     │
│  • OAuth2 / OIDC   │  │  • R4 CRUD   │  │  • Patient  │  │  • Config  │  │  • Consent records   │
│  • SAML 2.0        │  │  • Search    │  │    360 View │  │  • Audit   │  │  • Data sharing      │
│  • RBAC / ABAC     │  │  • Batch     │  │  • Pop.     │  │    Export  │  │  • Patient access    │
│  • MFA             │  │  • $everything│ │    Reports  │  │  • Tenant  │  │  • Revocation        │
└────────┬───────────┘  └──────┬───────┘  └──────┬──────┘  └────────────┘  └──────────────────────┘
         │                     │                  │                                              
         │           ┌─────────┴──────────┐      │                                              
         │           │                    │      │                                              
         ▼           ▼                    ▼      ▼                                              
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              EVENT BUS — Apache Kafka                                     │
│  Topics: patient.* | clinical.* | identity.* | audit.* | notification.*                    │
└────┬────────────────────┬────────────────────┬──────────────────┬──────────────────┬───────┘
     │                    │                    │                  │                  │
     ▼                    ▼                    ▼                  ▼                  ▼
┌──────────┐  ┌──────────────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Patient  │  │ Clinical Data    │  │ Document       │  │ Terminology  │  │ Population       │
│ Identity │  │ Service          │  │ Service        │  │ Service      │  │ Health Service   │
│ Mgmt     │  │ • Observations   │  │ • C-CDA        │  │ • ICD-10     │  │ • Epidemiology   │
│ (MPI)    │  │ • Conditions     │  │ • PDF          │  │ • LOINC      │  │ • Dashboards    │
│ • Linkage│  │ • Medications    │  │ • DICOM images │  │ • SNOMED-CT  │  │ • Alert engine  │
│ • Match  │  │ • Encounters     │  │ • FHIR DocRef  │  │ • RxNorm     │  │ • Risk stratify │
│ • Merge  │  │ • Procedures     │  │                 │  │ • Maps       │  │ • Report gen    │
└────┬─────┘  └──────────────────┘  └────────────────┘  └──────────────┘  └──────────────────┘
     │
     ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ Data Ingestion       │  │ Notification     │  │ Audit & Compliance   │
│ Pipeline             │  │ Service          │  │ Service              │
│ • HL7 v2 MLLP        │  │ • WebSocket      │  │ • HIPAA audit logs   │
│ • C-CDA import       │  │ • Email/SMS      │  │ • BAA enforcement    │
│ • FHIR Bulk Data     │  │ • In-app alerts  │  │ • Data lineage       │
│ • CSV/CSV transform  │  │ • Pub/sub hooks  │  │ • Retention policies │
└──────────────────────┘  └──────────────────┘  └──────────────────────┘
```

### Service Descriptions

#### 1. API Gateway (Kong Gateway)
- **Responsibility:** Single entry point, TLS termination, OAuth2 token validation, rate limiting, request/response transformation, routing to backend services, WAF
- **Endpoints:** `/fhir/` → FHIR API Service, `/graphql` → GraphQL Gateway, `/iam/` → IAM Service, `/admin/` → Admin Service, `/patient/` → Patient Portal

#### 2. Identity & Access Management (IAM)
- **Responsibility:** User authentication, SAML/OAuth2/OIDC federation, role-based access control (RBAC) + attribute-based (ABAC), MFA, session management
- **Stores:** PostgreSQL (users, roles, permissions), Redis (sessions, JWT refresh)
- **Federation:** Supports integration with hospital AD/LDAP, national eID, SAML 2.0 IdP

#### 3. FHIR API Service
- **Responsibility:** Primary clinical data API. Full FHIR R4 RESTful interface (read, search, create, update, patch, delete, $everything, $export)
- **Stores:** MongoDB (FHIR resource documents), PostgreSQL (search indexes)
- **Key FHIR Resources:** Patient, Observation, Condition, MedicationRequest, MedicationAdministration, Encounter, Procedure, AllergyIntolerance, Immunization, DiagnosticReport

#### 4. GraphQL Gateway
- **Responsibility:** Aggregation layer for complex queries spanning multiple FHIR resources. Powers the "Patient 360" view and population health dashboards
- **Data Source:** FHIR API Service + Clinical Data Service + Document Service
- **Use Cases:** Patient timeline view, cross-facility encounter history, cohort queries

#### 5. Patient Identity Management (Master Patient Index — MPI)
- **Responsibility:** Record linkage across facilities, probabilistic and deterministic matching, merge/unmerge, golden-record creation
- **Algorithm:** Combination of deterministic (exact SSN, national ID) and probabilistic (name, DOB, address, phone using Fellegi-Sunter model)
- **Stores:** PostgreSQL (identity graph, match scores), Redis (matching work queue)
- **Output:** OmniHealth Patient ID (UUID) mapped to facility-specific MRNs

#### 6. Clinical Data Service
- **Responsibility:** Core clinical storage. Might store in FHIR-native MongoDB or optimized relational schemas depending on resource type
- **Stores:** MongoDB (documents), PostgreSQL (search + structured data), TimescaleDB (time-series vitals/labs)

#### 7. Document Service
- **Responsibility:** Clinical document storage (C-CDA, PDF, DICOM metadata). Full-text search via Elasticsearch
- **Stores:** Object storage (S3-compatible) + MongoDB (metadata) + Elasticsearch (full-text)

#### 8. Terminology Service
- **Responsibility:** Code system management, value set expansion, concept mapping (ICD-10 ↔ SNOMED-CT), terminology validation
- **Stores:** PostgreSQL (code system tables with nested intervals)
- **Standards:** FHIR Terminology $expand, $validate-code, $lookup operations

#### 9. Population Health Service
- **Responsibility:** Epidemiological dashboards, real-time syndromic surveillance, risk stratification, cohort identification
- **Stores:** PostgreSQL (aggregated data), Elasticsearch (analytics), TimescaleDB (time-series)
- **Trigger:** Public health alerts for notifiable conditions, outbreak detection

#### 10. Data Ingestion Pipeline
- **Responsibility:** Ingest HL7 v2 (MLLP), C-CDA, FHIR bundles from facilities. Transform to FHIR R4. Validate, enrich, publish to Kafka
- **Components:** HL7 v2 parser → Normalizer → FHIR translator → Validator → Kafka producer
- **Stores:** Kafka (raw + normalized topics), Object storage (archived raw messages)

#### 11. Patient Consent & Proxy Service
- **Responsibility:** Patient consent directives (opt-in/opt-out for data sharing), proxy access (family, caregivers), data sharing agreements
- **Stores:** PostgreSQL (consent records — FHIR Consent resource)

#### 12. Audit & Compliance Service
- **Responsibility:** Capture every access to PHI, support HIPAA audit requests, enforce data retention, BAA management
- **Stores:** Immutable audit log (Kafka + Object storage archive), PostgreSQL (queryable recent audit)

#### 13. Notification Service
- **Responsibility:** Real-time alerts via WebSocket (provider dashboards), email/SMS (critical results), webhook callbacks (for integrations)
- **Stores:** Redis (pub/sub for WebSocket connections)

---

## 3. Technology Stack

### Core Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js 22 LTS (TypeScript 5.x) | Team expertise; excellent async I/O for event-driven services |
| **API Gateway** | Kong Gateway (OSS) | Mature, plugin ecosystem, Lua/Go plugin support, HIPAA compliance programs |
| **Primary Database** | PostgreSQL 16 + PostGIS + pg_partman | ACID compliance, JSONB for FHIR flexibility, partitioning for scale, extensions for geospatial |
| **FHIR Document Store** | MongoDB 7.0 | Schema-less for polymorphic FHIR resources; native JSON operations; sharding |
| **Search & Analytics** | Elasticsearch 8.x + Kibana | Full-text search across clinical records; population health dashboards |
| **Time-Series** | TimescaleDB (PostgreSQL extension) | Vitals, lab results, IoT device streams — native time-series compression and continuous aggregates |
| **Message Queue** | Apache Kafka 3.7 + KRaft | Event sourcing, audit trail, stream processing, replay capability, high throughput |
| **Stream Processing** | Kafka Streams / ksqlDB | Real-time syndromic surveillance, alerting, data enrichment pipeline |
| **Cache / Session** | Redis 7 (cluster mode) | Session store, rate limit counters, MPI work queue, WebSocket pub/sub |
| **Object Storage** | MinIO (S3-compatible) | Clinical documents, DICOM, archived audit logs, bulk export payloads |
| **Service Discovery** | Kubernetes (CoreDNS) + Consul | Native K8s DNS for most services; Consul for advanced health checking |
| **Container Runtime** | Docker + Kubernetes | Standardized deployment, auto-scaling, rolling updates, canary deployments |
| **Observability** | OpenTelemetry → Prometheus + Grafana + Loki | Metrics, traces, logs unified; HIPAA-compliant logging |

### FHIR-Specific Tooling

| Tool | Purpose |
|------|---------|
| **FHIR Validator** (HL7 published) | Validate resources against FHIR R4 profiles |
| **HAPI FHIR (Java)** or **FHIR KIT** | Reference implementation; consider for custom FHIR validation server |
| **SUSHI** | FHIR IG (Implementation Guide) authoring |
| **FHIR Converter** (Microsoft) | HL7 v2 → FHIR translation |
| **CDA → FHIR** (Lantana) | C-CDA → FHIR document transformation |
| **CQL Engine** | Clinical Quality Language for decision support and population measures |

---

## 4. Data Flow & Event Architecture

### 4.1 Data Ingestion Flow (Facility → Platform)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Hospital     │     │  Ingestion   │     │  Translation │     │  Validation  │
│  EMR / ADT    │────▶│  Adapter     │────▶│  Pipeline    │────▶│  & Enrich    │
│  (HL7 v2 /    │     │  (MLLP/HTTP) │     │  (HL7→FHIR) │     │  (Profiles)  │
│   C-CDA /     │     │              │     │              │     │              │
│   FHIR API)   │     └──────────────┘     └──────────────┘     └──────┬───────┘
└──────────────┘                                                       │
                                                                       ▼
                                                             ┌──────────────────┐
                                                             │  Kafka Topic     │
                                                             │  clinical.raw    │
                                                             └────────┬─────────┘
                                                                      │
                                                                      ▼
                                                             ┌──────────────────┐
                                                             │  Stream Processor│
                                                             │  • Identity res. │
                                                             │  • Code mapping  │
                                                             │  • Enrichment    │
                                                             └────────┬─────────┘
                                                                      │
                              ┌───────────────────────────────────────┼───────────────────────┐
                              │                                       │                       │
                              ▼                                       ▼                       ▼
               ┌──────────────────────┐                  ┌────────────────────┐  ┌──────────────────┐
               │  Kafka Topic         │                  │  Kafka Topic       │  │  Kafka Topic     │
               │  clinical.enriched   │                  │  identity.matched  │  │  audit.events    │
               │  (FHIR Resources)    │                  │  (Linkage events)  │  │  (Access log)    │
               └──────────┬───────────┘                  └────────────────────┘  └──────────────────┘
                          │
                          ▼
               ┌──────────────────────┐
               │  Persistence Worker  │
               │  • MongoDB (FHIR)    │
               │  • PostgreSQL (idx)  │
               │  • Elasticsearch     │
               └──────────────────────┘
```

### 4.2 Patient Query Flow (Provider 360° View)

```
Provider App ──▶ Kong Gateway ──▶ IAM (JWT validation)
                                      │
                                      ▼
                              GraphQL Gateway
                                      │
                          ┌───────────┼───────────┐
                          │           │           │
                          ▼           ▼           ▼
                   FHIR API     Clinical      Document
                   Service      Service       Service
                   (Patient,    (Obs/Cond/    (DocRef,
                    Encounter)   Meds)          CDA)
                          │           │           │
                          └───────────┼───────────┘
                                      │
                                      ▼
                              Unified Response
                              (Patient 360°)
```

### 4.3 Event Topics (Kafka)

| Topic | Content | Producers | Consumers |
|-------|---------|-----------|-----------|
| `clinical.raw.{facility_id}` | Raw ingested messages (HL7, C-CDA, FHIR) | Ingestion Adapters | Stream Processor, Archive |
| `clinical.enriched` | Validated FHIR R4 resources | Stream Processor | Persistence Worker, Population Health, Elasticsearch Indexer |
| `identity.patient.matched` | Patient linkage events (match, merge, unmerge) | MPI Service | FHIR API (update Patient.link), Notification, Audit |
| `identity.patient.created` | New patient golden records | MPI Service | Population Health, Cache warmer |
| `audit.access` | PHI access events | API Gateway, all services | Audit & Compliance Service, SIEM |
| `audit.admin` | Configuration changes | Admin Service | Audit & Compliance Service |
| `clinical.alert` | Clinical decision support alerts | Population Health, Rule Engine | Notification Service |
| `notification.send` | Messages to send (email/SMS/push) | Any service | Notification Service |
| `consent.changed` | Patient consent updates | Consent Service | FHIR API (filter results), MPI (block linkage) |

---

## 5. FHIR R4 Domain Mapping

### 5.1 Core FHIR Resources to Service Map

| FHIR R4 Resource | Primary Service | Secondary Service | Data Store |
|------------------|----------------|-------------------|-----------|
| **Patient** | FHIR API Service | MPI (for $everything, link mgmt) | MongoDB + PostgreSQL |
| **Practitioner** | IAM Service | FHIR API (read-only) | PostgreSQL |
| **Organization** | IAM Service | FHIR API (read-only) | PostgreSQL |
| **Encounter** | Clinical Data Service | Population Health | MongoDB + TimescaleDB |
| **Observation** | Clinical Data Service | Population Health | MongoDB + TimescaleDB |
| **Condition** | Clinical Data Service | Population Health | MongoDB + PostgreSQL |
| **MedicationRequest** | Clinical Data Service | — | MongoDB + PostgreSQL |
| **MedicationAdministration** | Clinical Data Service | — | MongoDB |
| **Procedure** | Clinical Data Service | — | MongoDB |
| **AllergyIntolerance** | Clinical Data Service | — | MongoDB |
| **Immunization** | Clinical Data Service | Population Health | MongoDB + TimescaleDB |
| **DiagnosticReport** | Clinical Data Service | — | MongoDB + Object Store |
| **DocumentReference** | Document Service | Clinical Data (associated encounters) | MongoDB + Object Store + Elasticsearch |
| **Consent** | Consent Service | FHIR API (query filter) | PostgreSQL |
| **Provenance** | Audit & Compliance Service | All services (write) | Kafka → PostgreSQL (recent) → Object Store (archive) |
| **Bundle** | Data Ingestion Pipeline | FHIR API ($everything, $export) | MongoDB |

### 5.2 FHIR Search Parameter Strategy

- **Standard FHIR search** via MongoDB indexes on common query paths
- **Custom search params** for national-specific identifiers (e.g., national ID, facility MRN)
- **Elasticsearch** for unstructured text search (clinical notes, radiology reports)
- **PostgreSQL JSONB indexes** for complex combined queries (age + condition + medication)
- **Reverse index** for cohort queries across patients sharing specific characteristics

### 5.3 Resource Identification Strategy

| Concept | Approach |
|---------|----------|
| **OmniHealth Patient ID** | UUID v4 (immutable, globally unique) |
| **Facility MRN mapping** | `Patient.identifier` with system `urn:oid:{facility-oid}` |
| **National ID** | `Patient.identifier` with system `urn:oid:2.16.840.1.113883.3.{country-nat-id}` |
| **Cross-facility dedup** | MPI golden record; `Patient.link` with `type` = `seealso` or `replaces` |
| **Resource logical ID** | UUID v4 per resource instance |

---

## 6. API Gateway Design

### 6.1 Routes & Upstream Mapping

| Route | Upstream Service | Auth Required | Rate Limit | Notes |
|-------|-----------------|---------------|------------|-------|
| `GET /fhir/r4/` | FHIR API Service | JWT (Bearer) | 1000/min | FHIR conformance statement |
| `GET/POST /fhir/r4/{resource}` | FHIR API Service | JWT | 1000/min | Standard CRUD |
| `GET /fhir/r4/Patient/{id}/$everything` | FHIR API → MPI | JWT + ABAC | 100/min | Heavy query; cacheable |
| `POST /fhir/r4/{resource}/$export` | FHIR API Service | JWT + admin | 10/min | Bulk data export |
| `POST /graphql` | GraphQL Gateway | JWT + scope | 100/min | Patient 360 queries |
| `POST /iam/auth/token` | IAM Service | Client Creds | 1000/min | Token endpoint |
| `POST /iam/auth/authorize` | IAM Service | Session | 100/min | Authorization code flow |
| `GET /patient/portal/...` | Consent Service → FHIR | JWT (patient) | 100/min | Patient-facing |
| `POST /admin/...` | Admin Service | JWT + admin RBAC | 50/min | System configuration |
| `POST /ingest/{facility_id}/...` | Ingestion Adapter | Client TLS + API key | 5000/min | High throughput |

### 6.2 API Gateway Plugins (Kong)

| Plugin | Purpose | Enforcement Point |
|--------|---------|-------------------|
| **JWT / OIDC** | Token validation & introspection | Before routing |
| **Rate Limiting** | Per-client, per-route throttling | Before routing |
| **ACL / RBAC** | Route-level authorization | After auth |
| **Request Transformer** | Add audit headers, normalize FHIR version | Request pipeline |
| **Response Transformer** | Strip sensitive headers | Response pipeline |
| **CORS** | Browser-based app access | Global |
| **Prometheus** | Metrics export | Global |
| **IP Restriction** | Facility-level allowlisting for ingestion | Ingestion routes only |
| **Correlation ID** | Inject `X-Correlation-ID` for tracing | Global |
| **Body size limit** | Prevent oversized payloads | Write routes |

### 6.3 Authentication Flows

```
Machine-to-Machine (Facility EMR → Platform)
  Client Credentials Grant (OAuth2)
  → Client sends client_id + client_secret + scope
  → IAM returns JWT (short-lived, ~15min) + refresh token
  → API Gateway validates JWT on every request

Provider User (Web Dashboard)
  Authorization Code Grant (OIDC)
  → User redirected to IAM login page
  → IAM authenticates (SAML to hospital IdP, or national eID)
  → Authorization code returned → exchanged for tokens
  → API Gateway validates ID token, access token

Patient (Mobile App)
  Authorization Code Grant + PKCE (OIDC)
  → Same flow as providers but with PKCE for public clients
  → Scoped to `patient/*.read` only

Background Service (Analytics, Reports)
  Client Credentials + JWT assertion
  → Cert-based client auth for trusted services
```

---

## 7. Deployment Topology

### 7.1 Environment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KUBERNETES CLUSTER                                 │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Ingress    │  │  Ingress    │  │  Ingress    │  │  Ingress    │       │
│  │  Controller │  │  Controller │  │  Controller │  │  Controller │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │               │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐      │
│  │  Kong GW    │  │  Kong GW    │  │  Kong GW    │  │  Kong GW    │      │
│  │  (HA)       │  │  (HA)       │  │  (HA)       │  │  (HA)       │      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │
│         │                │                │                │               │
│  ┌──────┴──────────────────────────────────────────────────┴──────┐      │
│  │                      SERVICE MESH (Istio/Linkerd)              │      │
│  │                  Mutual TLS between all services                │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│         │                │                │                │               │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐      │
│  │  FHIR API   │  │  GraphQL    │  │  MPI        │  │  Clinical   │      │
│  │  (3-5 pods) │  │  (2-3 pods) │  │  (2-3 pods) │  │  (3-5 pods) │      │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
│         │                │                │                │               │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐      │
│  │ IAM Service │  │  Terminology│  │  Population │  │  Consent    │      │
│  │ (2-3 pods)  │  │  (2 pods)   │  │  Health     │  │  (2 pods)   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌─────────────────────┐         ┌─────────────────────────┐
        │   DATA PLANE        │         │    DATA PLANE           │
        │   (Region A)        │         │    (Region B - DR)      │
        │                     │         │                         │
        │  PostgreSQL (Pri)   │         │  PostgreSQL (Replica)   │
        │  MongoDB (Primary)  │         │  MongoDB (Secondary)    │
        │  Kafka (Brokers)    │         │  Kafka (Brokers)        │
        │  Redis (Cluster)    │         │  Redis (Cluster)        │
        │  MinIO (S3)         │         │  MinIO (S3 - repl)      │
        │  Elasticsearch      │         │  Elasticsearch          │
        └─────────────────────┘         └─────────────────────────┘
```

### 7.2 Deployment Strategy

| Aspect | Approach |
|--------|----------|
| **Orchestration** | Kubernetes (EKS/AKS/GKE or on-prem) |
| **Service Mesh** | Istio for mTLS, traffic splitting, observability |
| **CI/CD** | GitOps via ArgoCD (Flux alternative) |
| **Container Registry** | Harbor (private, signed images) |
| **Secrets Management** | HashiCorp Vault + External Secrets Operator |
| **Kuberntes Namespaces** | Per-service or per-domain (`fhir`, `ingestion`, `analytics`, `identity`) |
| **Resource Limits** | CPU/Memory requests and limits per service (see resource table below) |
| **HPA** | Horizontal Pod Autoscaler based on CPU/memory + custom Kafka lag metric |
| **PDBs** | Pod Disruption Budgets for HA services (min 2 available) |
| **Network Policy** | Deny-all ingress by default; explicit allow rules per namespace |

### 7.3 Resource Allocation

| Service | CPU Request | Memory Request | Replicas (min-max) | Storage |
|---------|------------|---------------|-------------------|---------|
| Kong API Gateway | 500m | 512Mi | 2-8 | — |
| FHIR API Service | 1 CPU | 2Gi | 3-10 | — |
| GraphQL Gateway | 500m | 1Gi | 2-5 | — |
| IAM Service | 500m | 1Gi | 2-5 | — |
| MPI Service | 1 CPU | 2Gi | 2-5 | — |
| Clinical Data Service | 1 CPU | 2Gi | 3-8 | — |
| Data Ingestion Pipeline | 1 CPU | 2Gi | 2-8 | — |
| Population Health | 1 CPU | 4Gi | 2-5 | — |
| Terminology Service | 500m | 1Gi | 2-3 | — |
| Consent Service | 500m | 512Mi | 2-3 | — |
| Audit Service | 500m | 1Gi | 2-3 | — |
| Kafka Broker | 2 CPU | 4Gi | 3-7 | 500Gi SSD each |
| PostgreSQL | 4 CPU | 16Gi | 1 primary + 2 replicas | 1TB SSD |
| MongoDB | 4 CPU | 16Gi | 3 (replica set) | 2TB SSD |
| Elasticsearch | 2 CPU | 8Gi | 3 data + 2 master | 1TB SSD |
| Redis | 1 CPU | 4Gi | 3 (cluster) | 100Gi |

---

## 8. Security & Compliance

### 8.1 HIPAA Compliance Mechanisms

| Requirement | Implementation |
|------------|---------------|
| **Access Control** | OAuth2 + RBAC/ABAC; per-resource scopes; break-glass emergency access |
| **Audit Controls** | Every PHI access logged with timestamp, user, resource, action, reason |
| **Integrity Controls** | Resource versioning (FHIR `versionId`); immutable audit trail in Kafka |
| **Transmission Security** | TLS 1.3 for all external/internal traffic; mTLS between services |
| **Authentication** | MFA for all provider users; client certificates for facility EMR connections |
| **Encryption at Rest** | AES-256 for all data stores; envelope encryption via Vault |
| **Backup/DR** | Cross-region PITR for PostgreSQL; MongoDB oplog replay; Kafka mirroring |
| **Data Retention** | Configurable per data class; automated purge after retention period |
| **BAA Management** | Automated BAA lifecycle tracking per connected facility |

### 8.2 Data Sovereignty

- **Multi-region deployment**: Each region stores data for its jurisdiction
- **Tenant isolation**: Database schema-per-tenant or collection-per-tenant for facility isolation
- **Consent enforcement**: All queries filtered through Consent Service before returning PHI
- **Export controls**: Bulk data export requires dual authorization + audit

### 8.3 Network Security

```
[Internet] ──▶ WAF (Cloudflare/AWS WAF) ──▶ Kong Gateway
                                                  │
                                          ┌───────┴────────┐
                                          │  DMZ / Public   │
                                          │  Subnet         │
                                          └────────────────┘
                                                  │
                                          ┌───────┴────────┐
                                          │  Private Subnet  │
                                          │  (App Services)  │
                                          └────────────────┘
                                                  │
                                          ┌───────┴────────┐
                                          │  Data Subnet    │
                                          │  (DBs, Kafka)   │
                                          └────────────────┘
```

---

## 9. Monorepo vs Polyrepo Decision

**Decision: POLYREPO with shared library packages.**

| Criterion | Monorepo | Polyrepo | Our Choice |
|-----------|----------|----------|------------|
| **Code sharing** | Easy (same repo) | Via packages | ✅ Polyrepo + shared libraries via npm/pkg |
| **Independent deployment** | Complex (bazel/nx/turborepo needed) | Natural | ✅ Polyrepo — each service deploys independently |
| **Atomic changes** | Easy | Hard (cross-repo changes) | ❌ Trade-off accepted |
| **CI/CD complexity** | Single pipeline, but complex caching | Multiple pipelines, simpler per-service | ✅ Polyrepo — simpler per-service CI/CD |
| **Developer onboarding** | One checkout, steep learning curve | Multiple checkouts, shallower per-service | ✅ Polyrepo |
| **Cross-service refactoring** | Easy | Painful | ⚠️ Mitigation: API contracts in shared RFC repo |
| **Governance** | Uniform tooling | Divergent possible | ✅ Shared templates and lint rules across repos |
| **National-scale deployment** | Becomes unwieldy | Scales naturally | ✅ Polyrepo better for national scale |

### Shared Packages (private npm/pkg registry)

| Package | Content | Consumers |
|---------|---------|-----------|
| `@omnihealth/fhir-types` | TypeScript types for all FHIR R4 resources used | All services |
| `@omnihealth/fhir-validators` | Resource validation against national profiles | FHIR API, Ingestion |
| `@omnihealth/event-schemas` | Avro/Protobuf schemas for Kafka topics | All event producers/consumers |
| `@omnihealth/id-gen` | Deterministic ID generation for resources | MPI, FHIR API |
| `@omnihealth/auth-middleware` | JWT validation, scope check, RBAC | All HTTP services |
| `@omnihealth/audit-client` | Structured audit log emission | All services |
| `@omnihealth/config` | Shared configuration loading | All services |
| `@omnihealth/test-utils` | Test fixtures, mocks, helpers | All services |

---

## 10. Key Architecture Decisions (ADRs)

### ADR-001: Message Queue — Apache Kafka over RabbitMQ

**Status:** Accepted  
**Context:** Need async communication between services, event sourcing, audit trail, stream processing for population health  
**Decision:** Apache Kafka  
**Rationale:**
- Kafka's log-based architecture provides built-in replayability — critical for audit compliance and data recovery
- Higher throughput (millions of messages/sec) needed for nation-wide clinical data ingestion
- Kafka Streams/ksqlDB enables real-time syndromic surveillance without separate stream processor
- Longer message retention (weeks/months) vs RabbitMQ (hours/days)
- Partition-based parallelism matches facility-level data isolation requirements
- **Trade-off:** Higher operational complexity; need dedicated Kafka team; RabbitMQ easier to operate

### ADR-002: Primary Clinical Store — MongoDB + PostgreSQL (Dual-Write)

**Status:** Accepted  
**Context:** FHIR R4 resources are polymorphic (Observation has 50+ optional fields), but we also need complex relational queries across resources  
**Decision:** Dual-write to MongoDB (FHIR-native document store) + PostgreSQL (search indexes + structured data)  
**Rationale:**
- MongoDB handles FHIR's flexible schema naturally — no need for 200+ SQL tables
- PostgreSQL provides ACID-guaranteed structured queries, JOINs across resource types, materialized views for population health
- Synchronous write to both stores (transactional outbox pattern via Kafka for eventual consistency)
- **Trade-off:** Higher write latency; data consistency complexity; operational overhead of two DB systems

### ADR-003: Polyrepo Architecture

**Status:** Accepted  
**Context:** Multiple teams working on independent deployable services at national scale  
**Decision:** Polyrepo with shared npm packages  
**Rationale:**
- Independent CI/CD per service — critical for national health system uptime
- No single-point-of-failure in build pipeline
- Teams own their repos end-to-end
- API-first contract enforcement via OpenAPI specs in a shared contracts repo  
- **Trade-off:** Cross-service refactoring harder; mitigated by well-versioned APIs and contract testing

### ADR-004: Kong API Gateway

**Status:** Accepted  
**Context:** Need a single entry point with authentication, rate limiting, routing, and plugin extensibility  
**Decision:** Kong Gateway (OSS)  
**Rationale:**
- Mature, HIPAA-compliant in healthcare deployments
- Lua/Go plugin architecture for custom auth, transformation, and audit logic
- Native OIDC/OAuth2 support via openid-connect plugin
- Can run on Kubernetes (Kong Ingress Controller)
- Community and enterprise support available

### ADR-005: Patient Identity — Probabilistic + Deterministic MPI

**Status:** Accepted  
**Context:** Patients seen at multiple facilities with different MRNs, inconsistent demographics  
**Decision:** Hybrid approach with deterministic rules first, then Fellegi-Sunter probabilistic scoring  
**Rationale:**
- Deterministic (exact match on national ID, SSN) → high precision, low recall
- Probabilistic (name, DOB, address similarity) → high recall for unmatched records
- Human-in-the-loop for uncertain matches (score in gray zone)
- Batch processing with near-real-time linkage for new admissions

### ADR-006: Patient Portal — FHIR Proxy Pattern

**Status:** Accepted  
**Context:** Patients need access to their data across all facilities, but each facility controls their own source system  
**Decision:** Consent & Proxy Service sits between patient-facing API and FHIR services, enforcing consent directives  
**Rationale:**
- Patients don't query facilities directly — they query OmniHealth's unified view
- Consent service filters results based on patient's sharing preferences (Consent FHIR resource)
- Proxy pattern enables revocation without touching source systems
- Supports granular sharing (e.g., share labs but not mental health notes)

---

## Appendix A: Service Dependencies

```
Service              Depends On                          Consumes Kafka Topics
───────              ──────────                          ─────────────────────
API Gateway          IAM (token validation)              — (proxies, doesn't consume)
IAM Service          PostgreSQL, Redis                   — (auth events produced)
FHIR API Service     IAM, MPI, MongoDB, PostgreSQL       clinical.enriched, identity.*
GraphQL Gateway      FHIR API, Clinical, Document        — (REST calls, not Kafka)
MPI Service          PostgreSQL, Redis                   clinical.enriched (for linkage)
Clinical Data        MongoDB, PostgreSQL, TimescaleDB    clinical.enriched
Document Service     MongoDB, Object Store, ES           clinical.enriched
Terminology Service  PostgreSQL                           — (code systems loaded on deploy)
Population Health    PostgreSQL, ES, TimescaleDB          clinical.enriched, clinical.alert
Data Ingestion       Kafka (clinical.raw producers)      — (writes clinical.raw)
Consent Service      PostgreSQL                           consent.changed
Audit & Compliance   PostgreSQL, Kafka (archive)         audit.*
Notification         Redis (pub/sub), SMTP gateway       notification.send
```

## Appendix B: Port Mapping & Service Discovery

| Service | Internal Port | gRPC Port | K8s Service Name |
|---------|--------------|-----------|-----------------|
| Kong Gateway | 8000 (HTTP), 8443 (HTTPS) | — | `api-gateway.omnihealth.svc` |
| FHIR API Service | 3000 | 50051 | `fhir-api.omnihealth.svc` |
| GraphQL Gateway | 4000 | — | `graphql.omnihealth.svc` |
| IAM Service | 3001 | 50052 | `iam.omnihealth.svc` |
| MPI Service | 3002 | 50053 | `mpi.omnihealth.svc` |
| Clinical Data Service | 3003 | 50054 | `clinical-data.omnihealth.svc` |
| Document Service | 3004 | — | `documents.omnihealth.svc` |
| Terminology Service | 3005 | 50055 | `terminology.omnihealth.svc` |
| Population Health | 3006 | 50056 | `pop-health.omnihealth.svc` |
| Data Ingestion | 3007 | — | `ingestion.omnihealth.svc` |
| Consent Service | 3008 | — | `consent.omnihealth.svc` |
| Audit Service | 3009 | 50057 | `audit.omnihealth.svc` |
| Notification Service | 3010 | — | `notifications.omnihealth.svc` |
| Kafka Bootstrap | 9092 | — | `kafka.omnihealth.svc` |
| PostgreSQL | 5432 | — | `postgres.omnihealth.svc` |
| MongoDB | 27017 | — | `mongo.omnihealth.svc` |
| Redis | 6379 | — | `redis.omnihealth.svc` |
| Elasticsearch | 9200 | — | `elasticsearch.omnihealth.svc` |