import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { clearRecord } from './lifecycle';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const system: Actor = { role: 'system', name: 'CareMatch' };

async function danaSignedIn(seed: SeedFiles = realSeed) {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => seed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  return { dataLayer, system: createSystemDataLayer(backend) };
}

describe('Mark Cleared (R23, R14, C1, ADR-08)', () => {
  it('clears a fully verified record, recorded under the coordinator', async () => {
    const { dataLayer, system: systemLayer } = await danaSignedIn();

    // Linda Brooks (cg-05) is Eligible with every item verified and current.
    expect(clearRecord(dataLayer, 'cg-05', dana).ok).toBe(true);

    expect(dataLayer.get('caregivers', 'cg-05')?.lifecycle_state).toBe('Cleared');
    const event = systemLayer
      .list(AUDIT_TABLE)
      .filter((row) => row.record_id === 'cg-05' && row.details.includes('Cleared'))
      .slice(-1)[0];
    expect(event).toMatchObject({ actor_role: 'coordinator', actor_name: 'Dana Whitfield' });
  });

  it('names what is still needed on a record in screening', async () => {
    const { dataLayer } = await danaSignedIn();

    // Aisha Patel (cg-03) is waiting on a delayed background check.
    expect(clearRecord(dataLayer, 'cg-03', dana)).toEqual({
      ok: false,
      reason: "This record can't be cleared yet. Still needed: Criminal background check (not verified yet).",
    });
    expect(dataLayer.get('caregivers', 'cg-03')?.lifecycle_state).toBe('Screening In Progress');
  });

  it('names a missing required item (Spec Section 5, criterion 2)', async () => {
    const withoutTb = realSeed.required_items
      .split('\n')
      .filter((line) => !line.startsWith('ri-cg-05-tb_test,'))
      .join('\n');
    const { dataLayer } = await danaSignedIn({ ...realSeed, required_items: withoutTb });

    expect(clearRecord(dataLayer, 'cg-05', dana)).toEqual({
      ok: false,
      reason: "This record can't be cleared yet. Still needed: TB test result (missing).",
    });
    expect(dataLayer.get('caregivers', 'cg-05')?.lifecycle_state).toBe('Eligible');
  });

  it('names an expired item', async () => {
    const { dataLayer, system: systemLayer } = await danaSignedIn();
    systemLayer.update('required_items', 'ri-cg-05-drivers_license', { expiration_date: '2020-01-01' }, system);

    expect(clearRecord(dataLayer, 'cg-05', dana)).toEqual({
      ok: false,
      reason: "This record can't be cleared yet. Still needed: Driver's license (expired).",
    });
  });

  it('refuses applicants, the system, and states that cannot be cleared', async () => {
    const { dataLayer } = await danaSignedIn();

    expect(clearRecord(dataLayer, 'cg-05', { role: 'applicant', name: 'Linda Brooks' })).toEqual({
      ok: false,
      reason: 'Only a coordinator can mark a record Cleared.',
    });
    expect(clearRecord(dataLayer, 'cg-05', system).ok).toBe(false);
    expect(clearRecord(dataLayer, 'cg-09', dana)).toEqual({
      ok: false,
      reason: "A record in Review Required can't be marked Cleared.",
    });
    expect(clearRecord(dataLayer, 'cg-01', dana).ok).toBe(false);
    expect(clearRecord(dataLayer, 'cg-11', dana)).toEqual({ ok: false, reason: 'We could not find that caregiver record.' });
  });
});
