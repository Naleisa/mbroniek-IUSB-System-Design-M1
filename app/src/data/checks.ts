import type { DataLayer } from './dataLayer';
import { checkEligibility, transitionCaregiver } from './lifecycle';
import { formatLocalDateTime } from './relativeDates';
import type { Row, StorageBackend } from './storageBackend';
import type { Actor } from './types';
import { createVendorVault } from './vault';
import {
  createMockBackgroundCheck,
  createMockExclusionCheck,
  type ExclusionList,
  type VendorAdapter,
  type VendorResult,
} from './vendors';

const SYSTEM: Actor = { role: 'system', name: 'CareMatch' };

/** Items in these statuses can be ordered: a first order, or a retry after a failure (R21). */
const ORDERABLE_STATUSES = ['Pending', 'Retryable'];

/** How long a verified check stays current. A demo assumption until real rules are set (Spec Q1). */
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

  const orderedAt = formatLocalDateTime(new Date());
  dataLayer.update('required_items', item.id, { status: 'Ordered', ordered_at: orderedAt, result: '', notes: '' }, actor);
  const order = dataLayer.insert(
    'check_orders',
    { required_item_id: item.id, caregiver_id: caregiver.id, source: item.source, ordered_at: orderedAt, completed_at: '', result: '' },
    actor,
  );

  const result = vendor.order({ caregiver_id: caregiver.id, ssn_token: caregiver.ssn_token }).then((vendorResult) => {
    recordResult(systemDataLayer, item.id, order.id, vendorResult);
    return vendorResult;
  });
  return { ok: true, result };
}

/**
 * Attaches a vendor result to the item and its order and notifies the coordinators (R10).
 * A Clear checks eligibility (R12), a failure leaves the order retryable (R21), and an
 * exclusion match sends the record to Review Required (R19).
 */
function recordResult(systemDataLayer: DataLayer, itemId: string, orderId: string, vendorResult: VendorResult): void {
  const now = new Date();
  const completedAt = formatLocalDateTime(now);
  const item = systemDataLayer.get('required_items', itemId);
  const caregiver = item && systemDataLayer.get('caregivers', item.caregiver_id);
  if (!item || !caregiver) {
    return;
  }

  let resultLabel: string;
  if (vendorResult.outcome === 'clear') {
    const expires = new Date(now);
    expires.setDate(expires.getDate() + CHECK_VALID_DAYS);
    resultLabel = 'Clear';
    systemDataLayer.update(
      'required_items',
      itemId,
      {
        status: 'Verified',
        verified_date: completedAt.slice(0, 10),
        expiration_date: formatLocalDateTime(expires).slice(0, 10),
        result: resultLabel,
        evidence: `Mock vendor result ${vendorResult.reference}`,
        notes: '',
      },
      SYSTEM,
    );
  } else if (vendorResult.outcome === 'failure') {
    resultLabel = 'Vendor failure';
    systemDataLayer.update(
      'required_items',
      itemId,
      { status: 'Retryable', result: resultLabel, notes: vendorResult.detail },
      SYSTEM,
    );
  } else {
    resultLabel = 'Possible match';
    systemDataLayer.update(
      'required_items',
      itemId,
      { status: 'Manual Verification', result: resultLabel, notes: vendorResult.detail },
      SYSTEM,
    );
    transitionCaregiver(systemDataLayer, caregiver.id, 'Review Required', SYSTEM);
  }
  systemDataLayer.update('check_orders', orderId, { completed_at: completedAt, result: resultLabel }, SYSTEM);

  const itemName =
    systemDataLayer.list('template_items').find((templateItem) => templateItem.item_key === item.item_key)?.name ??
    item.item_key;
  const caregiverName = `${caregiver.first_name} ${caregiver.last_name}`;
  const coordinators = systemDataLayer
    .list('users')
    .filter((user) => user.role === 'coordinator' && user.agency_id === caregiver.agency_id);
  for (const coordinator of coordinators) {
    const notification: Row = {
      agency_id: caregiver.agency_id,
      recipient_user_id: coordinator.id,
      caregiver_id: caregiver.id,
      channel: 'email',
      subject: `${itemName} result for ${caregiverName}: ${resultLabel}`,
      body: {
        clear: `${vendorResult.vendor} returned Clear for ${caregiverName}. The item is now Verified.`,
        failure: `${vendorResult.vendor} could not complete the check for ${caregiverName}. Order it again from their record.`,
        match: `${vendorResult.vendor} found a possible match for ${caregiverName}. A coordinator needs to review the record.`,
      }[vendorResult.outcome],
      created_at: completedAt,
    };
    systemDataLayer.insert('notifications', notification, SYSTEM);
  }

  if (vendorResult.outcome === 'clear') {
    checkEligibility(systemDataLayer, caregiver.id);
  }
}
