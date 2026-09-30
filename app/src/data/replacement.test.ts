import { describe, expect, it } from 'vitest';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { applicantStatus, uploadReplacement, type ReplacementInput } from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const robert: Actor = { role: 'applicant', name: 'Robert King' };

/** Robert King (cg-06, Cleared) signed in by magic link. His CPR card is Expiring with a seeded replacement request. */
async function robertSignedIn() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.requestSignInLink('robert.king@example.com');
  const token = /token=([^&\s]+)/.exec(dataLayer.outboxFor('robert.king@example.com')[0].body)?.[1] ?? '';
  expect(dataLayer.signInWithLink(decodeURIComponent(token)).ok).toBe(true);
  return { dataLayer, system: createSystemDataLayer(backend) };
}

function newCard(dataLayer: Awaited<ReturnType<typeof robertSignedIn>>['dataLayer'], overrides: Partial<ReplacementInput> = {}) {
  const cprExpires = dataLayer.get('required_items', 'ri-cg-06-cpr_first_aid')!.expiration_date;
  const later = `${Number(cprExpires.slice(0, 4)) + 2}${cprExpires.slice(4)}`;
  return {
    itemKey: 'cpr_first_aid',
    file: new Blob(['new card'], { type: 'image/jpeg' }),
    fileName: 'cpr-card-2028.jpg',
    originalType: 'image/jpeg',
    originalSize: 2048,
    expirationDate: later,
    ...overrides,
  };
}

describe('credential replacement (R6, R11, R15, C6)', () => {
  it('shows the requested item and its due date on the status page', async () => {
    const { dataLayer } = await robertSignedIn();

    const status = applicantStatus(dataLayer)!;

    expect(status.replacementsNeeded).toEqual([
      {
        item_key: 'cpr_first_aid',
        name: 'CPR and First Aid certification',
        due_date: dataLayer.list('replacement_requests')[0].due_date,
      },
    ]);
    expect(status.items.find((item) => item.item_key === 'cpr_first_aid')?.waitingOn).toContain('Replacement due by');
  });

  it('marks an uploaded replacement Pending review and keeps the item current with its old date', async () => {
    const { dataLayer, system } = await robertSignedIn();
    const before = dataLayer.get('required_items', 'ri-cg-06-cpr_first_aid')!;

    const result = await uploadReplacement(dataLayer, newCard(dataLayer), robert);

    expect(result.ok).toBe(true);
    const documentId = result.ok ? result.documentId : '';
    const request = dataLayer.list('replacement_requests')[0];
    expect(request).toMatchObject({ status: 'Submitted', document_id: documentId });
    expect(request.submitted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(dataLayer.get('documents', documentId)).toMatchObject({ item_key: 'cpr_first_aid', file_name: 'cpr-card-2028.jpg' });
    expect(await dataLayer.getDocument(documentId)).toBeDefined();
    // The item itself isn't touched until the coordinator verifies the replacement (T48).
    expect(dataLayer.get('required_items', 'ri-cg-06-cpr_first_aid')).toMatchObject({
      status: before.status,
      expiration_date: before.expiration_date,
    });
    expect(system.get('caregivers', 'cg-06')?.lifecycle_state).toBe('Cleared');

    const status = applicantStatus(dataLayer)!;
    expect(status.replacementsNeeded).toEqual([]);
    const cpr = status.items.find((item) => item.item_key === 'cpr_first_aid')!;
    expect(cpr.replacement?.status).toBe('Submitted');
    expect(cpr.waitingOn).toMatch(/^Replacement uploaded on \d{4}-\d{2}-\d{2}\. Waiting on Hoosier Home Care to review it\.$/);
  });

  it('requires the replacement to expire after the current one', async () => {
    const { dataLayer } = await robertSignedIn();
    const current = dataLayer.get('required_items', 'ri-cg-06-cpr_first_aid')!.expiration_date;

    const result = await uploadReplacement(dataLayer, newCard(dataLayer, { expirationDate: current }), robert);

    expect(result).toEqual({
      ok: false,
      errors: { expiration_date: `A replacement should expire after your current one (${current}).` },
    });
    expect(dataLayer.list('replacement_requests')[0].status).toBe('Requested');
  });

  it('refuses an item with no replacement request, and a second upload', async () => {
    const { dataLayer } = await robertSignedIn();

    const noRequest = await uploadReplacement(dataLayer, newCard(dataLayer, { itemKey: 'tb_test' }), robert);
    expect(!noRequest.ok && noRequest.errors.file).toBe("There's no replacement request for this item.");

    await uploadReplacement(dataLayer, newCard(dataLayer), robert);
    const again = await uploadReplacement(dataLayer, newCard(dataLayer), robert);
    expect(!again.ok && again.errors.file).toBe('You already uploaded a replacement. It is waiting to be reviewed.');
  });

  it('applies the usual file rules', async () => {
    const { dataLayer } = await robertSignedIn();

    const tooBig = await uploadReplacement(dataLayer, newCard(dataLayer, { originalSize: 12 * 1024 * 1024 }), robert);

    expect(!tooBig.ok && tooBig.errors.file).toBe("This file is 12.0 MB. Choose one that's 10 MB or smaller.");
  });
});
