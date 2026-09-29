import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import { LIFECYCLE_STATES } from './types';
import { createVendorVault } from './vault';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

// A fresh data layer loading the seed is what "Reset demo data" does (clear storage, load the seed).
async function loadFreshSeed() {
  const backend = createMemoryBackend();
  await createDataLayer(backend).loadSeed(async () => realSeed);
  // Read unfiltered, as the seed itself is stored, so no sign-in filter hides rows.
  return { dataLayer: createSystemDataLayer(backend), vendorVault: createVendorVault(backend) };
}

describe('seeded demo caregivers (ADR-07, ADR-12, ADR-21)', () => {
  it('has every lifecycle state in Agency A', async () => {
    const { dataLayer } = await loadFreshSeed();
    const agencyAStates = new Set(
      dataLayer
        .list('caregivers')
        .filter((caregiver) => caregiver.agency_id === 'agency-a')
        .map((caregiver) => caregiver.lifecycle_state),
    );

    expect([...agencyAStates].sort()).toEqual([...LIFECYCLE_STATES].sort());
  });

  it('has caregivers in both agencies', async () => {
    const { dataLayer } = await loadFreshSeed();
    const caregivers = dataLayer.list('caregivers');

    expect(caregivers.filter((caregiver) => caregiver.agency_id === 'agency-a')).toHaveLength(10);
    expect(caregivers.filter((caregiver) => caregiver.agency_id === 'agency-b')).toHaveLength(3);
  });

  it('holds only 900-series test SSNs, in the vault and not on the record', async () => {
    const { dataLayer, vendorVault } = await loadFreshSeed();

    for (const caregiver of dataLayer.list('caregivers')) {
      expect(caregiver, caregiver.id).not.toHaveProperty('ssn');
      expect(caregiver.ssn_token, caregiver.id).toMatch(/^tok_/);
      const ssn = vendorVault.readSsn(caregiver.ssn_token);
      expect(ssn, caregiver.id).toMatch(/^9\d{2}-\d{2}-\d{4}$/);
      expect(ssn?.slice(-4), caregiver.id).toBe(caregiver.ssn_last4);
    }
  });

  it('has audit history for every Cleared caregiver (R1)', async () => {
    const { dataLayer } = await loadFreshSeed();
    const cleared = dataLayer.list('caregivers').filter((caregiver) => caregiver.lifecycle_state === 'Cleared');
    const events = dataLayer.list(AUDIT_TABLE);

    expect(cleared.map((caregiver) => caregiver.id)).toEqual(['cg-06', 'cg-07', 'cg-12']);
    for (const caregiver of cleared) {
      const history = events.filter((event) => event.caregiver_id === caregiver.id);
      expect(history.length, caregiver.id).toBeGreaterThan(0);
      expect(
        history.some((event) => event.event === 'State changed' && event.details === 'Eligible to Cleared'),
        caregiver.id,
      ).toBe(true);
    }
  });
});
