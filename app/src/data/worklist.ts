import type { DataLayer } from './dataLayer';
import { sendEmail, sendSms } from './notifications';
import { formatLocalDateTime } from './relativeDates';
import type { Row } from './storageBackend';
import type { Actor } from './types';

/**
 * The expiration worklist (T47, R15, C6, Scenario 3). Read through the coordinator's own
 * data layer, so only their agency's items appear (R4).
 */

export interface WorklistRow {
  itemId: string;
  caregiverId: string;
  caregiverName: string;
  itemName: string;
  status: 'Expiring' | 'Expired';
  expirationDate: string;
  /** "in 20 days", "today", or "5 days ago". */
  when: string;
  /** The open replacement request, if any: Requested (with its due date) or Submitted. */
  replacement?: { status: string; dueDate: string };
}

export interface Worklist {
  expiring: WorklistRow[];
  expired: WorklistRow[];
}

/** Days after an Expired item is asked for that its replacement is due. */
const EXPIRED_REPLACEMENT_DAYS = 14;

const OPEN_REQUEST_STATUSES = ['Requested', 'Submitted'];

function dayNumber(date: string): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return Math.round(new Date(year, month - 1, day).getTime() / 86_400_000);
}

function when(expirationDate: string, today: string): string {
  const days = dayNumber(expirationDate) - dayNumber(today);
  if (days === 0) {
    return 'today';
  }
  if (days > 0) {
    return `in ${days} day${days === 1 ? '' : 's'}`;
  }
  return `${-days} day${days === -1 ? '' : 's'} ago`;
}

function openRequest(dataLayer: DataLayer, caregiverId: string, itemKey: string): Row | undefined {
  return dataLayer
    .list('replacement_requests')
    .find(
      (row) => row.caregiver_id === caregiverId && row.item_key === itemKey && OPEN_REQUEST_STATUSES.includes(row.status),
    );
}

/** Every Expiring and Expired item in the coordinator's agency, soonest first, with any open replacement request. */
export function expirationWorklist(dataLayer: DataLayer): Worklist {
  const today = formatLocalDateTime(dataLayer.today()).slice(0, 10);
  const caregivers = dataLayer.list('caregivers');
  const templateItems = dataLayer.list('template_items');

  const rows: WorklistRow[] = dataLayer
    .list('required_items')
    .filter((item) => item.status === 'Expiring' || item.status === 'Expired')
    .flatMap((item) => {
      const caregiver = caregivers.find((row) => row.id === item.caregiver_id);
      if (!caregiver) {
        return [];
      }
      const request = openRequest(dataLayer, caregiver.id, item.item_key);
      return [
        {
          itemId: item.id,
          caregiverId: caregiver.id,
          caregiverName: `${caregiver.first_name} ${caregiver.last_name}`.trim() || 'New applicant',
          itemName: templateItems.find((row) => row.item_key === item.item_key)?.name ?? item.item_key,
          status: item.status as WorklistRow['status'],
          expirationDate: item.expiration_date,
          when: when(item.expiration_date, today),
          replacement: request ? { status: request.status, dueDate: request.due_date } : undefined,
        },
      ];
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));

  return {
    expiring: rows.filter((row) => row.status === 'Expiring'),
    expired: rows.filter((row) => row.status === 'Expired'),
  };
}

export type RequestReplacementResult = { ok: true; request: Row } | { ok: false; reason: string };

/**
 * A coordinator asks the caregiver for a replacement (T47, Scenario 3, step 4): a Requested
 * replacement request due on the item's expiration date (or in 14 days if it has already
 * expired), plus an email and a text to the caregiver through the notification service.
 */
export function requestReplacement(dataLayer: DataLayer, requiredItemId: string, actor: Actor): RequestReplacementResult {
  const user = dataLayer.getSignedInUser();
  if (actor.role !== 'coordinator' || user?.role !== 'coordinator') {
    return { ok: false, reason: 'Only a coordinator can request a replacement.' };
  }
  const item = dataLayer.get('required_items', requiredItemId);
  const caregiver = item && dataLayer.get('caregivers', item.caregiver_id);
  if (!item || !caregiver) {
    return { ok: false, reason: 'We could not find that item.' };
  }
  if (item.status !== 'Expiring' && item.status !== 'Expired') {
    return { ok: false, reason: 'Only an expiring or expired item needs a replacement.' };
  }
  if (openRequest(dataLayer, caregiver.id, item.item_key)) {
    return { ok: false, reason: 'A replacement has already been requested for this item.' };
  }

  const now = dataLayer.today();
  const today = formatLocalDateTime(now).slice(0, 10);
  let dueDate = item.expiration_date;
  if (item.status === 'Expired' || !dueDate || dueDate < today) {
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + EXPIRED_REPLACEMENT_DAYS);
    dueDate = formatLocalDateTime(due).slice(0, 10);
  }
  const request = dataLayer.insert(
    'replacement_requests',
    {
      caregiver_id: caregiver.id,
      item_key: item.item_key,
      requested_at: formatLocalDateTime(now),
      due_date: dueDate,
      status: 'Requested',
      requested_by: user.id,
    },
    actor,
  );

  const applicant = dataLayer.list('users').find((row) => row.caregiver_id === caregiver.id);
  if (applicant) {
    const itemName = dataLayer.list('template_items').find((row) => row.item_key === item.item_key)?.name ?? item.item_key;
    const agencyName = dataLayer.get('agencies', caregiver.agency_id)?.name ?? 'Your agency';
    const message = {
      recipient_user_id: applicant.id,
      agency_id: caregiver.agency_id,
      caregiver_id: caregiver.id,
    };
    sendEmail(
      dataLayer,
      {
        ...message,
        subject: `Please replace your ${itemName}`,
        body: `${agencyName} needs a new ${itemName} by ${dueDate}. Sign in to CareMatch to upload it.`,
      },
      now,
    );
    sendSms(dataLayer, { ...message, body: `CareMatch: ${agencyName} needs a new ${itemName} by ${dueDate}.` }, now);
  }
  return { ok: true, request };
}
