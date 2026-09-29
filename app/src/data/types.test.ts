import { describe, expect, it } from 'vitest';
import { isLifecycleState, LIFECYCLE_STATES } from './types';

describe('caregiver lifecycle state', () => {
  it('allows exactly the seven ADR-08 states, including Not Current', () => {
    expect(LIFECYCLE_STATES).toEqual([
      'Intake In Progress',
      'Intake Complete',
      'Screening In Progress',
      'Eligible',
      'Cleared',
      'Not Current',
      'Review Required',
    ]);

    for (const state of LIFECYCLE_STATES) {
      expect(isLifecycleState(state)).toBe(true);
    }
  });

  it('rejects any other state', () => {
    expect(isLifecycleState('Hired')).toBe(false);
    expect(isLifecycleState('cleared')).toBe(false);
    expect(isLifecycleState('')).toBe(false);
  });
});
