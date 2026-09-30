import type { DataLayer } from './dataLayer';
import { formatLocalDateTime } from './relativeDates';
import type { Actor } from './types';
import { isTestSsn } from './vault';

/*
 * Applicant intake steps (Scenario 1). Each step saves as the signed-in applicant, so
 * the access filter applies and every change is audited; progress is kept after each
 * step (R8).
 */

export interface IdentityFields {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  /** Blank keeps an SSN already on file. */
  ssn: string;
}

export type IdentityErrors = Partial<Record<keyof IdentityFields, string>>;

export type SaveStepResult = { ok: true } | { ok: false; errors: IdentityErrors };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts `900123456` or `900-12-3456` and returns `900-12-3456`, or undefined if it isn't nine digits. */
export function normalizeSsn(value: string): string | undefined {
  const digits = value.replace(/[\s-]/g, '');
  return /^\d{9}$/.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : undefined;
}

/** Most digits a US phone number and an SSN can have; the fields stop accepting more. */
export const PHONE_DIGITS = 10;
export const SSN_DIGITS = 9;

/**
 * Formats a phone number as it's typed: `(574`, `(574) 555`, `(574) 555-0142`. Keeps
 * at most 10 digits and drops a leading country code 1 (US area codes never start with 1),
 * so the shape is always clear.
 */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, PHONE_DIGITS);
  if (digits.length === 0) {
    return '';
  }
  if (digits.length <= 3) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Formats an SSN as it's typed: `900`, `900-30`, `900-30-0001`. Keeps at most 9 digits. */
export function formatSsnInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, SSN_DIGITS);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/**
 * Saves the identity and contact step for the signed-in applicant (R5, R8, ADR-11).
 * Every field is checked first and nothing is saved unless all pass. The SSN goes
 * only to the vault; the record keeps its token and last four. The applicant's account
 * takes the same name and email so a sign-in link can find them later (T38).
 */
export function saveIdentityStep(dataLayer: DataLayer, fields: IdentityFields, actor: Actor): SaveStepResult {
  const user = dataLayer.getSignedInUser();
  const caregiver = user?.caregiver_id ? dataLayer.get('caregivers', user.caregiver_id) : undefined;
  if (!user || !caregiver) {
    throw new Error('Please sign in to continue your application.');
  }

  const value = {
    first_name: fields.first_name.trim(),
    last_name: fields.last_name.trim(),
    email: fields.email.trim().toLowerCase(),
    phone: fields.phone.trim(),
    date_of_birth: fields.date_of_birth.trim(),
    ssn: fields.ssn.trim(),
  };
  const errors: IdentityErrors = {};

  if (!value.first_name) {
    errors.first_name = 'Enter your first name.';
  }
  if (!value.last_name) {
    errors.last_name = 'Enter your last name.';
  }
  if (!value.email) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL.test(value.email)) {
    errors.email = 'Enter an email address like name@example.com.';
  } else if (dataLayer.emailInUse(value.email, user.id)) {
    // Checked by the data layer, since other applicants' accounts are outside this applicant's view.
    errors.email = 'That email is already used on another application. Sign in with it to continue that one.';
  }
  if (value.phone.replace(/\D/g, '').length < 10) {
    errors.phone = 'Enter your mobile phone number, including area code.';
  }
  const today = formatLocalDateTime(dataLayer.today()).slice(0, 10);
  if (!value.date_of_birth) {
    errors.date_of_birth = 'Enter your date of birth.';
  } else if (!DATE_ONLY.test(value.date_of_birth) || value.date_of_birth > today) {
    errors.date_of_birth = 'Enter a real date of birth.';
  }
  const ssn = value.ssn ? normalizeSsn(value.ssn) : undefined;
  if (!value.ssn) {
    if (!caregiver.ssn_token) {
      errors.ssn = 'Enter your Social Security number.';
    }
  } else if (!ssn) {
    errors.ssn = 'Enter your Social Security number as 9 digits, like 900-12-3456.';
  } else if (!isTestSsn(ssn)) {
    errors.ssn = 'This demo accepts only test numbers that start with 9, like 900-12-3456.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  dataLayer.update(
    'caregivers',
    caregiver.id,
    {
      first_name: value.first_name,
      last_name: value.last_name,
      email: value.email,
      phone: value.phone,
      date_of_birth: value.date_of_birth,
    },
    actor,
  );
  if (ssn) {
    dataLayer.storeSsn(caregiver.id, ssn, actor);
  }
  dataLayer.update(
    'users',
    user.id,
    { display_name: `${value.first_name} ${value.last_name}`, email: value.email },
    actor,
  );
  return { ok: true };
}
