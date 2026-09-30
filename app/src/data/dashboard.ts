import { latestAuthorization } from './checks';
import type { DataLayer } from './dataLayer';
import type { Row } from './storageBackend';
import { LIFECYCLE_STATES } from './types';

/**
 * The coordinator dashboard (T41). Everything is read through the coordinator's own data
 * layer, so another agency's caregivers never appear (R4).
 */

export type Highlight = 'Incomplete intake' | 'Declined consent' | 'Delayed check';

export interface DashboardCard {
  id: string;
  name: string;
  state: string;
  highlights: { label: Highlight; detail: string }[];
  /** What the coordinator should do next, in plain words; empty when nothing is waiting on them. */
  nextSteps: string[];
}

export interface Dashboard {
  agencyName: string;
  total: number;
  /** One group per lifecycle state that has caregivers, in lifecycle order. */
  groups: { state: string; cards: DashboardCard[] }[];
  counts: Record<Highlight, number>;
}

/** Whole calendar days from a `YYYY-MM-DD…` date to today. */
function daysSince(date: string, today: Date): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function daysAgo(days: number): string {
  return days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Lists the signed-in coordinator's caregivers grouped by lifecycle state, highlighting
 * incomplete intakes (R8), declined consents (R25), and delayed checks with how long
 * they've been waiting (R16, R20).
 */
export function coordinatorDashboard(dataLayer: DataLayer): Dashboard {
  const user = dataLayer.getSignedInUser();
  const agencyName = user ? (dataLayer.get('agencies', user.agency_id)?.name ?? '') : '';
  const today = dataLayer.today();
  const templateItems = dataLayer.list('template_items');
  const requiredItems = dataLayer.list('required_items');
  const counts: Record<Highlight, number> = { 'Incomplete intake': 0, 'Declined consent': 0, 'Delayed check': 0 };

  const cardFor = (caregiver: Row): DashboardCard => {
    const highlights: DashboardCard['highlights'] = [];
    if (caregiver.lifecycle_state === 'Intake In Progress') {
      highlights.push({
        label: 'Incomplete intake',
        detail: `Started ${daysAgo(daysSince(caregiver.created_at, today))}`,
      });
    }
    if (latestAuthorization(dataLayer, caregiver.id)?.decision === 'declined') {
      highlights.push({ label: 'Declined consent', detail: 'Screening stopped' });
    }
    for (const item of requiredItems.filter((row) => row.caregiver_id === caregiver.id && row.status === 'Delayed')) {
      const name = templateItems.find((row) => row.item_key === item.item_key)?.name ?? item.item_key;
      highlights.push({ label: 'Delayed check', detail: `${name}: started ${daysAgo(daysSince(item.ordered_at, today))}` });
    }
    for (const highlight of new Set(highlights.map((entry) => entry.label))) {
      counts[highlight] += 1;
    }
    return {
      id: caregiver.id,
      name: `${caregiver.first_name} ${caregiver.last_name}`.trim() || 'New applicant',
      state: caregiver.lifecycle_state,
      highlights,
      nextSteps: nextStepsFor(caregiver),
    };
  };

  const itemName = (itemKey: string) => templateItems.find((row) => row.item_key === itemKey)?.name ?? itemKey;
  const openReplacements = dataLayer
    .list('replacement_requests')
    .filter((row) => row.status === 'Requested' || row.status === 'Submitted');

  /** The coordinator's next steps for one record, from its state and its items (T41 follow-up). */
  function nextStepsFor(caregiver: Row): string[] {
    const steps: string[] = [];
    const stateSteps: Record<string, string> = {
      'Intake Complete': 'Ready to start screening',
      Eligible: 'Ready to mark Cleared',
      'Review Required': 'Review the possible exclusion match',
    };
    if (stateSteps[caregiver.lifecycle_state]) {
      steps.push(stateSteps[caregiver.lifecycle_state]);
    }
    for (const item of requiredItems.filter((row) => row.caregiver_id === caregiver.id)) {
      const name = itemName(item.item_key);
      if (item.status === 'Expired') {
        steps.push(`${name} expired on ${item.expiration_date}`);
      } else if (item.status === 'Retryable') {
        steps.push(`${name} failed: order it again`);
      } else if (item.status === 'Manual Verification' && item.result !== 'Possible match') {
        // A possible exclusion match is covered by the Review Required step above.
        steps.push(`${name}: verify it by hand`);
      } else if (item.status === 'Expiring') {
        steps.push(`${name} expires on ${item.expiration_date}`);
      }
    }
    for (const request of openReplacements.filter((row) => row.caregiver_id === caregiver.id)) {
      steps.push(
        request.status === 'Submitted'
          ? `Replacement for ${itemName(request.item_key)} uploaded: review it`
          : `Replacement requested for ${itemName(request.item_key)}, due ${request.due_date}`,
      );
    }
    return steps;
  }

  const caregivers = dataLayer.list('caregivers');
  const groups = LIFECYCLE_STATES.map((state) => ({
    state: state as string,
    cards: caregivers
      .filter((caregiver) => caregiver.lifecycle_state === state)
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))
      .map(cardFor),
  })).filter((group) => group.cards.length > 0);

  return { agencyName, total: caregivers.length, groups, counts };
}
