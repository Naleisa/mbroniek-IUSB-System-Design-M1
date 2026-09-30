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
 * Formats a phone number as it's typed: `(574`, `(574) 555`, `(574) 555-0142`. Every
 * typed digit is kept, up to 10. A pasted or autofilled 11-digit number starting with the
 * country code 1 (such as `+1 574 555 0142`) drops that 1.
 */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
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

export interface NeededItem {
  item_key: string;
  name: string;
  reason: string;
}

export interface WhatYoullNeed {
  /** Items the applicant uploads a photo of. */
  upload: NeededItem[];
  /** Items checked for the applicant (background, exclusion lists). */
  check: NeededItem[];
}

/**
 * The "what you'll need and why" list for the signed-in applicant (R18, ADR-03): their
 * template's items in template order, each with its plain-language reason, split by
 * whether the applicant uploads it. Read from the template, so editing the seed changes it.
 */
export function whatYoullNeed(dataLayer: DataLayer): WhatYoullNeed {
  const caregiverId = dataLayer.getSignedInUser()?.caregiver_id;
  const caregiver = caregiverId ? dataLayer.get('caregivers', caregiverId) : undefined;
  if (!caregiver) {
    return { upload: [], check: [] };
  }
  const items = dataLayer
    .list('template_items')
    .filter((item) => item.template_id === caregiver.template_id)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const toNeeded = (item: (typeof items)[number]): NeededItem => ({
    item_key: item.item_key,
    name: item.name,
    reason: item.reason,
  });
  return {
    upload: items.filter((item) => item.requires_upload === 'true').map(toNeeded),
    check: items.filter((item) => item.requires_upload !== 'true').map(toNeeded),
  };
}

/** Accepted upload formats and the short name shown to applicants (ADR-15). */
export const UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'application/pdf': 'PDF',
};

/** Largest file an applicant can choose, checked before compression (ADR-15). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Checks a chosen file's format and size before anything else happens. Returns a message, or '' if it's fine. */
export function checkUploadFile(type: string, size: number): string {
  if (!UPLOAD_TYPES[type]) {
    return 'Choose a JPG, PNG, or PDF file.';
  }
  if (size > MAX_UPLOAD_BYTES) {
    return `This file is ${(size / (1024 * 1024)).toFixed(1)} MB. Choose one that's 10 MB or smaller.`;
  }
  return '';
}

export interface UploadInput {
  itemKey: string;
  /** The file to store: compressed for photos, as chosen for PDFs. */
  file: Blob;
  fileName: string;
  /** The chosen file's format and size, before compression. */
  originalType: string;
  originalSize: number;
  expirationDate: string;
}

export type UploadErrors = { file?: string; expiration_date?: string };

export type UploadResult = { ok: true; documentId: string } | { ok: false; errors: UploadErrors };

/**
 * Saves one document for the signed-in applicant (R11, ADR-15). Checks the format, the
 * 10 MB limit, and that an expiration date is given, then stores the file and a
 * `documents` row with the same id, and keeps the required item Pending with the
 * document's expiration date. Only items the template asks the applicant to upload,
 * and only while they're Pending, can take a document.
 */
export async function uploadDocument(dataLayer: DataLayer, input: UploadInput, actor: Actor): Promise<UploadResult> {
  const user = dataLayer.getSignedInUser();
  const caregiver = user?.caregiver_id ? dataLayer.get('caregivers', user.caregiver_id) : undefined;
  if (!user || !caregiver) {
    throw new Error('Please sign in to continue your application.');
  }
  const item = dataLayer
    .list('required_items')
    .find((row) => row.caregiver_id === caregiver.id && row.item_key === input.itemKey);
  const templateItem = dataLayer
    .list('template_items')
    .find((row) => row.template_id === caregiver.template_id && row.item_key === input.itemKey);
  if (!item || !templateItem) {
    return { ok: false, errors: { file: "We couldn't find that item on your application." } };
  }
  if (templateItem.requires_upload !== 'true') {
    return { ok: false, errors: { file: "This item doesn't need an upload. We check it for you." } };
  }
  if (item.status !== 'Pending') {
    return { ok: false, errors: { file: `This document is already ${item.status}, so it can't be changed here.` } };
  }

  const errors: UploadErrors = {};
  const fileError = checkUploadFile(input.originalType, input.originalSize);
  if (fileError) {
    errors.file = fileError;
  }
  const expirationDate = input.expirationDate.trim();
  if (!expirationDate) {
    errors.expiration_date = 'Enter the expiration date shown on the document.';
  } else if (!DATE_ONLY.test(expirationDate)) {
    errors.expiration_date = 'Enter a real expiration date.';
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const documentId = `doc-${crypto.randomUUID()}`;
  const fileType = input.file.type || input.originalType;
  const meta = {
    caregiver_id: caregiver.id,
    item_key: input.itemKey,
    file_name: input.fileName,
    file_type: fileType,
    expiration_date: expirationDate,
    uploaded_at: formatLocalDateTime(dataLayer.today()),
  };
  // The file first, so a failed save never leaves a documents row without its file.
  await dataLayer.putDocument({ id: documentId, file: input.file, meta }, actor);
  dataLayer.insert('documents', { id: documentId, agency_id: caregiver.agency_id, ...meta }, actor);
  dataLayer.update(
    'required_items',
    item.id,
    { status: 'Pending', expiration_date: expirationDate, evidence: `Uploaded ${input.fileName}` },
    actor,
  );
  return { ok: true, documentId };
}
