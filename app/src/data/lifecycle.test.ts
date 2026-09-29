import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer } from './dataLayer';
import { LIFECYCLE_TRANSITIONS, transitionCaregiver } from './lifecycle';
import { createMemoryBackend } from './memoryBackend';
import { LIFECYCLE_STATES, type Actor, type LifecycleState } from './types';

const actors: Record<Actor['role'], Actor> = {
  applicant: { role: 'applicant', name: 'Linda Brooks' },
  coordinator: { role: 'coordinator', name: 'Dana Whitfield' },
  system: { role: 'system', name: 'CareMatch' },
};

async function caregiverIn(state: LifecycleState) {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => ({
    caregivers: `id,agency_id,lifecycle_state,state_changed_at\ncg-05,agency-a,${state},2026-01-01T09:00\n`,
  }));
  return dataLayer;
}

function isAllowed(from: LifecycleState, to: LifecycleState, role: Actor['role']): boolean {
  return LIFECYCLE_TRANSITIONS.some((t) => t.from === from && t.to === to && t.allowed.includes(role));
}

describe('lifecycle transitions (ADR-08)', () => {
  it('covers every ADR-08 state', () => {
    const covered = new Set(LIFECYCLE_TRANSITIONS.flatMap((t) => [t.from, t.to]));
    expect([...covered].sort()).toEqual([...LIFECYCLE_STATES].sort());
  });

  it('lets every allowed transition succeed, updating the state and the audit log', async () => {
    for (const transition of LIFECYCLE_TRANSITIONS) {
      for (const role of transition.allowed) {
        const dataLayer = await caregiverIn(transition.from);

        const result = transitionCaregiver(dataLayer, 'cg-05', transition.to, actors[role]);

        expect(result.ok, `${transition.from} → ${transition.to} by ${role}`).toBe(true);
        const caregiver = dataLayer.get('caregivers', 'cg-05');
        expect(caregiver?.lifecycle_state).toBe(transition.to);
        expect(caregiver?.state_changed_at).not.toBe('2026-01-01T09:00');
        expect(dataLayer.list(AUDIT_TABLE)).toHaveLength(1);
      }
    }
  });

  it('refuses every other transition and leaves the record unchanged', async () => {
    let refused = 0;
    for (const from of LIFECYCLE_STATES) {
      for (const to of LIFECYCLE_STATES) {
        for (const actor of Object.values(actors)) {
          if (isAllowed(from, to, actor.role)) continue;
          const dataLayer = await caregiverIn(from);

          const result = transitionCaregiver(dataLayer, 'cg-05', to, actor);

          expect(result.ok, `${from} → ${to} by ${actor.role}`).toBe(false);
          expect(dataLayer.get('caregivers', 'cg-05')?.lifecycle_state).toBe(from);
          expect(dataLayer.list(AUDIT_TABLE)).toHaveLength(0);
          refused++;
        }
      }
    }
    expect(refused).toBeGreaterThan(0);
  });

  it('accepts no automated transition out of Review Required (R17)', async () => {
    for (const to of LIFECYCLE_STATES) {
      const dataLayer = await caregiverIn('Review Required');

      const result = transitionCaregiver(dataLayer, 'cg-05', to, actors.system);

      expect(result.ok, `Review Required → ${to} by system`).toBe(false);
      expect(dataLayer.get('caregivers', 'cg-05')?.lifecycle_state).toBe('Review Required');
    }
  });

  it('explains refusals in plain language', async () => {
    const dataLayer = await caregiverIn('Intake Complete');

    expect(transitionCaregiver(dataLayer, 'cg-05', 'Cleared', actors.coordinator)).toEqual({
      ok: false,
      reason: "A record can't move from Intake Complete to Cleared.",
    });
    expect(transitionCaregiver(dataLayer, 'cg-05', 'Hired', actors.coordinator)).toEqual({
      ok: false,
      reason: '"Hired" is not a record status.',
    });
    expect(transitionCaregiver(dataLayer, 'cg-99', 'Eligible', actors.system)).toEqual({
      ok: false,
      reason: 'We could not find that caregiver record.',
    });
  });
});
