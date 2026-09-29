import { describe, expect, it } from 'vitest';
import caregiversCsv from '../../public/seed/caregivers.csv?raw';
import requiredItemsCsv from '../../public/seed/required_items.csv?raw';
import templateItemsCsv from '../../public/seed/template_items.csv?raw';
import { createDataLayer } from './dataLayer';
import { transitionCaregiver } from './lifecycle';
import { createMemoryBackend } from './memoryBackend';
import type { Actor } from './types';

const coordinator: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const system: Actor = { role: 'system', name: 'CareMatch' };

async function loadSeed(requiredItems = requiredItemsCsv) {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => ({
    caregivers: caregiversCsv,
    required_items: requiredItems,
    template_items: templateItemsCsv,
  }));
  return dataLayer;
}

function withoutRow(csv: string, rowId: string): string {
  return csv
    .split('\n')
    .filter((line) => !line.startsWith(`${rowId},`))
    .join('\n');
}

describe('clearing a caregiver (C1, C2, R14, R23)', () => {
  it('lets a coordinator clear a fully verified record', async () => {
    const dataLayer = await loadSeed();

    const result = transitionCaregiver(dataLayer, 'cg-05', 'Cleared', coordinator);

    expect(result.ok).toBe(true);
    expect(dataLayer.get('caregivers', 'cg-05')?.lifecycle_state).toBe('Cleared');
  });

  it('refuses a record with a missing required item and names it (Spec Section 5, criterion 2)', async () => {
    const dataLayer = await loadSeed(withoutRow(requiredItemsCsv, 'ri-cg-05-tb_test'));

    const result = transitionCaregiver(dataLayer, 'cg-05', 'Cleared', coordinator);

    expect(result).toEqual({
      ok: false,
      reason: "This record can't be cleared yet. Still needed: TB test result (missing).",
    });
    expect(dataLayer.get('caregivers', 'cg-05')?.lifecycle_state).toBe('Eligible');
  });

  it('refuses a record with an expired item and names it', async () => {
    const dataLayer = await loadSeed();

    const result = transitionCaregiver(dataLayer, 'cg-08', 'Cleared', coordinator);

    expect(result).toEqual({
      ok: false,
      reason: "This record can't be cleared yet. Still needed: TB test result (expired).",
    });
    expect(dataLayer.get('caregivers', 'cg-08')?.lifecycle_state).toBe('Not Current');
  });

  it('treats a Verified item past its expiration date as expired', async () => {
    const pastDate = requiredItemsCsv.replace(
      'ri-cg-05-cpr_first_aid,cg-05,cpr_first_aid,Verified,Applicant upload,Document review,,today-5,today+540,',
      'ri-cg-05-cpr_first_aid,cg-05,cpr_first_aid,Verified,Applicant upload,Document review,,today-5,today-1,',
    );
    expect(pastDate).not.toBe(requiredItemsCsv);
    const dataLayer = await loadSeed(pastDate);

    const result = transitionCaregiver(dataLayer, 'cg-05', 'Cleared', coordinator);

    expect(result).toEqual({
      ok: false,
      reason: "This record can't be cleared yet. Still needed: CPR and First Aid certification (expired).",
    });
  });

  it('names every blocking item, including ones not verified yet', async () => {
    const dataLayer = await loadSeed(withoutRow(requiredItemsCsv, 'ri-cg-05-photo_id'));
    dataLayer.update('required_items', 'ri-cg-05-background_check', { status: 'Pending' }, coordinator);

    const result = transitionCaregiver(dataLayer, 'cg-05', 'Cleared', coordinator);

    expect(result).toEqual({
      ok: false,
      reason:
        "This record can't be cleared yet. Still needed: Government photo ID (missing); Criminal background check (not verified yet).",
    });
  });

  it('always refuses a system (non-human) caller', async () => {
    const dataLayer = await loadSeed();

    for (const caregiverId of ['cg-05', 'cg-08']) {
      const before = dataLayer.get('caregivers', caregiverId)?.lifecycle_state;

      const result = transitionCaregiver(dataLayer, caregiverId, 'Cleared', system);

      expect(result.ok).toBe(false);
      expect(dataLayer.get('caregivers', caregiverId)?.lifecycle_state).toBe(before);
    }
  });
});
