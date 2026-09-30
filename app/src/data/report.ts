import type { DataLayer } from './dataLayer';
import { AUDIT_TABLE } from './dataLayer';
import { findBlockingItems } from './lifecycle';
import { formatLocalDateTime } from './relativeDates';

/**
 * The compliance report for one caregiver (T50, R13, R2, ADR-14): one document with every
 * required item, its evidence, and its verification history. Read through the coordinator's
 * own data layer, so another agency's caregiver is simply not found (R4).
 */

export interface HistoryEntry {
  when: string;
  who: string;
  event: string;
  details: string;
}

export interface ReportItem {
  item_key: string;
  name: string;
  status: string;
  source: string;
  method: string;
  ordered_at: string;
  verified_date: string;
  expiration_date: string;
  result: string;
  evidence: string;
  notes: string;
  /** Each vendor order for this item: when it was ordered and returned, and the result. */
  checkHistory: { orderedAt: string; completedAt: string; result: string }[];
  /** Audit events recorded against this item in the app, oldest first. */
  activity: HistoryEntry[];
}

export interface ComplianceReport {
  caregiverName: string;
  agencyName: string;
  lifecycleState: string;
  ssnLast4: string;
  templateName: string;
  templateNote: string;
  generatedAt: string;
  /** Complete, or the blocking items with their reasons. */
  summary: { complete: boolean; itemCount: number; blockers: string[] };
  items: ReportItem[];
  /** The record's full audit timeline, oldest first. */
  history: HistoryEntry[];
}

function toEntry(event: Record<string, string>): HistoryEntry {
  return {
    when: event.occurred_at,
    who: `${event.actor_name} (${event.actor_role})`,
    event: event.event,
    details: event.details ?? '',
  };
}

const byTime = (a: HistoryEntry, b: HistoryEntry) => a.when.localeCompare(b.when);

/** The compliance report for one caregiver, or undefined if this coordinator can't see them. */
export function complianceReport(dataLayer: DataLayer, caregiverId: string): ComplianceReport | undefined {
  const caregiver = dataLayer.get('caregivers', caregiverId);
  if (!caregiver) {
    return undefined;
  }
  const template = dataLayer.get('requirement_templates', caregiver.template_id);
  const templateItems = dataLayer
    .list('template_items')
    .filter((item) => item.template_id === caregiver.template_id)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const requiredItems = dataLayer.list('required_items').filter((item) => item.caregiver_id === caregiver.id);
  const orders = dataLayer.list('check_orders').filter((order) => order.caregiver_id === caregiver.id);
  const events = dataLayer.list(AUDIT_TABLE).filter((event) => event.caregiver_id === caregiver.id);

  const items: ReportItem[] = templateItems.map((templateItem) => {
    const item = requiredItems.find((row) => row.item_key === templateItem.item_key);
    const itemId = item?.id ?? '';
    return {
      item_key: templateItem.item_key,
      name: templateItem.name,
      status: item?.status ?? 'Missing',
      source: item?.source ?? templateItem.source,
      method: item?.method ?? templateItem.method,
      ordered_at: item?.ordered_at ?? '',
      verified_date: item?.verified_date ?? '',
      expiration_date: item?.expiration_date ?? '',
      result: item?.result ?? '',
      evidence: item?.evidence ?? '',
      notes: item?.notes ?? '',
      checkHistory: orders
        .filter((order) => itemId && order.required_item_id === itemId)
        .sort((a, b) => a.ordered_at.localeCompare(b.ordered_at))
        .map((order) => ({ orderedAt: order.ordered_at, completedAt: order.completed_at, result: order.result })),
      activity: events
        .filter((event) => itemId && event.record_id === itemId)
        .map(toEntry)
        .sort(byTime),
    };
  });

  const blockers = findBlockingItems(dataLayer, caregiver);
  return {
    caregiverName: `${caregiver.first_name} ${caregiver.last_name}`.trim() || 'New applicant',
    agencyName: dataLayer.get('agencies', caregiver.agency_id)?.name ?? '',
    lifecycleState: caregiver.lifecycle_state,
    ssnLast4: caregiver.ssn_last4 ?? '',
    templateName: template?.name ?? '',
    templateNote: template?.is_sample === 'true' ? (template.sample_note ?? '') : '',
    generatedAt: formatLocalDateTime(dataLayer.today()),
    summary: { complete: blockers.length === 0, itemCount: templateItems.length, blockers },
    items,
    history: events.map(toEntry).sort(byTime),
  };
}
