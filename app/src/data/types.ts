// Data-model types. Field names match the stored rows (seed CSV columns), and
// values stay text, as the data layer stores them (ADR-21).

/** Caregiver record lifecycle (ADR-08). */
export const LIFECYCLE_STATES = [
  'Intake In Progress',
  'Intake Complete',
  'Screening In Progress',
  'Eligible',
  'Cleared',
  'Not Current',
  'Review Required',
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export function isLifecycleState(value: string): value is LifecycleState {
  return (LIFECYCLE_STATES as readonly string[]).includes(value);
}

/** Demo users are applicants and coordinators only (ADR-04). */
export const USER_ROLES = ['coordinator', 'applicant'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface Agency {
  id: string;
  name: string;
  intake_slug: string;
  state: string;
}

/** A user's role is tied to one agency (R4). */
export interface User {
  id: string;
  agency_id: string;
  role: UserRole;
  display_name: string;
  email: string;
  /** Demo coordinator sign-in only (ADR-05); empty for applicants. */
  password: string;
  /** Set for applicants; empty for coordinators. */
  caregiver_id: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string;
}

/** The record keeps only a token and the last four digits; the full SSN lives in the vault (ADR-11). */
export interface Caregiver {
  id: string;
  agency_id: string;
  template_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  ssn_token: string;
  ssn_last4: string;
  lifecycle_state: LifecycleState;
  created_at: string;
  state_changed_at: string;
}

/** One requirement template per state and role, stored as seed data (ADR-03). */
export interface RequirementTemplate {
  id: string;
  state: string;
  role: string;
  name: string;
  is_sample: string;
  sample_note: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  item_key: string;
  name: string;
  /** Plain-language reason shown to applicants (R18). */
  reason: string;
  source: string;
  method: string;
  requires_upload: string;
  sort_order: string;
}

/** Required item statuses (ADR-09). */
export const ITEM_STATUSES = [
  'Pending',
  'Ordered',
  'Delayed',
  'Retryable',
  'Verified',
  'Expiring',
  'Expired',
  'Manual Verification',
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export function isItemStatus(value: string): value is ItemStatus {
  return (ITEM_STATUSES as readonly string[]).includes(value);
}

/** Every item records its source, method, verification date, and expiration date (R2). */
export interface RequiredItem {
  id: string;
  caregiver_id: string;
  item_key: string;
  status: ItemStatus;
  source: string;
  method: string;
  ordered_at: string;
  verified_date: string;
  expiration_date: string;
  result: string;
  evidence: string;
  notes: string;
}

/** Describes a document file kept in IndexedDB (ADR-15). */
export interface DocumentRecord {
  id: string;
  caregiver_id: string;
  agency_id: string;
  item_key: string;
  file_name: string;
  file_type: string;
  expiration_date: string;
  uploaded_at: string;
}

/** One request to a mock vendor adapter (ADR-01, ADR-12). */
export interface CheckOrder {
  id: string;
  required_item_id: string;
  caregiver_id: string;
  source: string;
  ordered_at: string;
  completed_at: string;
  result: string;
}

/** Disclosure and authorization are recorded separately, each with its wording version (ADR-16). */
export const CONSENT_TYPES = ['disclosure', 'authorization'] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_DECISIONS = ['acknowledged', 'granted', 'declined'] as const;

export type ConsentDecision = (typeof CONSENT_DECISIONS)[number];

export interface Consent {
  id: string;
  caregiver_id: string;
  type: ConsentType;
  decision: ConsentDecision;
  wording_version: string;
  recorded_at: string;
}

/** Who made a change. Scheduled jobs act as `system` / `CareMatch`. */
export interface Actor {
  role: UserRole | 'system';
  name: string;
}

/** One entry in the append-only audit log (R1, C5, ADR-10). */
export interface AuditEvent {
  id: string;
  caregiver_id: string;
  occurred_at: string;
  actor_role: string;
  actor_name: string;
  event: string;
  details: string;
  /** Table and row the event is about; blank on seeded history. */
  table: string;
  record_id: string;
}

/** Notifications are written to the in-app outbox, marked email or SMS (ADR-06). */
export const NOTIFICATION_CHANNELS = ['email', 'sms'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface Notification {
  id: string;
  agency_id: string;
  recipient_user_id: string;
  caregiver_id: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  created_at: string;
}
