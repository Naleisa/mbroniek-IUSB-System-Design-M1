import { CONSENT_WORDING_VERSION } from './consentWording';
import type { DataLayer } from './dataLayer';
import { transitionCaregiver } from './lifecycle';
import { formatLocalDateTime } from './relativeDates';
import type { Row } from './storageBackend';
import type { Actor, ConsentDecision, ConsentType } from './types';
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
  // R8: once there's an address to send to (or it changed), email a link back to this application.
  if (value.email !== user.email) {
    dataLayer.issueResumeLink();
  }
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

/**
 * Checks a document's expiration date (R24, ADR-15): required, a real date, and not before
 * today (`YYYY-MM-DD`). A document is still valid on its expiration date. Returns a message,
 * or '' if it's fine. The data layer refuses expired documents again on its own.
 */
export function checkExpirationDate(expirationDate: string, today: string): string {
  if (!expirationDate) {
    return 'Enter the expiration date shown on the document.';
  }
  if (!DATE_ONLY.test(expirationDate)) {
    return 'Enter a real expiration date.';
  }
  if (expirationDate < today) {
    return `This document expired on ${expirationDate}. Please upload a current one.`;
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
  const dateError = checkExpirationDate(expirationDate, formatLocalDateTime(dataLayer.today()).slice(0, 10));
  if (dateError) {
    errors.expiration_date = dateError;
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

export type ConsentResult = { ok: true; consent: Row } | { ok: false; reason: string };

/** The signed-in applicant's current consent of one type at the current wording version, if any. */
export function currentConsent(dataLayer: DataLayer, type: ConsentType): Row | undefined {
  const caregiverId = dataLayer.getSignedInUser()?.caregiver_id;
  return dataLayer
    .list('consents')
    .filter(
      (row) => row.caregiver_id === caregiverId && row.type === type && row.wording_version === CONSENT_WORDING_VERSION,
    )
    // The newest answer wins; among answers saved in the same minute, the one saved last.
    .reduce<Row | undefined>((latest, row) => (!latest || row.recorded_at >= latest.recorded_at ? row : latest), undefined);
}

/**
 * Records the applicant's answer on the disclosure or authorization screen (R3, ADR-16):
 * one consents row with the decision, the wording version shown, and the time. An
 * answer already given at this version isn't recorded twice, and authorization needs the
 * disclosure to be acknowledged first.
 */
export function recordConsent(
  dataLayer: DataLayer,
  type: ConsentType,
  decision: ConsentDecision,
  actor: Actor,
): ConsentResult {
  const caregiverId = dataLayer.getSignedInUser()?.caregiver_id;
  const caregiver = caregiverId ? dataLayer.get('caregivers', caregiverId) : undefined;
  if (!caregiver) {
    throw new Error('Please sign in to continue your application.');
  }
  if (type === 'authorization' && currentConsent(dataLayer, 'disclosure')?.decision !== 'acknowledged') {
    return { ok: false, reason: 'Please read the background check disclosure first.' };
  }
  const existing = currentConsent(dataLayer, type);
  if (existing && existing.decision === decision) {
    return { ok: true, consent: existing };
  }
  const consent = dataLayer.insert(
    'consents',
    {
      caregiver_id: caregiver.id,
      type,
      decision,
      wording_version: CONSENT_WORDING_VERSION,
      recorded_at: formatLocalDateTime(dataLayer.today()),
    },
    actor,
  );
  return { ok: true, consent };
}

/**
 * The applicant declines the background check authorization (R25, ADR-16): records the
 * decline and emails their agency's coordinators. The record is kept as it is; checks
 * can't be ordered until the applicant authorizes (see `orderCheck`).
 */
export function declineAuthorization(dataLayer: DataLayer, actor: Actor): ConsentResult {
  const result = recordConsent(dataLayer, 'authorization', 'declined', actor);
  if (!result.ok) {
    return result;
  }
  const name = dataLayer.getSignedInUser()?.display_name ?? 'An applicant';
  dataLayer.notifyMyCoordinators(
    `${name} declined background check authorization`,
    `Screening has stopped for ${name}. The application is kept.`,
  );
  return result;
}

export interface ChecklistLine {
  key: string;
  /** What's needed, such as "Your TB test result". */
  label: string;
  done: boolean;
  /** Plain-language note when it isn't done, such as "Add your TB test result." */
  todo: string;
  /** The intake step that fixes it. */
  route: string;
}

/**
 * What a complete intake needs (R7): identity details and an SSN on file, a document
 * for every item the template asks the applicant to upload, the disclosure read, and
 * the authorization given. The review screen and `submitIntake` both use this list.
 */
export function intakeChecklist(dataLayer: DataLayer): ChecklistLine[] {
  const caregiverId = dataLayer.getSignedInUser()?.caregiver_id;
  const caregiver = caregiverId ? dataLayer.get('caregivers', caregiverId) : undefined;
  if (!caregiver) {
    return [];
  }
  const identityDone = Boolean(
    caregiver.first_name &&
      caregiver.last_name &&
      caregiver.email &&
      caregiver.phone &&
      caregiver.date_of_birth &&
      caregiver.ssn_token,
  );
  const lines: ChecklistLine[] = [
    {
      key: 'identity',
      label: 'About you',
      done: identityDone,
      todo: 'Finish your details in About you.',
      route: '/applicant/intake/identity',
    },
  ];

  const documents = dataLayer.list('documents').filter((row) => row.caregiver_id === caregiver.id);
  for (const item of whatYoullNeed(dataLayer).upload) {
    lines.push({
      key: item.item_key,
      label: item.name,
      done: documents.some((document) => document.item_key === item.item_key),
      todo: `Add your ${item.name}.`,
      route: '/applicant/intake/uploads',
    });
  }

  const authorization = currentConsent(dataLayer, 'authorization')?.decision;
  lines.push(
    {
      key: 'disclosure',
      label: 'Background check disclosure',
      done: currentConsent(dataLayer, 'disclosure')?.decision === 'acknowledged',
      todo: 'Read the background check disclosure.',
      route: '/applicant/intake/disclosure',
    },
    {
      key: 'authorization',
      label: 'Authorization for background checks',
      done: authorization === 'granted',
      todo:
        authorization === 'declined'
          ? "You didn't authorize the background checks. Authorize them to submit."
          : 'Give your authorization for the background checks.',
      route: '/applicant/intake/authorization',
    },
  );
  return lines;
}

export type SubmitResult = { ok: true } | { ok: false; missing: string[] };

/**
 * Submits a complete intake (R7, ADR-08): moves the record from Intake In Progress to
 * Intake Complete as the applicant and emails the agency's coordinators. Refuses, naming
 * each missing piece, until the checklist is complete; refuses a second submission.
 */
export function submitIntake(dataLayer: DataLayer, actor: Actor): SubmitResult {
  const caregiverId = dataLayer.getSignedInUser()?.caregiver_id;
  const caregiver = caregiverId ? dataLayer.get('caregivers', caregiverId) : undefined;
  if (!caregiver) {
    throw new Error('Please sign in to continue your application.');
  }
  if (caregiver.lifecycle_state !== 'Intake In Progress') {
    return { ok: false, missing: ['Your application has already been submitted.'] };
  }
  const missing = intakeChecklist(dataLayer)
    .filter((line) => !line.done)
    .map((line) => line.todo);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const moved = transitionCaregiver(dataLayer, caregiver.id, 'Intake Complete', actor);
  if (!moved.ok) {
    return { ok: false, missing: [moved.reason] };
  }
  const name = `${caregiver.first_name} ${caregiver.last_name}`;
  const agencyName = dataLayer.get('agencies', caregiver.agency_id)?.name ?? 'the agency';
  dataLayer.notifyMyCoordinators(
    `New application: ${name}`,
    `${name} submitted a complete application to ${agencyName}. It's ready for screening.`,
  );
  return { ok: true };
}

/**
 * Where a returning applicant picks up (R8, T38): the first unfinished intake step, worked
 * out from what's saved rather than stored. Submitted applications go to the applicant page.
 */
export function resumeStep(dataLayer: DataLayer): string {
  const caregiverId = dataLayer.getSignedInUser()?.caregiver_id;
  const caregiver = caregiverId ? dataLayer.get('caregivers', caregiverId) : undefined;
  if (!caregiver || caregiver.lifecycle_state !== 'Intake In Progress') {
    return '/applicant';
  }
  const checklist = intakeChecklist(dataLayer);
  const isDone = (key: string) => checklist.find((line) => line.key === key)?.done ?? false;
  if (!isDone('identity')) {
    return '/applicant/intake/identity';
  }
  const uploadKeys = whatYoullNeed(dataLayer).upload.map((item) => item.item_key);
  const uploaded = uploadKeys.filter(isDone).length;
  if (uploaded === 0 && uploadKeys.length > 0) {
    return '/applicant/intake/needed';
  }
  if (uploaded < uploadKeys.length) {
    return '/applicant/intake/uploads';
  }
  if (!isDone('disclosure')) {
    return '/applicant/intake/disclosure';
  }
  if (!isDone('authorization')) {
    return '/applicant/intake/authorization';
  }
  return '/applicant/intake/review';
}
