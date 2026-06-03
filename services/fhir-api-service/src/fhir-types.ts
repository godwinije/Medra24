/**
 * Core FHIR R4 type definitions for the FHIR API Service.
 * Replicates the key types from @omnihealth/fhir-types for standalone use.
 */

// ─── Base Types ──────────────────────────────────
export interface Resource {
  resourceType: string;
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
}

export interface Meta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  tag?: Coding[];
}

export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

export interface Coding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface Quantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: Period;
}

export interface Address {
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

export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface Annotation {
  authorReference?: Reference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface Range {
  low?: Quantity;
  high?: Quantity;
}

export interface Ratio {
  numerator?: Quantity;
  denominator?: Quantity;
}

// ─── Patient ─────────────────────────────────────
export interface Patient extends Resource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: Attachment[];
  contact?: PatientContact[];
  communication?: PatientCommunication[];
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
  link?: PatientLink[];
}

export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: Reference;
  period?: Period;
}

export interface PatientCommunication {
  language: CodeableConcept;
  preferred?: boolean;
}

export interface PatientLink {
  other: Reference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

// ─── Observation ─────────────────────────────────
export interface Observation extends Resource {
  resourceType: 'Observation';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  focus?: Reference[];
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
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

export interface ObservationReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: Range;
  text?: string;
}

export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

// ─── Condition ───────────────────────────────────
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
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: Quantity;
  abatementPeriod?: Period;
  abatementRange?: Range;
  abatementString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  stage?: ConditionStage[];
  evidence?: ConditionEvidence[];
  note?: Annotation[];
}

export interface ConditionStage {
  summary?: CodeableConcept;
  assessment?: Reference[];
  type?: CodeableConcept;
}

export interface ConditionEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

// ─── Encounter ───────────────────────────────────
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

export interface EncounterStatusHistory {
  status: Encounter['status'];
  period: Period;
}

export interface EncounterClassHistory {
  class: Coding;
  period: Period;
}

export interface EncounterParticipant {
  type?: CodeableConcept[];
  period?: Period;
  individual?: Reference;
}

export interface EncounterDiagnosis {
  condition: Reference;
  use?: CodeableConcept;
  rank?: number;
}

