/**
 * @omnihealth/fhir-types
 * TypeScript type definitions for FHIR R4 resources used across OmniHealth services.
 *
 * These types represent the core FHIR R4 resources we store and exchange.
 * They align with the HL7 FHIR R4 specification (https://hl7.org/fhir/R4/).
 *
 * @packageDocumentation
 */

// ──────────────────────────────────────────────
// Base / Primitive Types
// ──────────────────────────────────────────────

export type FHIRPrimitive = string | number | boolean | null;
export type FHIRId = string;
export type FHIRUri = string;
export type FHIRCanonical = string;
export type FHIRCode = string;
export type FHIROid = string;
export type FHIROID = string;
export type FHIRUuid = string;
export type FHIRBase64Binary = string;
export type FHIRInstant = string;      // ISO 8601 with timezone
export type FHIRDateTime = string;     // ISO 8601 date/time
export type FHIRDate = string;         // ISO 8601 date
export type FHIRTime = string;         // ISO 8601 time
export type FHIRDecimal = number;
export type FHIRInteger = number;
export type FHIRUnsignedInt = number;
export type FHIRPositiveInt = number;
export type FHIRMarkdown = string;
export type FHIRUrl = string;

// ──────────────────────────────────────────────
// Meta & Narrative
// ──────────────────────────────────────────────

export interface FHIRObject {
  id?: FHIRId;
  extension?: Extension[];
  modifierExtension?: Extension[];
}

export interface Resource extends FHIRObject {
  resourceType: string;
  meta?: Meta;
  implicitRules?: FHIRUri;
  language?: FHIRCode;
}

export interface Meta extends FHIRObject {
  versionId?: FHIRId;
  lastUpdated?: FHIRInstant;
  source?: FHIRUri;
  profile?: FHIRCanonical[];
  security?: Coding[];
  tag?: Coding[];
}

export interface Extension extends FHIRObject {
  url: FHIRUri;
  value?: any;
}

export interface Narrative extends FHIRObject {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string; // XHTML
}

