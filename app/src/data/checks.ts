import { createSystemDataLayer, type DataLayer } from './dataLayer';
import { checkEligibility, transitionCaregiver } from './lifecycle';
import { coordinatorsOf, sendEmail } from './notifications';
import { formatLocalDateTime } from './relativeDates';
import type { Row, StorageBackend } from './storageBackend';
import type { Actor } from './types';
import { createVendorVault } from './vault';
import {
  createMockBackgroundCheck,
  createMockExclusionCheck,
  createMockRegistryCheck,
  type ExclusionList,
  type VendorAdapter,
  type VendorResult,
} from './vendors';

const SYSTEM: Actor = { role: 'system', name: 'CareMatch' };

/**
 * Items in these statuses can be ordered: a first order, a retry after a failure (R21), or
 * a new order for a check the vendor never answered (Delayed, T43). Earlier orders stay on file.
 */
const ORDERABLE_STATUSES = ['Pending', 'Retryable', 'Delayed'];

/**
 * How long a verified background or exclusion check stays current. A demo assumption
 * until real rules are set (Spec Q1). Registry results keep the certificate's own date.
 */
const CHECK_VALID_DAYS = 365;

export type OrderCheckResult = { ok: true; result: Promise<VendorResult> } | { ok: false; reason: string };

function mockVendorDelaySeconds(backend: StorageBackend): number {
  const settings = backend.readTable('settings');
  return Number(settings.find((row) => row.key === 'mock_vendor_delay_seconds')?.value) || 10;
}

/** Creates the mock background check vendor with the vault reader and the delay from settings (ADR-11, ADR-12). */
export function createBackgroundCheckVendor(backend: StorageBackend): VendorAdapter {
  return createMockBackgroundCheck(createVendorVault(backend), mockVendorDelaySeconds(backend));
}

/** Creates the mock OIG or SAM exclusion vendor with the vault reader and the delay from settings (R19, ADR-12). */
export function createExclusionCheckVendor(backend: StorageBackend, list: ExclusionList): VendorAdapter {
  return createMockExclusionCheck(createVendorVault(backend), mockVendorDelaySeconds(backend), list);
}

/**
 * Creates the mock state registry vendor (R26). Whether the registry is available comes
 * from the `state_registry_available` setting, so it can be changed without a code change.
 */
export function createRegistryCheckVendor(backend: StorageBackend): VendorAdapter {
  const settings = backend.readTable('settings');
  const isAvailable = settings.find((row) => row.key === 'state_registry_available')?.value !== 'false';
  return createMockRegistryCheck(createVendorVault(backend), mockVendorDelaySeconds(backend), isAvailable);
}

/** The caregiver's most recent authorization answer, if any. A later answer replaces an earlier one. */
export function latestAuthorization(dataLayer: DataLayer, caregiverId: string): Row | undefined {
  return dataLayer
    .list('consents')
    .filter((row) => row.caregiver_id === caregiverId && row.type === 'authorization')
    // The newest answer wins; among answers saved in the same minute, the one saved last.
    .reduce<Row | undefined>((latest, row) => (!latest || row.recorded_at >= latest.recorded_at ? row : latest), undefined);
}

/**
 * Orders a check for one required item (R9). The item moves to Ordered right away.
 * When the vendor answers, the result is recorded as CareMatch through the system
 * data layer, since the coordinator may have signed out by then (R10, R21).
 */