export interface EncounterHospitalization {
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

export interface EncounterLocation {
  location: Reference;
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  physicalType?: CodeableConcept;
  period?: Period;
}

// ─── MedicationRequest ───────────────────────────
export interface MedicationRequest extends Resource {
  resourceType: 'MedicationRequest';
  identifier?: Identifier[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  statusReason?: CodeableConcept;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order';
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  encounter?: Reference;
  supportingInformation?: Reference[];
  authoredOn?: string;
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
}

export interface Dosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: CodeableConcept[];
  patientInstruction?: string;
  timing?: any;
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

export interface DosageDoseAndRate {
  type?: CodeableConcept;
  doseRange?: Range;
  doseQuantity?: Quantity;
  rateRatio?: Ratio;
  rateRange?: Range;
  rateQuantity?: Quantity;
}

export interface MedicationDispenseRequest {
  initialFill?: MedicationInitialFill;
  dispenseInterval?: Period;
  validityPeriod?: Period;
  numberOfRepeatsAllowed?: number;
  quantity?: Quantity;
  expectedSupplyDuration?: Quantity;
  performer?: Reference;
}

export interface MedicationInitialFill {
  quantity?: Quantity;
  duration?: Quantity;
}

export interface MedicationSubstitution {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: CodeableConcept;
  reason?: CodeableConcept;
}

// ─── Bundle ──────────────────────────────────────
export interface Bundle extends Resource {
  resourceType: 'Bundle';
  identifier?: Identifier;
  type: 'searchset' | 'document' | 'message' | 'transaction' | 'batch' | 'history' | 'collection';
  timestamp?: string;
  total?: number;
  link?: BundleLink[];
  entry?: BundleEntry[];
  signature?: any;
}

export interface BundleLink {
  relation: string;
  url: string;
}

export interface BundleEntry {
  link?: BundleLink[];
  fullUrl?: string;
  resource?: Resource;
  search?: BundleEntrySearch;
  request?: BundleEntryRequest;
  response?: BundleEntryResponse;
}

export interface BundleEntrySearch {
  mode?: 'match' | 'include' | 'outcome';
  score?: number;
}

export interface BundleEntryRequest {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
}

export interface BundleEntryResponse {
  status: string;
  location?: string;
  etag?: string;
  lastModified?: string;
  outcome?: Resource;
}

// ─── OperationOutcome ────────────────────────────
export interface OperationOutcome extends Resource {
  resourceType: 'OperationOutcome';
  issue: OperationOutcomeIssue[];
}

export interface OperationOutcomeIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  details?: CodeableConcept;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

// ─── CapabilityStatement ─────────────────────────
export interface CapabilityStatement extends Resource {
  resourceType: 'CapabilityStatement';
  status: 'draft' | 'active' | 'retired' | 'unknown';
  date: string;
  publisher?: string;
  kind: 'instance' | 'capability' | 'requirements';
  software?: CapabilitySoftware;
  fhirVersion: string;
  format: string[];
  rest?: CapabilityRest[];
}

export interface CapabilitySoftware {
  name: string;
  version?: string;
  releaseDate?: string;
}

export interface CapabilityRest {
  mode: 'client' | 'server';
  security?: CapabilitySecurity;
  resource?: CapabilityResource[];
  interaction?: CapabilityInteraction[];
  operation?: CapabilityOperation[];
}

export interface CapabilitySecurity {
  cors?: boolean;
  service?: CodeableConcept[];
  description?: string;
}

export interface CapabilityResource {
  type: string;
  profile?: string;
  interaction?: CapabilityInteraction[];
  searchParam?: CapabilitySearchParam[];
  versioning?: 'no-version' | 'versioned' | 'versioned-update';
  readHistory?: boolean;
  updateCreate?: boolean;
}

export interface CapabilityInteraction {
  code: 'read' | 'search-type' | 'create' | 'update' | 'delete' | 'vread' | 'history-type';
  documentation?: string;
}

export interface CapabilitySearchParam {
  name: string;
  type: 'number' | 'date' | 'string' | 'token' | 'reference' | 'composite' | 'quantity' | 'uri' | 'special';
  documentation?: string;
}

export interface CapabilityOperation {
  name: string;
  definition?: string;
  documentation?: string;
}

// ─── Type Guards ─────────────────────────────────
export function isPatient(r: Resource): r is Patient { return r.resourceType === 'Patient'; }
export function isObservation(r: Resource): r is Observation { return r.resourceType === 'Observation'; }
export function isCondition(r: Resource): r is Condition { return r.resourceType === 'Condition'; }
export function isEncounter(r: Resource): r is Encounter { return r.resourceType === 'Encounter'; }
export function isMedicationRequest(r: Resource): r is MedicationRequest { return r.resourceType === 'MedicationRequest'; }
export function isBundle(r: Resource): r is Bundle { return r.resourceType === 'Bundle'; }
export function isOperationOutcome(r: Resource): r is OperationOutcome { return r.resourceType === 'OperationOutcome'; }

// ─── Search Param / Interaction Types ─────────────
export type SearchParamType = 'number' | 'date' | 'string' | 'token' | 'reference' | 'composite' | 'quantity' | 'uri' | 'special';
export type InteractionCode = 'read' | 'search-type' | 'create' | 'update' | 'delete' | 'vread' | 'history-type';

// ─── Constants ───────────────────────────────────
export const FHIR_VERSION = '4.0.1';
export const SUPPORTED_RESOURCES = ['Patient', 'Observation', 'Condition', 'Encounter', 'MedicationRequest'] as const;
export type ResourceType = typeof SUPPORTED_RESOURCES[number];