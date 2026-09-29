import type { DataLayer } from './dataLayer';
import { formatLocalDateTime } from './relativeDates';
import type { Row } from './storageBackend';
import { isLifecycleState, type Actor, type LifecycleState } from './types';

type ActorRole = Actor['role'];

interface Transition {
  from: LifecycleState;
  to: LifecycleState;
  /** Who may make this move. */
  allowed: ActorRole[];
  /** Where the rule comes from. */
  source: string;
}

/**
 * Every allowed lifecycle move (ADR-08). Anything not listed is refused.
 * Nothing automated moves a record out of Review Required (R17); only a
 * coordinator can send it back to screening after reviewing the match.
 */
export const LIFECYCLE_TRANSITIONS: readonly Transition[] = [
  { from: 'Intake In Progress', to: 'Intake Complete', allowed: ['applicant'], source: 'R7' },
  { from: 'Intake Complete', to: 'Screening In Progress', allowed: ['coordinator'], source: 'Scenario 2' },
  { from: 'Screening In Progress', to: 'Eligible', allowed: ['system'], source: 'R12' },
  { from: 'Screening In Progress', to: 'Review Required', allowed: ['system'], source: 'R19' },
  { from: 'Eligible', to: 'Review Required', allowed: ['system'], source: 'R19' },
  { from: 'Eligible', to: 'Cleared', allowed: ['coordinator'], source: 'ADR-08' },
  { from: 'Cleared', to: 'Not Current', allowed: ['system'], source: 'ADR-19' },
  { from: 'Cleared', to: 'Review Required', allowed: ['system'], source: 'R19' },
  { from: 'Not Current', to: 'Cleared', allowed: ['coordinator'], source: 'ADR-19' },
  { from: 'Not Current', to: 'Review Required', allowed: ['system'], source: 'R19' },
  { from: 'Review Required', to: 'Screening In Progress', allowed: ['coordinator'], source: 'R17' },
];

export type TransitionResult = { ok: true; caregiver: Row } | { ok: false; reason: string };

/** Verified and Expiring items are still current, as long as their expiration date hasn't passed. */
const CURRENT_STATUSES = ['Verified', 'Expiring'];

/**
 * Lists every template item that keeps this caregiver from being Eligible or
 * Cleared, with a short plain-language reason: missing, expired, or not
 * verified yet (R12, R14, C2).
 */
export function findBlockingItems(dataLayer: DataLayer, caregiver: Row): string[] {
  const today = formatLocalDateTime(new Date()).slice(0, 10);
  const templateItems = dataLayer
    .list('template_items')
    .filter((item) => item.template_id === caregiver.template_id)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const requiredItems = dataLayer.list('required_items').filter((item) => item.caregiver_id === caregiver.id);

  const blockers: string[] = [];
  for (const templateItem of templateItems) {
    const item = requiredItems.find((required) => required.item_key === templateItem.item_key);
    if (!item) {
      blockers.push(`${templateItem.name} (missing)`);
    } else if (item.status === 'Expired' || (item.expiration_date && item.expiration_date < today)) {
      blockers.push(`${templateItem.name} (expired)`);
    } else if (!CURRENT_STATUSES.includes(item.status)) {
      blockers.push(`${templateItem.name} (not verified yet)`);
    }
  }
  return blockers;
}

/** Moves a caregiver record to a new lifecycle state, or explains in plain language why it can't. */
export function transitionCaregiver(
  dataLayer: DataLayer,
  caregiverId: string,
  toState: string,
  actor: Actor,
): TransitionResult {
  const caregiver = dataLayer.get('caregivers', caregiverId);
  if (!caregiver) {
    return { ok: false, reason: 'We could not find that caregiver record.' };
  }
  if (!isLifecycleState(toState)) {
    return { ok: false, reason: `"${toState}" is not a record status.` };
  }

  const fromState = caregiver.lifecycle_state;
  const transition = LIFECYCLE_TRANSITIONS.find((t) => t.from === fromState && t.to === toState);
  if (!transition) {
    return { ok: false, reason: `A record can't move from ${fromState} to ${toState}.` };
  }
  if (!transition.allowed.includes(actor.role)) {
    return {
      ok: false,
      reason:
        fromState === 'Review Required'
          ? 'A record in Review Required can only be moved by a coordinator after reviewing it.'
          : `Only ${transition.allowed.join(' or ')} can move a record from ${fromState} to ${toState}.`,
    };
  }

  // Only a coordinator can reach this point for Cleared (C1); every required item must be complete and current (R12, R14, R23).
  if (toState === 'Cleared' || toState === 'Eligible') {
    const blockers = findBlockingItems(dataLayer, caregiver);
    if (blockers.length > 0) {
      const summary = toState === 'Cleared' ? "This record can't be cleared yet." : "This record isn't eligible yet.";
      return { ok: false, reason: `${summary} Still needed: ${blockers.join('; ')}.` };
    }
  }

  const updated = dataLayer.update(
    'caregivers',
    caregiverId,
    { lifecycle_state: toState, state_changed_at: formatLocalDateTime(new Date()) },
    actor,
  );
  return { ok: true, caregiver: updated };
}

const SYSTEM: Actor = { role: 'system', name: 'CareMatch' };

/**
 * Moves a record in screening to Eligible once every required item is verified
 * and current (R12). Never moves anyone to Cleared; a coordinator does that (C1).
 * Call it after verifying an item (vendor results in T21, document review in T44).
 */
export function checkEligibility(dataLayer: DataLayer, caregiverId: string): TransitionResult {
  const caregiver = dataLayer.get('caregivers', caregiverId);
  if (!caregiver) {
    return { ok: false, reason: 'We could not find that caregiver record.' };
  }
  if (caregiver.lifecycle_state !== 'Screening In Progress') {
    return { ok: false, reason: `Only records in Screening In Progress can become eligible.` };
  }
  return transitionCaregiver(dataLayer, caregiverId, 'Eligible', SYSTEM);
}
