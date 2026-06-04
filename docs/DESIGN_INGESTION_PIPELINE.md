# Design Document: Data Ingestion & FHIR Pipeline

**Author:** Backend & Data Engineer  
**Date:** 2025-06-01  
**Status:** Draft  
**Version:** 1.0  

---

## 1. Introduction
This document outlines the design for the OmniHealth Data Ingestion Pipeline. The pipeline is responsible for receiving medical data in various formats (HL7 v2, C-CDA, FHIR Bundles), transforming it into standard FHIR R4 resources, and ensuring data integrity, identity linkage, and auditability.

## 2. Research Findings

### 2.1 FHIR R4 Standards for Ingestion
- **FHIR Bundles:** The primary container for multi-resource transfers. `transaction` and `batch` types are used for atomic vs. non-atomic processing.
- **$convert-data operation:** A proposed standard for data transformation, though often implemented via custom pipelines.
- **Provenance:** Essential for tracking the "life" of a piece of data from the source EMR to the unified record.

### 2.2 Tool Evaluation

| Tool | Pros | Cons | Recommendation |
|------|------|------|----------------|
| **Microsoft FHIR Converter** | High performance, Liquid templates are flexible and decouple mapping from code. | Requires a sidecar or C# runtime; Liquid can be complex for very deep logic. | **Primary** for HL7 v2 and C-CDA mapping. |
| **HAPI FHIR (Java)** | Industry standard, comprehensive validation, robust JPA server. | Heavy (Java/Spring Boot), might be overkill for just transformation. | **Secondary** for standalone validation service. |
| **Medplum** | Modern, TypeScript-first, built-in "Bots" for custom logic, excellent developer experience. | Newer, might have fewer legacy format converters. | **Primary** for ingestion logic and pipeline orchestration. |
| **FHIRbase** | Blazing fast search, PostgreSQL-native, simplifies relational queries. | Not a transformation tool; strictly storage. | **Primary** for indexing and relational views. |

## 3. Proposed Pipeline Architecture

The pipeline follows an event-driven, microservices-based approach using Kafka for reliability and scalability.

### 3.1 Flow Overview

1.  **Ingestion Adapters (The "Inlets"):**
    - **MLLP Adapter:** Listens for HL7 v2 messages.
    - **REST Adapter:** Receives C-CDA XML or FHIR Bundles via HTTPS.
    - **Bulk Adapter:** Handles FHIR Bulk Data ($export) imports.

2.  **Raw Ingestion (Kafka: `clinical.raw`):**
    - Every incoming message is immediately persisted to MinIO (S3) and a reference is placed on the `clinical.raw` topic.
    - This ensures we never lose source data even if transformation fails.

3.  **Transformation Service (Liquid Engine):**
    - Consumes from `clinical.raw`.
    - Uses **Microsoft FHIR Converter** (running as a sidecar/microservice) to apply Liquid templates.
    - Output: A FHIR R4 Bundle.
    - Publishes to `clinical.transformed`.

4.  **Validation Service:**
    - Consumes from `clinical.transformed`.
    - Validates against:
        - FHIR R4 Core Profiles.
        - National Implementation Guides (IGs).
        - Custom business rules.
    - On Failure: Route to `clinical.dead-letter` for manual review.
    - On Success: Publishes to `clinical.validated`.

5.  **Enrichment & Identity Service (The "Brain"):**
    - Consumes from `clinical.validated`.
    - **Identity Resolution:** Calls the **MPI Service** to resolve the `Patient` resource. Replaces local MRNs with the OmniHealth Global Patient ID.
    - **Terminology Mapping:** Calls the **Terminology Service** to map local codes (e.g., Lab Code "WBC-123") to standard codes (LOINC "6690-2").
    - **Provenance Creation:** Generates a `Provenance` resource linked to all resources in the bundle.
    - Publishes to `clinical.enriched`.

6.  **Persistence Worker:**
    - Consumes from `clinical.enriched`.
    - Performs a "Dual-Write":
        - **MongoDB:** Stores the full FHIR resource for document-based retrieval.
        - **PostgreSQL:** Updates search indexes and relational tables for population health analytics.
        - **Elasticsearch:** Indexes text fields (notes, reports).

## 4. Key Design Decisions

### 4.1 Use of Liquid Templates for Mapping
We will use Liquid templates (Microsoft FHIR Converter) for HL7 v2 and C-CDA mapping. This allows non-developers (clinical analysts) to maintain mappings without redeploying code.

### 4.2 Transactional Integrity
We use Kafka's transactional features to ensure that a message is only "committed" once it has been successfully processed and published to the next stage.

### 4.3 Provenance and Lineage
Every resource will have a `Provenance` entry. This record includes:
- `recorded`: Timestamp of ingestion.
- `agent`: The facility that sent the data.
- `entity`: Reference to the raw source message in MinIO.

## 5. Next Steps
1.  **Prototype HL7 v2 Mapping:** Create Liquid templates for common ADT (Admission, Discharge, Transfer) messages.
2.  **MPI Integration:** Define the gRPC contract between the Enrichment Service and the MPI Service.
3.  **Validation Rules:** Define the initial set of validation rules for the National Health Profile.
