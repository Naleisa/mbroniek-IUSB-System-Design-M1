import { describe, expect, it } from 'vitest';
import { verifyReplacement } from './checks';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { uploadReplacement } from './intake';
import { clearRecord } from './lifecycle';
import { createMemoryBackend } from './memoryBackend';
import { caregiverRecord } from './record';
import type { SeedFiles } from './seed';
import type { Actor } from './types';
import { requestReplacement } from './worklist';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const DANA = 'dana.whitfield@hoosierhomecare.example';
const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };

async function seeded() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  return { dataLayer, system: createSystemDataLayer(backend) };
}

type DataLayer = Awaited<ReturnType<typeof seeded>>['dataLayer'];

function signInApplicant(dataLayer: DataLayer, email: string) {
  dataLayer.signOut();
  dataLayer.requestSignInLink(email);
  // Other messages can land in the same minute, so find the sign-in email by its subject.
  const link = dataLayer.outboxFor(email).find((message) => message.subject === 'Your CareMatch sign-in link')!;
  const token = /token=([^&\s]+)/.exec(link.body)?.[1] ?? '';
  expect(dataLayer.signInWithLink(decodeURIComponent(token)).ok).toBe(true);
}

function signInDana(dataLayer: DataLayer) {
  dataLayer.signOut();
  dataLayer.signIn(DANA, 'demo1234');
}

/** The applicant uploads a replacement card expiring on the given date. */
async function uploadCard(dataLayer: DataLayer, itemKey: string, expirationDate: string, name: string) {
  const result = await uploadReplacement(
    dataLayer,
    {
      itemKey,
      file: new Blob(['new card'], { type: 'image/jpeg' }),
      fileName: `${itemKey}-new.jpg`,
      originalType: 'image/jpeg',
      originalSize: 2048,
      expirationDate,
    },
    { role: 'applicant', name },
  );
  expect(result.ok).toBe(true);
}

function openRequestId(dataLayer: DataLayer, caregiverId: string, itemKey: string): string {
  return dataLayer
    .list('replacement_requests')
    .find((row) => row.caregiver_id === caregiverId && row.item_key === itemKey && row.status === 'Submitted')!.id;
}

describe('replacement review (R11, R15, C2, ADR-19)', () => {
  it("returns a Cleared caregiver's item to current by the original method, and the record never leaves Cleared", async () => {
    const { dataLayer } = await seeded();
    signInApplicant(dataLayer, 'robert.king@example.com');
    await uploadCard(dataLayer, 'cpr_first_aid', '2029-05-31', 'Robert King');
    signInDana(dataLayer);

    const record = caregiverRecord(dataLayer, 'cg-06')!;
    const cpr = record.items.find((item) => item.item_key === 'cpr_first_aid')!;
    expect(cpr.replacement?.status).toBe('Submitted');
    expect(cpr.replacement?.document?.expiration_date).toBe('2029-05-31');
    expect(cpr.document?.file_name).toBe('cpr-first-aid-card.jpg'); // View document still shows the card on file

    const result = verifyReplacement(dataLayer, openRequestId(dataLayer, 'cg-06', 'cpr_first_aid'), dana);

    expect(result.ok).toBe(true);
    expect(dataLayer.get('required_items', 'ri-cg-06-cpr_first_aid')).toMatchObject({
      status: 'Verified',
      method: 'Document review',
      expiration_date: '2029-05-31',
      evidence: 'Reviewed replacement cpr_first_aid-new.jpg',
    });
    expect(dataLayer.list('replacement_requests').find((row) => row.caregiver_id === 'cg-06')?.status).toBe('Verified');
    expect(dataLayer.get('caregivers', 'cg-06')?.lifecycle_state).toBe('Cleared');
  });

  it('keeps a Not Current record Not Current until the coordinator marks it Cleared', async () => {
    const { dataLayer } = await seeded();
    signInDana(dataLayer);
    expect(requestReplacement(dataLayer, 'ri-cg-08-tb_test', dana).ok).toBe(true);
    signInApplicant(dataLayer, 'samuel.okafor@example.com');
    await uploadCard(dataLayer, 'tb_test', '2030-02-28', 'Samuel Okafor');
    signInDana(dataLayer);

    expect(verifyReplacement(dataLayer, openRequestId(dataLayer, 'cg-08', 'tb_test'), dana).ok).toBe(true);

    expect(dataLayer.get('required_items', 'ri-cg-08-tb_test')).toMatchObject({ status: 'Verified', method: 'Document review' });
    expect(dataLayer.get('caregivers', 'cg-08')?.lifecycle_state).toBe('Not Current');

    expect(clearRecord(dataLayer, 'cg-08', dana).ok).toBe(true);
    expect(dataLayer.get('caregivers', 'cg-08')?.lifecycle_state).toBe('Cleared');
  });

  it('refuses a request that has not been uploaded, and anyone but a coordinator', async () => {
    const { dataLayer } = await seeded();
    signInDana(dataLayer);
    const robertsRequest = dataLayer.list('replacement_requests').find((row) => row.caregiver_id === 'cg-06')!;

    expect(verifyReplacement(dataLayer, robertsRequest.id, dana)).toEqual({
      ok: false,
      reason: 'Only an uploaded replacement can be verified.',
    });
    expect(verifyReplacement(dataLayer, robertsRequest.id, { role: 'applicant', name: 'Robert King' })).toEqual({
      ok: false,
      reason: 'Only a coordinator can verify a replacement.',
    });
    expect(verifyReplacement(dataLayer, robertsRequest.id, { role: 'system', name: 'CareMatch' }).ok).toBe(false);
  });
});
