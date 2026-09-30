import { describe, expect, it } from 'vitest';
import { reviewExclusionMatch } from './checks';
import { coordinatorDashboard } from './dashboard';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { findBlockingItems } from './lifecycle';
import { createMemoryBackend } from './memoryBackend';
import { caregiverRecord } from './record';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const NOTE = 'Compared date of birth and middle name with the OIG entry; different person.';

/** Dana signed in; Olivia Martin (cg-09) is in Review Required with a possible OIG match. */
async function danaWithOlivia() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  return { dataLayer, system: createSystemDataLayer(backend) };
}

describe('Review Required: deciding an exclusion match (R17, R19, C1)', () => {
  it('shows the match details for review', async () => {
    const { dataLayer } = await danaWithOlivia();

    const record = caregiverRecord(dataLayer, 'cg-09')!;

    expect(record.lifecycleState).toBe('Review Required');
    expect(record.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(record.items.find((item) => item.item_key === 'oig_exclusion')).toMatchObject({
      result: 'Possible match',
      source: 'OIG exclusion list (mock)',
      notes: 'Name and date of birth match an OIG exclusion entry. Coordinator review required.',
      canVerifyByHand: false,
    });
  });

  it('sends a false match back to screening, verifies the item by hand, and lets eligibility follow', async () => {
    const { dataLayer, system } = await danaWithOlivia();

    const result = reviewExclusionMatch(dataLayer, 'cg-09', 'not-a-match', { note: NOTE, expirationDate: '2030-06-30' }, dana);

    expect(result.ok).toBe(true);
    expect(dataLayer.get('required_items', 'ri-cg-09-oig_exclusion')).toMatchObject({
      status: 'Verified',
      method: 'Manual verification',
      evidence: NOTE,
      expiration_date: '2030-06-30',
    });
    // Everything else of Olivia's is verified, so the matched item no longer blocks and she becomes Eligible.
    const olivia = dataLayer.get('caregivers', 'cg-09')!;
    expect(findBlockingItems(dataLayer, olivia)).toEqual([]);
    expect(olivia.lifecycle_state).toBe('Eligible');
    const decision = system
      .list(AUDIT_TABLE)
      .filter((row) => row.record_id === 'cg-09' && row.details.includes('Review Required → Screening In Progress'));
    expect(decision[0]).toMatchObject({ actor_role: 'coordinator', actor_name: 'Dana Whitfield' });
  });

  it('keeps a confirmed match in Review Required and records the decision', async () => {
    const { dataLayer, system } = await danaWithOlivia();

    const result = reviewExclusionMatch(
      dataLayer,
      'cg-09',
      'confirm-match',
      { note: 'Date of birth and SSN last four match the OIG entry.' },
      dana,
    );

    expect(result.ok).toBe(true);
    expect(dataLayer.get('caregivers', 'cg-09')?.lifecycle_state).toBe('Review Required');
    const item = dataLayer.get('required_items', 'ri-cg-09-oig_exclusion')!;
    expect(item.result).toBe('Confirmed match');
    expect(item.notes).toMatch(
      /^Confirmed as a match by Dana Whitfield on \d{4}-\d{2}-\d{2}: Date of birth and SSN last four match the OIG entry\.$/,
    );
    const event = system.list(AUDIT_TABLE).filter((row) => row.record_id === 'ri-cg-09-oig_exclusion').slice(-1)[0];
    expect(event).toMatchObject({ actor_role: 'coordinator', actor_name: 'Dana Whitfield' });
    const card = coordinatorDashboard(dataLayer).groups.flatMap((group) => group.cards).find((entry) => entry.id === 'cg-09');
    expect(card?.nextSteps).toEqual(['Confirmed exclusion match: do not clear']);
    // A confirmed match can't be decided again.
    expect(reviewExclusionMatch(dataLayer, 'cg-09', 'not-a-match', { note: NOTE, expirationDate: '2030-06-30' }, dana)).toEqual({
      ok: false,
      reason: 'There is no possible match left to review on this record.',
    });
  });

  it('requires a note, and a future date for a false match, without changing anything', async () => {
    const { dataLayer } = await danaWithOlivia();

    expect(reviewExclusionMatch(dataLayer, 'cg-09', 'not-a-match', { note: '  ', expirationDate: '2030-06-30' }, dana)).toEqual({
      ok: false,
      reason: 'Describe how you confirmed it is not a match.',
    });
    expect(reviewExclusionMatch(dataLayer, 'cg-09', 'not-a-match', { note: NOTE, expirationDate: '2020-01-01' }, dana)).toEqual({
      ok: false,
      reason: 'Enter a future expiration date for the exclusion check.',
    });
    expect(reviewExclusionMatch(dataLayer, 'cg-09', 'confirm-match', { note: '' }, dana).ok).toBe(false);
    expect(dataLayer.get('caregivers', 'cg-09')?.lifecycle_state).toBe('Review Required');
  });

  it('refuses applicants, the system, and records not in Review Required', async () => {
    const { dataLayer } = await danaWithOlivia();
    const details = { note: NOTE, expirationDate: '2030-06-30' };

    expect(reviewExclusionMatch(dataLayer, 'cg-09', 'not-a-match', details, { role: 'applicant', name: 'Olivia Martin' })).toEqual({
      ok: false,
      reason: 'Only a coordinator can review an exclusion match.',
    });
    expect(reviewExclusionMatch(dataLayer, 'cg-09', 'not-a-match', details, { role: 'system', name: 'CareMatch' }).ok).toBe(false);
    expect(reviewExclusionMatch(dataLayer, 'cg-05', 'not-a-match', details, dana)).toEqual({
      ok: false,
      reason: 'Only a record in Review Required has a match to review.',
    });
  });
});
