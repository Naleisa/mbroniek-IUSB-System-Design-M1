import { describe, expect, it } from 'vitest';
import { markUnreadable, verifyDocument, verifyManually } from './checks';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
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
const system: Actor = { role: 'system', name: 'CareMatch' };

async function danaSignedIn() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  return { dataLayer, system: createSystemDataLayer(backend) };
}

describe('document review on the record view (R22, R26, R2, ADR-15)', () => {
  it('marks a Pending document verified with its method, dates, and evidence', async () => {
    const { dataLayer, system: systemLayer } = await danaSignedIn();
    // James Carter's TB test is Pending with a seeded document.
    const before = dataLayer.get('required_items', 'ri-cg-02-tb_test')!;

    const result = verifyDocument(dataLayer, 'ri-cg-02-tb_test', dana);

    expect(result.ok).toBe(true);
    const item = dataLayer.get('required_items', 'ri-cg-02-tb_test')!;
    expect(item).toMatchObject({
      status: 'Verified',
      method: 'Document review',
      expiration_date: before.expiration_date,
      evidence: 'Reviewed tb-test-result.pdf',
    });
    expect(item.verified_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const event = systemLayer.list(AUDIT_TABLE).filter((row) => row.record_id === 'ri-cg-02-tb_test').slice(-1)[0];
    expect(event).toMatchObject({ actor_role: 'coordinator', actor_name: 'Dana Whitfield' });
  });

  it('makes the record Eligible when the last outstanding document is verified', async () => {
    const { dataLayer, system: systemLayer } = await danaSignedIn();
    // Put Aisha (cg-03, Screening) one document away from eligible: everything else current, TB test Pending with a document.
    systemLayer.update('required_items', 'ri-cg-03-background_check', { status: 'Verified', expiration_date: '2030-01-01' }, system);
    systemLayer.update('required_items', 'ri-cg-03-tb_test', { status: 'Pending', expiration_date: '2030-01-01' }, system);
    expect(caregiverRecord(dataLayer, 'cg-03')!.items.find((item) => item.item_key === 'tb_test')?.reviewable).toBe(true);

    verifyDocument(dataLayer, 'ri-cg-03-tb_test', dana);

    expect(dataLayer.get('caregivers', 'cg-03')?.lifecycle_state).toBe('Eligible');
  });

  it('sends an unreadable document to Manual Verification, where it can be verified by hand', async () => {
    const { dataLayer } = await danaSignedIn();

    expect(markUnreadable(dataLayer, 'ri-cg-02-tb_test', dana).ok).toBe(true);
    expect(dataLayer.get('required_items', 'ri-cg-02-tb_test')).toMatchObject({
      status: 'Manual Verification',
      notes: "The document couldn't be read. Verify it by hand.",
    });
    expect(caregiverRecord(dataLayer, 'cg-02')!.items.find((item) => item.item_key === 'tb_test')?.canVerifyByHand).toBe(true);

    const byHand = verifyManually(
      dataLayer,
      'ri-cg-02-tb_test',
      { note: 'Saw the original TB result in person at the office.', expirationDate: '2030-06-30' },
      dana,
    );
    expect(byHand.ok).toBe(true);
    expect(dataLayer.get('required_items', 'ri-cg-02-tb_test')).toMatchObject({
      status: 'Verified',
      method: 'Manual verification',
      expiration_date: '2030-06-30',
    });
  });

  it('refuses items with no document, items that are not Pending, and applicants', async () => {
    const { dataLayer } = await danaSignedIn();

    // Tom's background check is Retryable, James's has no document, and Robert's photo ID is already Verified.
    expect(verifyDocument(dataLayer, 'ri-cg-04-background_check', dana)).toEqual({
      ok: false,
      reason: 'Only a Pending document can be reviewed. This one is Retryable.',
    });
    expect(verifyDocument(dataLayer, 'ri-cg-02-background_check', dana)).toEqual({
      ok: false,
      reason: 'Nothing has been uploaded for this item yet.',
    });
    expect(markUnreadable(dataLayer, 'ri-cg-06-photo_id', dana).ok).toBe(false);
    expect(verifyDocument(dataLayer, 'ri-cg-02-tb_test', { role: 'applicant', name: 'James Carter' })).toEqual({
      ok: false,
      reason: 'Only a coordinator can review documents.',
    });
  });

  it('offers verify by hand for Manual Verification items but not for a possible exclusion match', async () => {
    const { dataLayer } = await danaSignedIn();

    const tom = caregiverRecord(dataLayer, 'cg-04')!;
    expect(tom.items.find((item) => item.item_key === 'hha_certification')?.canVerifyByHand).toBe(true);
    const olivia = caregiverRecord(dataLayer, 'cg-09')!;
    expect(olivia.items.find((item) => item.item_key === 'oig_exclusion')?.canVerifyByHand).toBe(false);
  });

  it('points each item at its newest document, including seeded ones with no file', async () => {
    const { dataLayer } = await danaSignedIn();

    const maria = caregiverRecord(dataLayer, 'cg-01')!;
    const photo = maria.items.find((item) => item.item_key === 'photo_id')!;
    expect(photo.document).toMatchObject({ id: 'doc-cg-01-photo_id', file_name: 'photo-id.jpg', file_type: 'image/jpeg' });
    expect(await dataLayer.getDocument('doc-cg-01-photo_id')).toBeUndefined(); // shown as a sample in the demo
    expect(photo.reviewable).toBe(true);
  });
});