export function orderCheck(
  dataLayer: DataLayer,
  systemDataLayer: DataLayer,
  vendor: VendorAdapter,
  requiredItemId: string,
  actor: Actor,
): OrderCheckResult {
  const item = dataLayer.get('required_items', requiredItemId);
  const caregiver = item && dataLayer.get('caregivers', item.caregiver_id);
  if (!item || !caregiver) {
    return { ok: false, reason: 'We could not find that item.' };
  }
  if (!ORDERABLE_STATUSES.includes(item.status)) {
    return { ok: false, reason: `This check can't be ordered while it is ${item.status}.` };
  }
  // Screening needs the applicant's authorization; a decline stops it (R25, ADR-16).
  const authorization = latestAuthorization(dataLayer, caregiver.id);
  if (authorization?.decision !== 'granted') {
    const name = `${caregiver.first_name} ${caregiver.last_name}`.trim() || 'This applicant';
    return {
      ok: false,
      reason:
        authorization?.decision === 'declined'
          ? `Checks can't be ordered: ${name} declined authorization.`
          : `Checks can't be ordered: ${name} hasn't given authorization yet.`,
    };
  }
  if (caregiver.lifecycle_state === 'Intake In Progress') {
    return { ok: false, reason: 'Checks can be ordered once the application is submitted.' };
  }

  const orderedAt = formatLocalDateTime(dataLayer.today());
  dataLayer.update('required_items', item.id, { status: 'Ordered', ordered_at: orderedAt, result: '', notes: '' }, actor);
  const order = dataLayer.insert(
    'check_orders',
    { required_item_id: item.id, caregiver_id: caregiver.id, source: item.source, ordered_at: orderedAt, completed_at: '', result: '' },
    actor,
  );

  // The first check ordered on a submitted application starts screening (Scenario 2, step 4).
  if (caregiver.lifecycle_state === 'Intake Complete') {
    transitionCaregiver(dataLayer, caregiver.id, 'Screening In Progress', actor);
  }

  const result = vendor.order({ caregiver_id: caregiver.id, ssn_token: caregiver.ssn_token }).then((vendorResult) => {
    recordResult(systemDataLayer, item.id, order.id, vendorResult);
    return vendorResult;
  });
  return { ok: true, result };
}

/**
 * Attaches a vendor result to the item and its order and notifies the coordinators (R10).
 * A clean result checks eligibility (R12), a failure leaves the order retryable (R21),
 * an exclusion match sends the record to Review Required (R19), and an unavailable
 * registry leaves the item for a manual verification (R26).
 */
function recordResult(systemDataLayer: DataLayer, itemId: string, orderId: string, vendorResult: VendorResult): void {
  const now = systemDataLayer.today();
  const completedAt = formatLocalDateTime(now);
  const item = systemDataLayer.get('required_items', itemId);
  const caregiver = item && systemDataLayer.get('caregivers', item.caregiver_id);
  if (!item || !caregiver) {
    return;
  }

  const resultLabel = vendorResult.label;
  if (vendorResult.outcome === 'clear') {
    // A registry lookup confirms the uploaded certificate, so it keeps that certificate's expiration date.
    const isRegistry = item.method === 'Registry lookup';
    const expires = new Date(now);
    expires.setDate(expires.getDate() + CHECK_VALID_DAYS);
    systemDataLayer.update(
      'required_items',
      itemId,
      {
        status: 'Verified',
        verified_date: completedAt.slice(0, 10),
        expiration_date: isRegistry ? item.expiration_date : formatLocalDateTime(expires).slice(0, 10),
        result: resultLabel,
        evidence: `Mock ${isRegistry ? 'registry' : 'vendor'} result ${vendorResult.reference}`,
        notes: '',
      },
      SYSTEM,
    );
  } else if (vendorResult.outcome === 'failure') {
    systemDataLayer.update(
      'required_items',
      itemId,
      { status: 'Retryable', result: resultLabel, notes: vendorResult.detail },
      SYSTEM,
    );
  } else {
    systemDataLayer.update(
      'required_items',
      itemId,
      { status: 'Manual Verification', result: resultLabel, notes: vendorResult.detail },
      SYSTEM,
    );
    if (vendorResult.outcome === 'match') {
      transitionCaregiver(systemDataLayer, caregiver.id, 'Review Required', SYSTEM);
    }
  }
  systemDataLayer.update('check_orders', orderId, { completed_at: completedAt, result: resultLabel }, SYSTEM);

  const itemName =
    systemDataLayer.list('template_items').find((templateItem) => templateItem.item_key === item.item_key)?.name ??
    item.item_key;
  const caregiverName = `${caregiver.first_name} ${caregiver.last_name}`;
  for (const coordinator of coordinatorsOf(systemDataLayer, caregiver.agency_id)) {
    sendEmail(
      systemDataLayer,
      {
        recipient_user_id: coordinator.id,
        agency_id: caregiver.agency_id,
        caregiver_id: caregiver.id,
        subject: `${itemName} result for ${caregiverName}: ${resultLabel}`,
        body: {
          clear: `${vendorResult.vendor} returned ${resultLabel} for ${caregiverName}. The item is now Verified.`,
          failure: `${vendorResult.vendor} could not complete the check for ${caregiverName}. Order it again from their record.`,
          match: `${vendorResult.vendor} found a possible match for ${caregiverName}. A coordinator needs to review the record.`,
          unavailable: `${vendorResult.vendor} is unavailable, so ${itemName} for ${caregiverName} needs to be verified by hand.`,
        }[vendorResult.outcome],
      },
      now,
    );
  }

  if (vendorResult.outcome === 'clear') {
    checkEligibility(systemDataLayer, caregiver.id);
  }
}

