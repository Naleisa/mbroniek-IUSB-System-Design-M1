import type { DataLayer } from './dataLayer';
import { formatLocalDateTime } from './relativeDates';
import type { Row } from './storageBackend';
import type { Actor } from './types';

/*
 * Scheduled jobs (ADR-13). There is no server, so each job runs in the browser when
 * the app loads and whenever the demo date changes (T60). Jobs take "today" as an
 * input and write as CareMatch through the system data layer, so every change is audited.
 */

const SYSTEM: Actor = { role: 'system', name: 'CareMatch' };

function readSetting(systemDataLayer: DataLayer, key: string, fallback: number): number {
  const value = systemDataLayer.list('settings').find((row) => row.key === key)?.value;
  return Number(value) || fallback;
}

/** Reads the date part of `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` as a local date. */
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Counts weekdays after `from` up to and including `to`. Weekends don't count; no holidays are defined. */
export function businessDaysBetween(from: Date, to: Date): number {
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  let count = 0;
  while (day < end) {
    day.setDate(day.getDate() + 1);
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) {
      count += 1;
    }
  }
  return count;
}

/**
 * Marks an outstanding check Delayed once more than the configured number of business
 * days have passed since it was ordered (R20). If the demo date moves back so a Delayed
 * check is under the threshold again, it returns to Ordered. Returns the changed item ids.
 */
export function runDelayedCheckJob(systemDataLayer: DataLayer, today: Date): string[] {
  const threshold = readSetting(systemDataLayer, 'delayed_threshold_business_days', 3);
  const changed: string[] = [];

  for (const item of systemDataLayer.list('required_items')) {
    if ((item.status !== 'Ordered' && item.status !== 'Delayed') || !item.ordered_at) {
      continue;
    }
    const overdue = businessDaysBetween(parseLocalDate(item.ordered_at), today) > threshold;
    const status = overdue ? 'Delayed' : 'Ordered';
    if (status !== item.status) {
      systemDataLayer.update('required_items', item.id, { status }, SYSTEM);
      changed.push(item.id);
    }
  }
  return changed;
}

/**
 * Items whose expiration date the job watches, in the order an item moves through them.
 * Other statuses aren't current yet (or are awaiting review).
 */
const DATED_STATUSES = ['Verified', 'Expiring', 'Expired'];

function toDateOnly(date: Date): string {
  return formatLocalDateTime(date).slice(0, 10);
}

/**
 * Marks items Expiring inside the warning window (today through the configured number of
 * days out) and Expired once their date has passed (R15, C6). An item is still valid on
 * its expiration date. When an item becomes Expiring or Expired, the caregiver and their
 * agency's coordinators are emailed through the outbox. If the demo date moves back,
 * items return to the status that fits the date, without a notification. Returns the
 * changed item ids.
 */
export function runExpirationJob(systemDataLayer: DataLayer, today: Date): string[] {
  const windowDays = readSetting(systemDataLayer, 'warning_window_days', 30);
  const todayDate = toDateOnly(today);
  const windowEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + windowDays);
  const windowEndDate = toDateOnly(windowEnd);
  const changed: string[] = [];

  for (const item of systemDataLayer.list('required_items')) {
    if (!DATED_STATUSES.includes(item.status) || !item.expiration_date) {
      continue;
    }
    let status = 'Verified';
    if (item.expiration_date < todayDate) {
      status = 'Expired';
    } else if (item.expiration_date <= windowEndDate) {
      status = 'Expiring';
    }
    if (status === item.status) {
      continue;
    }
    systemDataLayer.update('required_items', item.id, { status }, SYSTEM);
    changed.push(item.id);
    // Only a move forward (toward Expired) notifies; moving the demo date back does not.
    if (DATED_STATUSES.indexOf(status) > DATED_STATUSES.indexOf(item.status)) {
      notifyExpiration(systemDataLayer, item, status, formatLocalDateTime(today));
    }
  }
  return changed;
}

/** Emails the caregiver and their agency's coordinators about an Expiring or Expired item (R15, Scenario 3). */
function notifyExpiration(systemDataLayer: DataLayer, item: Row, status: string, createdAt: string): void {
  const caregiver = systemDataLayer.get('caregivers', item.caregiver_id);
  if (!caregiver) {
    return;
  }
  const itemName =
    systemDataLayer.list('template_items').find((templateItem) => templateItem.item_key === item.item_key)?.name ??
    item.item_key;
  const caregiverName = `${caregiver.first_name} ${caregiver.last_name}`;
  const date = item.expiration_date;
  const expired = status === 'Expired';

  const recipients = systemDataLayer
    .list('users')
    .filter(
      (user) =>
        user.caregiver_id === caregiver.id ||
        (user.role === 'coordinator' && user.agency_id === caregiver.agency_id),
    );
  for (const user of recipients) {
    const toCaregiver = user.caregiver_id === caregiver.id;
    const notification: Row = {
      agency_id: caregiver.agency_id,
      recipient_user_id: user.id,
      caregiver_id: caregiver.id,
      channel: 'email',
      subject: toCaregiver
        ? `Your ${itemName} ${expired ? 'has expired' : 'expires soon'}`
        : `${itemName} ${expired ? 'expired' : 'expiring'} for ${caregiverName}`,
      body: toCaregiver
        ? `Your ${itemName} ${expired ? 'expired' : 'expires'} on ${date}. Your agency will ask you for a replacement.`
        : `${caregiverName}'s ${itemName} ${expired ? 'expired' : 'expires'} on ${date}.`,
      created_at: createdAt,
    };
    systemDataLayer.insert('notifications', notification, SYSTEM);
  }
}
