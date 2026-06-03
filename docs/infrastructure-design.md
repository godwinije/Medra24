# Infrastructure & Deployment Strategy — OmniHealth

## 1. Overview
This document outlines the infrastructure requirements and deployment strategy for OmniHealth, a nation-wide unified medical information system. The strategy is designed to ensure HIPAA compliance, data sovereignty, high availability, and scalability.

## 2. Cloud Infrastructure & Platform
OmniHealth will be deployed on a managed Kubernetes platform (EKS, AKS, GKE) or on-premises Kubernetes, depending on regional requirements.

### 2.1 Multi-Region Deployment
*   **Regional Data Planes:** To support data sovereignty, independent data planes (PostgreSQL, MongoDB, Kafka, MinIO) will be deployed in each jurisdiction/region.
*   **High Availability (HA):** All components (Gateway, API services, Databases, Message Bus) must be deployed in an HA configuration across multiple Availability Zones (AZs).
*   **Disaster Recovery (DR):** Cross-region replication for critical databases and object storage.

### 2.2 Service Mesh
*   **Istio:** Used for service-to-service communication.
    *   **mTLS:** Mandatory mutual TLS between all services to enforce zero-trust.
    *   **Traffic Management:** Canary deployments, circuit breaking, and request retries.
    *   **Observability:** Automated distributed tracing and metrics collection.

### 2.3 Disaster Recovery & Resilience
*   **Backup Strategy:** Automated daily snapshots of all persistent volumes (PostgreSQL, MongoDB).
*   **RPO (Recovery Point Objective):** 15 minutes (via WAL archiving for Postgres and Oplog tailing for Mongo).
*   **RTO (Recovery Time Objective):** 4 hours for full regional failover.
*   **Multi-Region Failover:** Use of Global Load Balancer (e.g., AWS Global Accelerator) to route traffic to healthy regions.

## 3. CI/CD Pipeline
A polyrepo approach is adopted to allow independent service life-cycles.

### 3.1 Workflow
1.  **Code Commit:** Developers push to service-specific Git repositories.
2.  **Continuous Integration (CI) via GitHub Actions:**
    *   Linting, Unit Tests, Integration Tests.
    *   Security Scanning (SCA via Snyk, SAST via SonarQube).
    *   Container vulnerability scanning using **Trivy**.
    *   Docker image build and push to **Harbor** (private, signed registry).
3.  **Continuous Delivery (CD) via GitOps:**
    *   **ArgoCD:** Monitors a dedicated `gitops` repository containing Kubernetes manifests (Helm charts or Kustomize).
    *   Automated sync to staging/production environments.
    *   Supports **Canary** and **Rolling** update strategies.

### 3.2 Shared Libraries
*   Shared components (FHIR types, auth middleware, audit client) are distributed as private npm/pkg packages to maintain consistency across services.

### 3.3 Environment Strategy
*   **Sandbox/Dev:** Feature branch deployments, ephemeral environments.
*   **Staging:** Mirror of production for UAT and performance testing.
*   **Production:** Regional clusters with strict access control and audit.
*   **Promotion:** Automated via GitOps tag updates after successful test completion in lower environments.

## 4. Containerization Strategy
*   **Container Runtime:** Docker.
*   **Isolation:** Kubernetes namespaces are used to isolate functional domains (`fhir`, `ingestion`, `identity`, `analytics`).
*   **Resource Management:**
    *   Strict CPU/Memory requests and limits for every pod.
    *   **Horizontal Pod Autoscaler (HPA):** Auto-scaling based on CPU/Memory and custom metrics (e.g., Kafka consumer lag).
*   **Pod Disruption Budgets (PDB):** Ensure minimum availability during node maintenance.

## 5. Monitoring & Observability
A unified observability stack based on **OpenTelemetry**.

*   **Metrics:** Prometheus for scraping and storage; Grafana for dashboards.
*   **Logging:** Loki for log aggregation. Logs must be HIPAA-compliant (masking PHI, immutable storage).
*   **Tracing:** Tempo or Jaeger for distributed tracing across microservices.
*   **Alerting:** Alertmanager for critical infrastructure and application alerts (e.g., high error rates, latency spikes).

## 6. Security Hardening
### 6.1 Network Security
*   **Kong API Gateway:** The single entry point for all external traffic. Handles WAF, OAuth2/OIDC validation, and rate limiting.
*   **Network Policies:** Default "deny-all" ingress/egress. Explicit allow rules only for required service-to-service and service-to-database communication.

### 6.2 Secrets Management
*   **HashiCorp Vault:** Centralized management of secrets (DB credentials, API keys, certificates).
*   **External Secrets Operator:** Injects Vault secrets into Kubernetes Secret objects securely.

### 6.3 Encryption
*   **In-Transit:** TLS 1.3 for all external traffic; mTLS for all internal traffic.
*   **At-Rest:** AES-256 encryption for all persistent volumes and object storage.

### 6.4 Identity & Access
*   **MFA:** Required for all administrative and provider access.
*   **Audit Logging:** Every access to PHI is logged to an immutable Kafka topic and archived to WORM (Write Once Read Many) storage.

## 7. Data Persistence & Messaging Infrastructure
### 7.1 Database Cluster Specs
*   **PostgreSQL 16 (ACID/Relational):**
    *   Primary-Replica setup with automated failover (Patroni/Stolon).
    *   `pg_partman` for time-series partitioning.
    *   PostGIS for location-based queries.
*   **MongoDB 7.0 (FHIR Document Store):**
    *   Replica Set (3-node minimum).
    *   Sharding enabled for horizontal scaling as volume grows.
*   **Elasticsearch 8.x (Search/Analytics):**
    *   Dedicated master nodes and data nodes.
    *   ILM (Index Lifecycle Management) for hot/warm/cold storage tiers.
*   **Redis 7 (Cache/Sessions):**
    *   Cluster mode for HA and scalability.
*   **MinIO (Object Storage):**
    *   S3-compatible storage for clinical documents and audit archives.

### 7.2 Message Bus (Apache Kafka 3.7)
*   **Cluster Mode:** Minimum 3 brokers across AZs.
*   **KRaft Mode:** For simplified metadata management (removing Zookeeper dependency).
*   **Schema Registry:** Enforces data contracts (Avro/Protobuf) for all clinical events.
*   **Persistence Workers:** K8s-managed consumers that process the `clinical.enriched` topic and update the data stores (MongoDB/PostgreSQL).

## 8. Compliance & Data Sovereignty
*   **HIPAA Compliance:** Continuous compliance monitoring and automated auditing.
*   **Regional Isolation:** User data never leaves its designated region unless explicitly authorized (e.g., cross-region referrals).
*   **Data Retention:** Automated policies to purge data according to legal requirements.

## Appendix A: Resource Allocation

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