export interface ManualVerification {
  /** What the coordinator checked, such as "Called the state registry; certificate 12345 is active." */
  note: string;
  /** The item's expiration date as YYYY-MM-DD. Required so the item can expire (R14, C2). */
  expirationDate: string;
}

export type VerifyManuallyResult = { ok: true; item: Row } | { ok: false; reason: string };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Lets a coordinator verify an item in Manual Verification by hand: an unavailable
 * registry (R26), an unreadable document (R22), or a reviewed exclusion match (T46).
 * The item keeps its source; the method, the coordinator's note, and the dates are
 * recorded so the compliance report shows exactly how it was verified (R2, C1).
 */
export function verifyManually(
  dataLayer: DataLayer,
  requiredItemId: string,
  verification: ManualVerification,
  actor: Actor,
): VerifyManuallyResult {
  if (actor.role !== 'coordinator') {
    return { ok: false, reason: 'Only a coordinator can verify an item by hand.' };
  }
  const item = dataLayer.get('required_items', requiredItemId);
  if (!item) {
    return { ok: false, reason: 'We could not find that item.' };
  }
  if (item.status !== 'Manual Verification') {
    return { ok: false, reason: `Only items in Manual Verification can be verified by hand. This one is ${item.status}.` };
  }
  const note = verification.note.trim();
  if (!note) {
    return { ok: false, reason: 'Describe what you checked before marking this verified.' };
  }
  const today = formatLocalDateTime(dataLayer.today()).slice(0, 10);
  if (!isRealDate(verification.expirationDate)) {
    return { ok: false, reason: 'Enter the expiration date as a real date (YYYY-MM-DD).' };
  }
  if (verification.expirationDate < today) {
    return { ok: false, reason: 'That expiration date has already passed, so this item cannot be marked verified.' };
  }

  const updated = dataLayer.update(
    'required_items',
    item.id,
    {
      status: 'Verified',
      method: 'Manual verification',
      verified_date: today,
      expiration_date: verification.expirationDate,
      result: 'Verified by hand',
      evidence: note,
      notes: '',
    },
    actor,
  );
  checkEligibility(dataLayer, item.caregiver_id);
  return { ok: true, item: updated };
}

export interface CheckService {
  /** Orders the vendor check for one required item, picking the vendor from the item's method. */
  order(requiredItemId: string, actor: Actor): OrderCheckResult;
}

/**
 * The one way screens order checks (T43). It keeps the system data layer, which records
 * vendor results as CareMatch, away from screens; screens pass only their own data layer.
 */
export function createCheckService(backend: StorageBackend, dataLayer: DataLayer): CheckService {
  const systemDataLayer = createSystemDataLayer(backend);
  return {
    order: (requiredItemId, actor) => {
      const item = dataLayer.get('required_items', requiredItemId);
      if (!item) {
        return { ok: false, reason: 'We could not find that item.' };
      }
      const vendor = vendorForItem(backend, item);
      if (!vendor) {
        return { ok: false, reason: "This item isn't checked by a vendor." };
      }
      return orderCheck(dataLayer, systemDataLayer, vendor, requiredItemId, actor);
    },
  };
}

