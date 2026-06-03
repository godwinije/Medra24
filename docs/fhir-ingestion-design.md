# FHIR Ingestion Design: OmniHealth Unified Medical System

**Author:** Backend & Data Engineer  
**Date:** 2025-06-01  
**Status:** Draft  
**Version:** 1.1 (Revised per Lead Instructions)

---

## 1. FHIR R4 Resource Model Mapping

The following FHIR R4 resources are identified as core to the OmniHealth domain:

| Domain | FHIR R4 Resource | Purpose |
|--------|------------------|---------|
| **Demographics** | `Patient` | Central record for a patient; linked across facilities via OmniHealth ID. |
| **Clinical Events**| `Encounter` | Captures the context of care (Admission, Office Visit, Emergency). |
| **Vitals & Labs** | `Observation` | Highly polymorphic; stores vitals (BP, Temp) and laboratory results. |
| **Diagnoses** | `Condition` | Problems, diagnoses, and health concerns. |
| **Medications** | `MedicationRequest` | Orders for medications (prescriptions). |
| **Medications** | `MedicationAdministration` | Record of a patient actually taking/receiving a medication. |
| **Reports** | `DiagnosticReport` | Container for lab results, imaging reports, etc. |
| **Procedures** | `Procedure` | Actions performed on a patient (surgeries, physical therapy). |
| **Allergies** | `AllergyIntolerance` | Documented allergies and adverse reactions. |
| **Lineage** | `Provenance` | Metadata about the source of the data (EMR, user, facility). |

---

## 2. Ingestion Strategies

### 2.1 Push vs. Pull
- **Push (Primary):** Facilities send data to OmniHealth via HL7 v2 (MLLP) or FHIR Bundles (REST). This provides near-real-time data (lower latency).
- **Pull (Secondary/Batch):** OmniHealth queries facility EMRs via FHIR $export or periodic SQL extracts. Used for initial onboarding or recovery.

### 2.2 HL7 v2 → FHIR Conversion
- **Mapping Engine:** Use Liquid templates (Microsoft FHIR Converter).
- **Rationale:** Templates decouple mapping logic from code, allowing easier updates as EMR schemas change.

### 2.3 Batch vs. Streaming
- **Streaming (Default):** All incoming data is processed via Kafka. Each message is ingested into `clinical.raw.{facility}` as a discrete event, then transformed and published to `clinical.enriched`.
- **Batch:** Large historical imports are chunked and processed using the same pipeline but with lower priority Kafka topics.

---

## 3. Tools Evaluation

| Tool | Evaluation | Recommendation |
|------|------------|----------------|
| **Medplum** | Modern, TypeScript-first, FHIR-native storage and logic. | **Primary** for ingestion orchestration and developer portal. |
| **HAPI FHIR** | Robust Java-based library; best-in-class validation. | **Sidecar** for FHIR validation and terminology expansion. |
| **Microsoft FHIR Converter** | High performance Liquid-based transformer. | **Primary** for HL7 v2 and C-CDA mapping. |
| **OpenEMPI** | Dedicated MPI tool; powerful but high operational cost. | **Alternative** if custom MPI service is insufficient. |

---

## 4. Identity Resolution (MPI)

OmniHealth uses a hybrid approach for Patient matching:

1.  **Deterministic Matching:** Exact match on high-confidence identifiers:
    - National Health ID
    - SSN / National Identity Card
    - Passport Number
2.  **Probabilistic Matching (Fellegi-Sunter):** Score similarity on:
    - First Name / Last Name (using Soundex/Metaphone)
    - Date of Birth
    - Gender
    - Address (Zip code + Street similarity)
    - Phone Number
3.  **Linkage Algorithms:**
    - Records with a score > 0.9 are auto-linked.
    - Records between 0.7 and 0.9 are flagged for manual "Steward Review".
    - Records < 0.7 are treated as new patients.

---

## 5. Data Quality & Validation

- **Schema Validation:** Use HAPI FHIR Validator to ensure every resource adheres to R4 structure.
- **Profile Validation:** Ensure compliance with the OmniHealth Implementation Guide (IG).
- **Normalization:** 
    - **Dates:** All timestamps converted to UTC.
    - **Strings:** Trimming whitespace, standardizing case for names.
- **Deduplication:** The Enrichment stage checks for existing duplicate resources (e.g., the same lab result sent twice) using a hash of the resource type, patient ID, date, and value.

---

## 6. Sample Data (FHIR Transaction Bundle)

```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "fullUrl": "urn:uuid:61ebe359-bfdc-4613-8bf2-c5e300945f0a",
      "resource": {
        "resourceType": "Patient",
        "identifier": [
          {
            "system": "urn:oid:2.16.840.1.113883.3.123",
            "value": "NAT-ID-998877"
          }
        ],
        "name": [
          {
            "family": "Smith",
            "given": ["Jane", "A"]
          }
        ],
        "gender": "female",
        "birthDate": "1985-05-12"
      },
      "request": {
        "method": "POST",
        "url": "Patient"
      }
    },
    {
      "fullUrl": "urn:uuid:88e17af4-46c2-40f4-a026-b1a9e525f0e9",
      "resource": {
        "resourceType": "Observation",
        "status": "final",
        "code": {
          "coding": [
            {
              "system": "http://loinc.org",
              "code": "85354-9",
              "display": "Blood pressure panel with all children"
            }
          ]
        },
        "subject": {
          "reference": "urn:uuid:61ebe359-bfdc-4613-8bf2-c5e300945f0a"
        },
        "effectiveDateTime": "2025-06-01T10:00:00Z",
        "component": [
          {
            "code": { "coding": [{ "system": "http://loinc.org", "code": "8480-6" }] },
            "valueQuantity": { "value": 120, "unit": "mmHg", "system": "http://unitsofmeasure.org", "code": "mm[Hg]" }
          },
          {
            "code": { "coding": [{ "system": "http://loinc.org", "code": "8462-4" }] },
            "valueQuantity": { "value": 80, "unit": "mmHg", "system": "http://unitsofmeasure.org", "code": "mm[Hg]" }
          }
        ]
      },
      "request": {
        "method": "POST",
        "url": "Observation"
      }
    }
  ]
}
```