export interface Identifier extends FHIRObject {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: FHIRUri;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

export interface CodeableConcept extends FHIRObject {
  coding?: Coding[];
  text?: string;
}

export interface Coding extends FHIRObject {
  system?: FHIRUri;
  version?: string;
  code?: FHIRCode;
  display?: string;
  userSelected?: boolean;
}

export interface Period extends FHIRObject {
  start?: FHIRDateTime;
  end?: FHIRDateTime;
}

export interface Range extends FHIRObject {
  low?: Quantity;
  high?: Quantity;
}

export interface Quantity extends FHIRObject {
  value?: FHIRDecimal;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: FHIRUri;
  code?: FHIRCode;
}

export interface Ratio extends FHIRObject {
  numerator?: Quantity;
  denominator?: Quantity;
}

export interface SampledData extends FHIRObject {
  origin: Quantity;
  period: FHIRDecimal;
  factor?: FHIRDecimal;
  lowerLimit?: FHIRDecimal;
  upperLimit?: FHIRDecimal;
  dimensions: FHIRPositiveInt;
  data: FHIRBase64Binary;
}

export interface Attachment extends FHIRObject {
  contentType?: FHIRCode;
  language?: FHIRCode;
  data?: FHIRBase64Binary;
  url?: FHIRUrl;
  size?: FHIRUnsignedInt;
  hash?: FHIRBase64Binary;
  title?: string;
  creation?: FHIRDateTime;
}

export interface Reference extends FHIRObject {
  reference?: string;
  type?: FHIRUri;
  identifier?: Identifier;
  display?: string;
}

export interface Annotation extends FHIRObject {
  authorReference?: Reference;
  authorString?: string;
  time?: FHIRDateTime;
  text: FHIRMarkdown;
}

export interface ContactPoint extends FHIRObject {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: FHIRPositiveInt;
  period?: Period;
}

export interface Address extends FHIRObject {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: Period;
}

export interface HumanName extends FHIRObject {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

export interface ContactDetail extends FHIRObject {
  name?: string;
  telecom?: ContactPoint[];
}

export interface UsageContext extends FHIRObject {
  code: Coding;
  valueCodeableConcept?: CodeableConcept;
  valueQuantity?: Quantity;
  valueRange?: Range;
  valueReference?: Reference;
}

// ──────────────────────────────────────────────
// FHIR R4 Resources
// ──────────────────────────────────────────────

// ── Patient ──
export interface Patient extends Resource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: FHIRDate;
  deceasedBoolean?: boolean;
  deceasedDateTime?: FHIRDateTime;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: FHIRInteger;
  photo?: Attachment[];
  contact?: PatientContact[];
  communication?: PatientCommunication[];
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
  link?: PatientLink[];
}

export interface PatientContact extends FHIRObject {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: Reference;
  period?: Period;
}

export interface PatientCommunication extends FHIRObject {
  language: CodeableConcept;
  preferred?: boolean;
}

export interface PatientLink extends FHIRObject {
  other: Reference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

// ── Practitioner ──
export interface Practitioner extends Resource {
  resourceType: 'Practitioner';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  address?: Address[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: FHIRDate;
  photo?: Attachment[];
  qualification?: PractitionerQualification[];
  communication?: CodeableConcept[];
}

export interface PractitionerQualification extends FHIRObject {
  identifier?: Identifier[];
  code: CodeableConcept;
  period?: Period;
  issuer?: Reference;
}

// ── Organization ──
export interface Organization extends Resource {
  resourceType: 'Organization';
  identifier?: Identifier[];
  active?: boolean;
  type?: CodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: ContactPoint[];
  address?: Address[];
  partOf?: Reference;
  contact?: OrganizationContact[];
  endpoint?: Reference[];
}

export interface OrganizationContact extends FHIRObject {
  purpose?: CodeableConcept;
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
}

// ── Encounter ──
export interface Encounter extends Resource {
  resourceType: 'Encounter';
  identifier?: Identifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  statusHistory?: EncounterStatusHistory[];
  class?: Coding;
  classHistory?: EncounterClassHistory[];
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  priority?: CodeableConcept;
  subject?: Reference;
  episodeOfCare?: Reference[];
  basedOn?: Reference[];
  participant?: EncounterParticipant[];
  appointment?: Reference[];
  period?: Period;
  length?: Quantity;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  diagnosis?: EncounterDiagnosis[];
  account?: Reference[];
  hospitalization?: EncounterHospitalization;
  location?: EncounterLocation[];
  serviceProvider?: Reference;
  partOf?: Reference;
}

export interface EncounterStatusHistory extends FHIRObject {
  status: Encounter['status'];
  period: Period;
}

export interface EncounterClassHistory extends FHIRObject {
  class: Coding;
  period: Period;
}

export interface EncounterParticipant extends FHIRObject {
  type?: CodeableConcept[];
  period?: Period;
  individual?: Reference;
}

export interface EncounterDiagnosis extends FHIRObject {
  condition: Reference;
  use?: CodeableConcept;
  rank?: FHIRPositiveInt;
}

export interface EncounterHospitalization extends FHIRObject {
  preAdmissionIdentifier?: Identifier;
  origin?: Reference;
  admitSource?: CodeableConcept;
  reAdmission?: CodeableConcept;
  dietPreference?: CodeableConcept[];
  specialCourtesy?: CodeableConcept[];
  specialArrangement?: CodeableConcept[];
  destination?: Reference;
  dischargeDisposition?: CodeableConcept;
}

export interface EncounterLocation extends FHIRObject {
  location: Reference;
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  physicalType?: CodeableConcept;
  period?: Period;
}

// ── Observation ──
export type ObservationStatus = 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';

export interface Observation extends Resource {
  resourceType: 'Observation';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: ObservationStatus;
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  focus?: Reference[];
  encounter?: Reference;
  effectiveDateTime?: FHIRDateTime;
  effectivePeriod?: Period;
  effectiveTiming?: any;  // Timing
  effectiveInstant?: FHIRInstant;
  issued?: FHIRInstant;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: FHIRInteger;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: FHIRTime;
  valueDateTime?: FHIRDateTime;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: Annotation[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: ObservationReferenceRange[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: ObservationComponent[];
}

export interface ObservationReferenceRange extends FHIRObject {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: Range;
  text?: FHIRMarkdown;
}

export interface ObservationComponent extends FHIRObject {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: FHIRInteger;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: FHIRTime;
  valueDateTime?: FHIRDateTime;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

// ── Condition ──
export interface Condition extends Resource {
  resourceType: 'Condition';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: FHIRDateTime;
  onsetAge?: Age;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  abatementDateTime?: FHIRDateTime;
  abatementAge?: Age;
  abatementPeriod?: Period;
  abatementRange?: Range;
  abatementString?: string;
  recordedDate?: FHIRDateTime;
  recorder?: Reference;
  asserter?: Reference;
  stage?: ConditionStage[];
  evidence?: ConditionEvidence[];
  note?: Annotation[];
}

export interface Age extends Quantity {
  // Same shape as Quantity
}

export interface ConditionStage extends FHIRObject {
  summary?: CodeableConcept;
  assessment?: Reference[];
  type?: CodeableConcept;
}

export interface ConditionEvidence extends FHIRObject {
  code?: CodeableConcept[];
  detail?: Reference[];
}

// ── MedicationRequest ──
export type MedicationRequestStatus = 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
export type MedicationRequestIntent = 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order';
export type MedicationRequestPriority = 'routine' | 'urgent' | 'asap' | 'stat';

export interface MedicationRequest extends Resource {
  resourceType: 'MedicationRequest';
  identifier?: Identifier[];
  status: MedicationRequestStatus;
  statusReason?: CodeableConcept;
  intent: MedicationRequestIntent;
  category?: CodeableConcept[];
  priority?: MedicationRequestPriority;
  doNotPerform?: boolean;
  reportedBoolean?: boolean;
  reportedReference?: Reference;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  encounter?: Reference;
  supportingInformation?: Reference[];
  authoredOn?: FHIRDateTime;
  requester?: Reference;
  performer?: Reference;
  performerType?: CodeableConcept;
  recorder?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  basedOn?: Reference[];
  groupIdentifier?: Identifier;
  courseOfTherapyType?: CodeableConcept;
  insurance?: Reference[];
  note?: Annotation[];
  dosageInstruction?: Dosage[];
  dispenseRequest?: MedicationDispenseRequest;
  substitution?: MedicationSubstitution;
  priorPrescription?: Reference;
  detectedIssue?: Reference[];
  eventHistory?: Reference[];
}

export interface Dosage extends FHIRObject {
  sequence?: FHIRInteger;
  text?: string;
  additionalInstruction?: CodeableConcept[];
  patientInstruction?: string;
  timing?: any; // Timing
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  site?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  doseAndRate?: DosageDoseAndRate[];
  maxDosePerPeriod?: Ratio;
  maxDosePerAdministration?: Quantity;
  maxDosePerLifetime?: Quantity;
}

export interface DosageDoseAndRate extends FHIRObject {
  type?: CodeableConcept;
  doseRange?: Range;
  doseQuantity?: Quantity;
  rateRatio?: Ratio;
  rateRange?: Range;
  rateQuantity?: Quantity;
}

export interface MedicationDispenseRequest extends FHIRObject {
  initialFill?: MedicationInitialFill;
  dispenseInterval?: Period;
  validityPeriod?: Period;
  numberOfRepeatsAllowed?: FHIRUnsignedInt;
  quantity?: Quantity;
  expectedSupplyDuration?: Quantity;
  performer?: Reference;
}

export interface MedicationInitialFill extends FHIRObject {
  quantity?: Quantity;
  duration?: Quantity;
}

export interface MedicationSubstitution extends FHIRObject {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: CodeableConcept;
  reason?: CodeableConcept;
}

// ── MedicationAdministration ──
export type MedAdminStatus = 'in-progress' | 'not-done' | 'on-hold' | 'completed' | 'entered-in-error' | 'stopped' | 'unknown';

export interface MedicationAdministration extends Resource {
  resourceType: 'MedicationAdministration';
  identifier?: Identifier[];
  instantiates?: FHIRUri[];
  partOf?: Reference[];
  status: MedAdminStatus;
  statusReason?: CodeableConcept[];
  category?: CodeableConcept;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  context?: Reference;
  supportingInformation?: Reference[];
  effectiveDateTime?: FHIRDateTime;
  effectivePeriod?: Period;
  performer?: MedAdminPerformer[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  request?: Reference;
  device?: Reference[];
  note?: Annotation[];
  dosage?: MedAdminDosage;
  eventHistory?: Reference[];
}

export interface MedAdminPerformer extends FHIRObject {
  function?: CodeableConcept;
  actor: Reference;
}

export interface MedAdminDosage extends FHIRObject {
  text?: string;
  site?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  dose?: Quantity;
  rateRatio?: Ratio;
  rateQuantity?: Quantity;
}

// ── Procedure ──
export type ProcedureStatus = 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';

export interface Procedure extends Resource {
  resourceType: 'Procedure';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: ProcedureStatus;
  statusReason?: CodeableConcept;
  category?: CodeableConcept;
  code?: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  performedDateTime?: FHIRDateTime;
  performedPeriod?: Period;
  performedString?: string;
  performedAge?: Age;
  performedRange?: Range;
  recorder?: Reference;
  asserter?: Reference;
  performer?: ProcedurePerformer[];
  location?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  bodySite?: CodeableConcept[];
  outcome?: CodeableConcept;
  report?: Reference[];
  complication?: CodeableConcept[];
  complicationDetail?: Reference[];
  followUp?: CodeableConcept[];
  note?: Annotation[];
  focalDevice?: ProcedureFocalDevice[];
  usedReference?: Reference[];
  usedCode?: CodeableConcept[];
}

export interface ProcedurePerformer extends FHIRObject {
  function?: CodeableConcept;
  actor: Reference;
  onBehalfOf?: Reference;
}

export interface ProcedureFocalDevice extends FHIRObject {
  action?: CodeableConcept;
  manipulated: Reference;
}

// ── AllergyIntolerance ──
export type AllergyIntoleranceType = 'allergy' | 'intolerance';
export type AllergyIntoleranceCategory = 'food' | 'medication' | 'environment' | 'biologic';
export type AllergyIntoleranceCriticality = 'low' | 'high' | 'unable-to-assess';

export interface AllergyIntolerance extends Resource {
  resourceType: 'AllergyIntolerance';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  type?: AllergyIntoleranceType;
  category?: AllergyIntoleranceCategory[];
  criticality?: AllergyIntoleranceCriticality;
  code?: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  onsetDateTime?: FHIRDateTime;
  onsetAge?: Age;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  recordedDate?: FHIRDateTime;
  recorder?: Reference;
  asserter?: Reference;
  lastOccurrence?: FHIRDateTime;
  note?: Annotation[];
  reaction?: AllergyIntoleranceReaction[];
}

export interface AllergyIntoleranceReaction extends FHIRObject {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  description?: string;
  onset?: FHIRDateTime;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: CodeableConcept;
  note?: Annotation[];
}

// ── Immunization ──
export type ImmunizationStatus = 'completed' | 'entered-in-error' | 'not-done';

export interface Immunization extends Resource {
  resourceType: 'Immunization';
  identifier?: Identifier[];
  status: ImmunizationStatus;
  statusReason?: CodeableConcept;
  vaccineCode: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  occurrenceDateTime?: FHIRDateTime;
  occurrenceString?: string;
  recorded?: FHIRDateTime;
  primarySource?: boolean;
  reportOrigin?: CodeableConcept;
  location?: Reference;
  manufacturer?: Reference;
  lotNumber?: string;
  expirationDate?: FHIRDate;
  site?: CodeableConcept;
  route?: CodeableConcept;
  doseQuantity?: Quantity;
  performer?: ImmunizationPerformer[];
  note?: Annotation[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  isSubpotent?: boolean;
  subpotentReason?: CodeableConcept[];
  education?: ImmunizationEducation[];
  programEligibility?: CodeableConcept[];
  fundingSource?: CodeableConcept;
  reaction?: ImmunizationReaction[];
  protocolApplied?: ImmunizationProtocolApplied[];
}

export interface ImmunizationPerformer extends FHIRObject {
  function?: CodeableConcept;
  actor: Reference;
}

export interface ImmunizationEducation extends FHIRObject {
  documentType?: string;
  reference?: FHIRUri;
  publicationDate?: FHIRDateTime;
  presentationDate?: FHIRDateTime;
}

export interface ImmunizationReaction extends FHIRObject {
  date?: FHIRDateTime;
  detail?: Reference;
  reported?: boolean;
}

export interface ImmunizationProtocolApplied extends FHIRObject {
  series?: string;
  authority?: Reference;
  targetDisease?: CodeableConcept[];
  doseNumberPositiveInt?: FHIRPositiveInt;
  doseNumberString?: string;
  seriesDosesPositiveInt?: FHIRPositiveInt;
  seriesDosesString?: string;
}

// ── DiagnosticReport ──
export type DiagnosticReportStatus = 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';

export interface DiagnosticReport extends Resource {
  resourceType: 'DiagnosticReport';
  identifier?: Identifier[];
  basedOn?: Reference[];
  status: DiagnosticReportStatus;
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  encounter?: Reference;
  effectiveDateTime?: FHIRDateTime;
  effectivePeriod?: Period;
  issued?: FHIRInstant;
  performer?: Reference[];
  resultsInterpreter?: Reference[];
  specimen?: Reference[];
  result?: Reference[];
  imagingStudy?: Reference[];
  media?: DiagnosticReportMedia[];
  conclusion?: string;
  conclusionCode?: CodeableConcept[];
  presentedForm?: Attachment[];
}

export interface DiagnosticReportMedia extends FHIRObject {
  comment?: string;
  link: Reference;
}

// ── DocumentReference ──
export type DocRefStatus = 'current' | 'superseded' | 'entered-in-error';

export interface DocumentReference extends Resource {
  resourceType: 'DocumentReference';
  masterIdentifier?: Identifier;
  identifier?: Identifier[];
  status: DocRefStatus;
  docStatus?: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
  type?: CodeableConcept;
  category?: CodeableConcept[];
  subject?: Reference;
  date?: FHIRInstant;
  author?: Reference[];
  authenticator?: Reference;
  custodian?: Reference;
  relatesTo?: DocumentReferenceRelatesTo[];
  description?: string;
  securityLabel?: CodeableConcept[];
  content: DocumentReferenceContent[];
  context?: DocumentReferenceContext;
}

export interface DocumentReferenceRelatesTo extends FHIRObject {
  code: 'replaces' | 'transforms' | 'signs' | 'appends';
  target: Reference;
}

export interface DocumentReferenceContent extends FHIRObject {
  attachment: Attachment;
  format?: Coding;
}

export interface DocumentReferenceContext extends FHIRObject {
  encounter?: Reference[];
  event?: CodeableConcept[];
  period?: Period;
  facilityType?: CodeableConcept;
  practiceSetting?: CodeableConcept;
  sourcePatientInfo?: Reference;
  related?: Reference[];
}

// ── Consent ──
export type ConsentStatus = 'draft' | 'proposed' | 'active' | 'rejected' | 'inactive' | 'entered-in-error';

export interface Consent extends Resource {
  resourceType: 'Consent';
  identifier?: Identifier[];
  status: ConsentStatus;
  scope: CodeableConcept;
  category: CodeableConcept[];
  patient?: Reference;
  dateTime?: FHIRDateTime;
  performer?: Reference[];
  organization?: Reference[];
  sourceAttachment?: Attachment;
  sourceReference?: Reference;
  policyRule?: CodeableConcept;
  verification?: ConsentVerification[];
  provision?: ConsentProvision;
}

export interface ConsentVerification extends FHIRObject {
  verified: boolean;
  verifiedWith?: Reference;
  verificationDate?: FHIRDateTime;
}

export interface ConsentProvision extends FHIRObject {
  type?: 'deny' | 'permit';
  period?: Period;
  actor?: ConsentProvisionActor[];
  action?: CodeableConcept[];
  securityLabel?: Coding[];
  purpose?: Coding[];
  class?: Coding[];
  code?: CodeableConcept[];
  dataPeriod?: Period;
  data?: ConsentProvisionData[];
  provision?: ConsentProvision[];
}

export interface ConsentProvisionActor extends FHIRObject {
  role: CodeableConcept;
  reference: Reference;
}

export interface ConsentProvisionData extends FHIRObject {
  meaning: 'instance' | 'related' | 'dependents' | 'authoredby';
  reference: Reference;
}

// ── Bundle ──
export type BundleType = 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';

export interface Bundle extends Resource {
  resourceType: 'Bundle';
  identifier?: Identifier;
  type: BundleType;
  timestamp?: FHIRInstant;
  total?: FHIRUnsignedInt;
  link?: BundleLink[];
  entry?: BundleEntry[];
  signature?: any; // Signature
}

export interface BundleLink extends FHIRObject {
  relation: string;
  url: FHIRUri;
}

export interface BundleEntry extends FHIRObject {
  link?: BundleLink[];
  fullUrl?: FHIRUri;
  resource?: Resource;
  search?: BundleEntrySearch;
  request?: BundleEntryRequest;
  response?: BundleEntryResponse;
}

export interface BundleEntrySearch extends FHIRObject {
  mode?: 'match' | 'include' | 'outcome';
  score?: FHIRDecimal;
}

export interface BundleEntryRequest extends FHIRObject {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: FHIRUri;
  ifNoneMatch?: string;
  ifModifiedSince?: FHIRInstant;
  ifMatch?: string;
  ifNoneExist?: string;
}

export interface BundleEntryResponse extends FHIRObject {
  status: string;
  location?: FHIRUri;
  etag?: string;
  lastModified?: FHIRInstant;
  outcome?: Resource;
}

// ── OperationOutcome ──
export interface OperationOutcome extends Resource {
  resourceType: 'OperationOutcome';
  issue: OperationOutcomeIssue[];
}

export interface OperationOutcomeIssue extends FHIRObject {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: FHIRCode;
  details?: CodeableConcept;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

// ── Parameters (for operations) ──
export interface Parameters extends Resource {
  resourceType: 'Parameters';
  parameter?: ParametersParameter[];
}

export interface ParametersParameter extends FHIRObject {
  name: string;
  valueBase64Binary?: FHIRBase64Binary;
  valueBoolean?: boolean;
  valueCanonical?: FHIRCanonical;
  valueCode?: FHIRCode;
  valueDate?: FHIRDate;
  valueDateTime?: FHIRDateTime;
  valueDecimal?: FHIRDecimal;
  valueId?: FHIRId;
  valueInstant?: FHIRInstant;
  valueInteger?: FHIRInteger;
  valueMarkdown?: FHIRMarkdown;
  valueOid?: FHIROid;
  valueString?: string;
  valueTime?: FHIRTime;
  valueUnsignedInt?: FHIRUnsignedInt;
  valueUri?: FHIRUri;
  valueUrl?: FHIRUrl;
  valueUuid?: FHIRUuid;
  valueAddress?: Address;
  valueAge?: Age;
  valueAnnotation?: Annotation;
  valueAttachment?: Attachment;
  valueCodeableConcept?: CodeableConcept;
  valueCoding?: Coding;
  valueContactPoint?: ContactPoint;
  valueHumanName?: HumanName;
  valueIdentifier?: Identifier;
  valuePeriod?: Period;
  valueQuantity?: Quantity;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueReference?: Reference;
  valueSampledData?: SampledData;
  valueResource?: Resource;
  resource?: Resource;
  part?: ParametersParameter[];
}

// ──────────────────────────────────────────────
// Search Parameter Types
// ──────────────────────────────────────────────

export interface SearchParams {
  _id?: string;
  _lastUpdated?: string;
  _tag?: string;
  _profile?: string;
  _security?: string;
  _text?: string;
  _content?: string;
  _list?: string;
  _has?: string;
  _type?: string;
  _sort?: string;
  _count?: number;
  _include?: string;
  _revinclude?: string;
  _summary?: 'true' | 'text' | 'data' | 'count' | 'false';
  _elements?: string;
  _contained?: 'true' | 'false';
  _containedType?: 'container' | 'contained';
  [key: string]: string | number | undefined;
}

// ──────────────────────────────────────────────
// FHIR Version Info
// ──────────────────────────────────────────────

export const FHIR_VERSION = '4.0.1';

export const FHIR_RESOURCE_TYPES = [
  'Patient',
  'Practitioner',
  'Organization',
  'Encounter',
  'Observation',
  'Condition',
  'MedicationRequest',
  'MedicationAdministration',
  'Procedure',
  'AllergyIntolerance',
  'Immunization',
  'DiagnosticReport',
  'DocumentReference',
  'Consent',
  'Bundle',
  'OperationOutcome',
  'Parameters',
] as const;

export type FHIRResourceType = typeof FHIR_RESOURCE_TYPES[number];

// ──────────────────────────────────────────────
// Type Guards & Helpers
// ──────────────────────────────────────────────

export function isResource(obj: unknown): obj is Resource {
  return typeof obj === 'object' && obj !== null && 'resourceType' in obj;
}

export function isPatient(resource: Resource): resource is Patient {
  return resource.resourceType === 'Patient';
}

export function isObservation(resource: Resource): resource is Observation {
  return resource.resourceType === 'Observation';
}

export function isCondition(resource: Resource): resource is Condition {
  return resource.resourceType === 'Condition';
}

export function isEncounter(resource: Resource): resource is Encounter {
  return resource.resourceType === 'Encounter';
}

export function isBundle(resource: Resource): resource is Bundle {
  return resource.resourceType === 'Bundle';
}

export function isMedicationRequest(resource: Resource): resource is MedicationRequest {
  return resource.resourceType === 'MedicationRequest';
}