/** The mock vendor that checks an item, from its verification method (ADR-01), or undefined for uploads. */
export function vendorForItem(backend: StorageBackend, item: Row): VendorAdapter | undefined {
  switch (item.method) {
    case 'Background check':
      return createBackgroundCheckVendor(backend);
    case 'Exclusion screening':
      return createExclusionCheckVendor(backend, item.item_key.startsWith('sam') ? 'SAM' : 'OIG');
    case 'Registry lookup':
      return createRegistryCheckVendor(backend);
    default:
      return undefined;
  }
}

export type ReviewResult = { ok: true; item: Row } | { ok: false; reason: string };

/** The newest document uploaded for a caregiver's item, if any. */
export function latestDocumentFor(dataLayer: DataLayer, caregiverId: string, itemKey: string): Row | undefined {
  return dataLayer
    .list('documents')
    .filter((row) => row.caregiver_id === caregiverId && row.item_key === itemKey)
    .reduce<Row | undefined>((latest, row) => (!latest || row.uploaded_at >= latest.uploaded_at ? row : latest), undefined);
}

/** Checks that a coordinator is reviewing a Pending item that has a document; returns the item and document. */
function pendingDocumentItem(
  dataLayer: DataLayer,
  requiredItemId: string,
  actor: Actor,
): { ok: true; item: Row; document: Row } | { ok: false; reason: string } {
  if (actor.role !== 'coordinator') {
    return { ok: false, reason: 'Only a coordinator can review documents.' };
  }
  const item = dataLayer.get('required_items', requiredItemId);
  if (!item) {
    return { ok: false, reason: 'We could not find that item.' };
  }
  if (item.status !== 'Pending') {
    return { ok: false, reason: `Only a Pending document can be reviewed. This one is ${item.status}.` };
  }
  const document = latestDocumentFor(dataLayer, item.caregiver_id, item.item_key);
  if (!document) {
    return { ok: false, reason: 'Nothing has been uploaded for this item yet.' };
  }
  return { ok: true, item, document };
}

/**
 * A coordinator marks an uploaded document verified after reviewing it (T44, R2). The item
 * keeps its "Document review" method and the expiration date entered at upload, and gets
 * today's verification date; then eligibility is checked (R12).
 */
export function verifyDocument(dataLayer: DataLayer, requiredItemId: string, actor: Actor): ReviewResult {
  const found = pendingDocumentItem(dataLayer, requiredItemId, actor);
  if (!found.ok) {
    return found;
  }
  const expirationDate = found.item.expiration_date || found.document.expiration_date;
  if (!expirationDate) {
    return { ok: false, reason: 'This document has no expiration date, so it cannot be marked verified.' };
  }
  const updated = dataLayer.update(
    'required_items',
    found.item.id,
    {
      status: 'Verified',
      verified_date: formatLocalDateTime(dataLayer.today()).slice(0, 10),
      expiration_date: expirationDate,
      evidence: `Reviewed ${found.document.file_name}`,
      notes: '',
    },
    actor,
  );
  checkEligibility(dataLayer, found.item.caregiver_id);
  return { ok: true, item: updated };
}

/**
 * A coordinator marks an uploaded document unreadable (T44, R22, ADR-15): the item goes to
 * Manual Verification instead of being dropped or advanced, to be verified by hand.
 */
export function markUnreadable(dataLayer: DataLayer, requiredItemId: string, actor: Actor): ReviewResult {
  const found = pendingDocumentItem(dataLayer, requiredItemId, actor);
  if (!found.ok) {
    return found;
  }
  const updated = dataLayer.update(
    'required_items',
    found.item.id,
    { status: 'Manual Verification', notes: "The document couldn't be read. Verify it by hand." },
    actor,
  );
  return { ok: true, item: updated };
}

/** Exclusion results a coordinator still has to decide, and the result recorded once a match is confirmed (T46). */
export const POSSIBLE_MATCH = 'Possible match';
export const CONFIRMED_MATCH = 'Confirmed match';

export type ExclusionDecision = 'not-a-match' | 'confirm-match';

/**
 * A coordinator's decision on an exclusion match (T46, R17, R19, C1). Nothing automated can
 * do this. "Not a match" moves the record back to Screening In Progress and verifies each
 * matched item by hand with the coordinator's note (T64), then checks eligibility.
 * "Confirm the match" leaves the record in Review Required and records the decision on
 * each matched item. Either way the change is audited under the coordinator.
 */
