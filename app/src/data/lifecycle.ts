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

  const updated = dataLayer.update(
    'caregivers',
    caregiverId,
    { lifecycle_state: toState, state_changed_at: formatLocalDateTime(new Date()) },
    actor,
  );
  return { ok: true, caregiver: updated };
}
