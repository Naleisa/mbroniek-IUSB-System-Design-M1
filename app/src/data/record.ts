import { latestAuthorization, latestDocumentFor } from './checks';
import type { DataLayer } from './dataLayer';

/**
 * The coordinator's view of one caregiver record (T42, Scenario 2). Read through the
 * coordinator's own data layer, so another agency's record is simply not found (R4).
 */

export interface RecordItem {
  /** The required item's id, or '' when it's missing. */
  id: string;
  item_key: string;
  name: string;
  /** Item status, or "Missing" when the template item has no record. */
  status: string;
  source: string;
  method: string;
  ordered_at: string;
  verified_date: string;
  expiration_date: string;
  result: string;
  evidence: string;
  notes: string;
  /** For Ordered and Delayed checks: how long it's been waiting (R16). */
  elapsed: string;
  /** The order action for a vendor check in an orderable status (T43): Order check, Retry, or Order again. */
  orderAction: string;
  /** The newest uploaded document for this item, if any (T44). */
  document?: { id: string; file_name: string; file_type: string; expiration_date: string; uploaded_at: string };
  /** A Pending document review item with a document: can be marked verified or unreadable (T44). */
  reviewable: boolean;
  /** In Manual Verification and not a possible exclusion match (T46 decides those): can be verified by hand (T44, T64). */
  canVerifyByHand: boolean;
}

export interface CaregiverRecord {
  id: string;
  name: string;
  lifecycleState: string;
  /** When the record entered its current state. */
  stateChangedAt: string;
  email: string;
  phone: string;
  ssnLast4: string;
  templateName: string;
  templateIsSample: boolean;
  templateNote: string;
  /** "Granted on 2026-09-26", "Declined on …", or "Not given yet". */
  authorization: string;
  authorizationDeclined: boolean;
  /** An open replacement request, in plain words, if any. */
  replacement: string;
  items: RecordItem[];
}

/** Methods a mock vendor carries out (T43); the rest are document reviews. */
const VENDOR_METHODS = ['Background check', 'Exclusion screening', 'Registry lookup'];

/** The order button each orderable status gets (T43). */
const ORDER_ACTIONS: Record<string, string> = { Pending: 'Order check', Retryable: 'Retry', Delayed: 'Order again' };

function daysSince(date: string, today: Date): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function orderedAgo(days: number): string {
  return days === 0 ? 'Ordered today' : `Ordered ${days} day${days === 1 ? '' : 's'} ago`;
}

/** Everything the record view shows for one caregiver, or undefined if this coordinator can't see it. */
export function caregiverRecord(dataLayer: DataLayer, caregiverId: string): CaregiverRecord | undefined {
  const caregiver = dataLayer.get('caregivers', caregiverId);
  if (!caregiver) {
    return undefined;
  }
  const today = dataLayer.today();
  const template = dataLayer.get('requirement_templates', caregiver.template_id);
  const templateItems = dataLayer
    .list('template_items')
    .filter((item) => item.template_id === caregiver.template_id)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const requiredItems = dataLayer.list('required_items').filter((item) => item.caregiver_id === caregiver.id);

  const items: RecordItem[] = templateItems.map((templateItem) => {
    const item = requiredItems.find((row) => row.item_key === templateItem.item_key);
    if (!item) {
      return {
        id: '',
        item_key: templateItem.item_key,
        name: templateItem.name,
        status: 'Missing',
        source: templateItem.source,
        method: templateItem.method,
        ordered_at: '',
        verified_date: '',
        expiration_date: '',
        result: '',
        evidence: '',
        notes: '',
        elapsed: '',
        orderAction: '',
        reviewable: false,
        canVerifyByHand: false,
      };
    }
    const latest = latestDocumentFor(dataLayer, caregiver.id, item.item_key);
    const document = latest
      ? {
          id: latest.id,
          file_name: latest.file_name,
          file_type: latest.file_type,
          expiration_date: latest.expiration_date,
          uploaded_at: latest.uploaded_at,
        }
      : undefined;
    const outstanding = item.status === 'Ordered' || item.status === 'Delayed';
    return {
      id: item.id,
      item_key: item.item_key,
      name: templateItem.name,
      status: item.status,
      source: item.source,
      method: item.method,
      ordered_at: item.ordered_at,
      verified_date: item.verified_date,
      expiration_date: item.expiration_date,
      result: item.result,
      evidence: item.evidence,
      notes: item.notes,
      elapsed: outstanding && item.ordered_at ? orderedAgo(daysSince(item.ordered_at, today)) : '',
      orderAction: VENDOR_METHODS.includes(item.method) ? (ORDER_ACTIONS[item.status] ?? '') : '',
      document,
      reviewable: item.method === 'Document review' && item.status === 'Pending' && Boolean(document),
      canVerifyByHand: item.status === 'Manual Verification' && item.result !== 'Possible match',
    };
  });

  const authorization = latestAuthorization(dataLayer, caregiver.id);
  const request = dataLayer
    .list('replacement_requests')
    .filter((row) => row.caregiver_id === caregiver.id && (row.status === 'Requested' || row.status === 'Submitted'))[0];
  const requestName = request ? (templateItems.find((row) => row.item_key === request.item_key)?.name ?? request.item_key) : '';

  return {
    id: caregiver.id,
    name: `${caregiver.first_name} ${caregiver.last_name}`.trim() || 'New applicant',
    lifecycleState: caregiver.lifecycle_state,
    stateChangedAt: caregiver.state_changed_at ?? '',
    email: caregiver.email,
    phone: caregiver.phone,
    ssnLast4: caregiver.ssn_last4 ?? '',
    templateName: template?.name ?? '',
    templateIsSample: template?.is_sample === 'true',
    templateNote: template?.sample_note ?? '',
    authorization: authorization
      ? `${authorization.decision === 'granted' ? 'Granted' : 'Declined'} on ${authorization.recorded_at.slice(0, 10)}`
      : 'Not given yet',
    authorizationDeclined: authorization?.decision === 'declined',
    replacement: !request
      ? ''
      : request.status === 'Requested'
        ? `Replacement requested for ${requestName}, due ${request.due_date}`
        : `Replacement for ${requestName} uploaded on ${request.submitted_at.slice(0, 10)}, waiting on review`,
    items,
  };
}