export function reviewExclusionMatch(
  dataLayer: DataLayer,
  caregiverId: string,
  decision: ExclusionDecision,
  details: { note: string; expirationDate?: string },
  actor: Actor,
): ReviewResult {
  if (actor.role !== 'coordinator') {
    return { ok: false, reason: 'Only a coordinator can review an exclusion match.' };
  }
  const caregiver = dataLayer.get('caregivers', caregiverId);
  if (!caregiver) {
    return { ok: false, reason: 'We could not find that caregiver record.' };
  }
  if (caregiver.lifecycle_state !== 'Review Required') {
    return { ok: false, reason: 'Only a record in Review Required has a match to review.' };
  }
  const matched = dataLayer
    .list('required_items')
    .filter((item) => item.caregiver_id === caregiverId && item.result === POSSIBLE_MATCH);
  if (matched.length === 0) {
    return { ok: false, reason: 'There is no possible match left to review on this record.' };
  }
  const note = details.note.trim();
  if (!note) {
    return {
      ok: false,
      reason:
        decision === 'not-a-match'
          ? 'Describe how you confirmed it is not a match.'
          : 'Describe why you are confirming the match.',
    };
  }

  if (decision === 'confirm-match') {
    const today = formatLocalDateTime(dataLayer.today()).slice(0, 10);
    let last: Row | undefined;
    for (const item of matched) {
      last = dataLayer.update(
        'required_items',
        item.id,
        { result: CONFIRMED_MATCH, notes: `Confirmed as a match by ${actor.name} on ${today}: ${note}` },
        actor,
      );
    }
    return { ok: true, item: last! };
  }

  // Check the expiration date before anything moves, so a refusal leaves the record as it was.
  const expirationDate = (details.expirationDate ?? '').trim();
  const today = formatLocalDateTime(dataLayer.today()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationDate) || expirationDate < today) {
    return { ok: false, reason: 'Enter a future expiration date for the exclusion check.' };
  }
  const moved = transitionCaregiver(dataLayer, caregiverId, 'Screening In Progress', actor);
  if (!moved.ok) {
    return moved;
  }
  let last: Row | undefined;
  for (const item of matched) {
    const verified = verifyManually(dataLayer, item.id, { note, expirationDate }, actor);
    if (!verified.ok) {
      return verified;
    }
    last = verified.item;
  }
  return { ok: true, item: last! };
}

/**
 * A coordinator verifies an uploaded replacement (T48, Scenario 3 steps 5 and 6, ADR-19). The
 * item becomes current again with the replacement's expiration date and keeps its original
 * verification method, and the request is closed. The record's state doesn't change: a
 * Cleared record stays Cleared, and a Not Current one waits for the coordinator to mark it
 * Cleared (T45).
 */
export function verifyReplacement(dataLayer: DataLayer, requestId: string, actor: Actor): ReviewResult {
  if (actor.role !== 'coordinator') {
    return { ok: false, reason: 'Only a coordinator can verify a replacement.' };
  }
  const request = dataLayer.get('replacement_requests', requestId);
  if (!request) {
    return { ok: false, reason: 'We could not find that replacement request.' };
  }
  if (request.status !== 'Submitted') {
    return { ok: false, reason: 'Only an uploaded replacement can be verified.' };
  }
  const document = request.document_id ? dataLayer.get('documents', request.document_id) : undefined;
  const item = dataLayer
    .list('required_items')
    .find((row) => row.caregiver_id === request.caregiver_id && row.item_key === request.item_key);
  if (!document || !item) {
    return { ok: false, reason: 'The uploaded replacement could not be found.' };
  }

  const today = formatLocalDateTime(dataLayer.today()).slice(0, 10);
  const updated = dataLayer.update(
    'required_items',
    item.id,
    {
      status: 'Verified',
      verified_date: today,
      expiration_date: document.expiration_date,
      evidence: `Reviewed replacement ${document.file_name}`,
      notes: '',
    },
    actor,
  );
  dataLayer.update('replacement_requests', request.id, { status: 'Verified', reviewed_at: today }, actor);
  return { ok: true, item: updated };
}
