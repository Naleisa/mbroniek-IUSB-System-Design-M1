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
