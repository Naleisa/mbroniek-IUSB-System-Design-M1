import { describe, expect, it } from 'vitest';
import caregiversCsv from '../../public/seed/caregivers.csv?raw';
import requiredItemsCsv from '../../public/seed/required_items.csv?raw';
import templateItemsCsv from '../../public/seed/template_items.csv?raw';
import { createSystemDataLayer } from './dataLayer';
import { checkEligibility } from './lifecycle';
import { createMemoryBackend } from './memoryBackend';
import type { Actor } from './types';

const vendor: Actor = { role: 'system', name: 'CareMatch' };

// Hannah Schultz (cg-11) is in Screening In Progress with three checks still Ordered.
const OUTSTANDING = ['ri-cg-11-background_check', 'ri-cg-11-oig_exclusion', 'ri-cg-11-sam_exclusion'];

async function loadSeed(requiredItems = requiredItemsCsv) {
  const dataLayer = createSystemDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => ({
    caregivers: caregiversCsv,
    required_items: requiredItems,
    template_items: templateItemsCsv,
  }));
  return dataLayer;
}

function verify(dataLayer: Awaited<ReturnType<typeof loadSeed>>, itemId: string) {
  dataLayer.update('required_items', itemId, { status: 'Verified', verified_date: '2026-09-29' }, vendor);
  return checkEligibility(dataLayer, 'cg-11');
}

describe('eligibility check (R12)', () => {
  it('moves the record to Eligible — not Cleared — when the last outstanding item is verified', async () => {
    const dataLayer = await loadSeed();

    expect(verify(dataLayer, OUTSTANDING[0]).ok).toBe(false);
    expect(verify(dataLayer, OUTSTANDING[1]).ok).toBe(false);
    expect(dataLayer.get('caregivers', 'cg-11')?.lifecycle_state).toBe('Screening In Progress');

    const result = verify(dataLayer, OUTSTANDING[2]);

    expect(result.ok).toBe(true);
    expect(dataLayer.get('caregivers', 'cg-11')?.lifecycle_state).toBe('Eligible');
  });

  it('leaves a record with one expired item where it is', async () => {
    const oneExpired = requiredItemsCsv.replace(
      'ri-cg-11-tb_test,cg-11,tb_test,Verified,Applicant upload,Document review,,today-1,today+310,',
      'ri-cg-11-tb_test,cg-11,tb_test,Verified,Applicant upload,Document review,,today-1,today-1,',
    );
    expect(oneExpired).not.toBe(requiredItemsCsv);
    const dataLayer = await loadSeed(oneExpired);

    let result = checkEligibility(dataLayer, 'cg-11');
    for (const itemId of OUTSTANDING) {
      result = verify(dataLayer, itemId);
    }

    expect(result).toEqual({
      ok: false,
      reason: "This record isn't eligible yet. Still needed: TB test result (expired).",
    });
    expect(dataLayer.get('caregivers', 'cg-11')?.lifecycle_state).toBe('Screening In Progress');
  });

  it('only acts on records in Screening In Progress', async () => {
    const dataLayer = await loadSeed();

    // Grace Kim (cg-07) is Cleared with every item current; she must stay Cleared.
    expect(checkEligibility(dataLayer, 'cg-07').ok).toBe(false);
    expect(dataLayer.get('caregivers', 'cg-07')?.lifecycle_state).toBe('Cleared');
  });
});
