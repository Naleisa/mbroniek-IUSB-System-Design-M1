import type { DataLayer } from './dataLayer';
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
