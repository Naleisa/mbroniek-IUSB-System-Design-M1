import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { checkExpirationDate, uploadDocument, type UploadInput } from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const applicant: Actor = { role: 'applicant', name: 'New applicant' };
const NOW = new Date(2026, 9, 5, 10, 0); // Monday, October 5, 2026
const YESTERDAY = '2026-10-04';
const TODAY = '2026-10-05';
const EXPIRED = "A document that has already expired can't be saved.";

function photo(expirationDate: string): UploadInput {
  return {
    itemKey: 'photo_id',
    file: new Blob(['photo'], { type: 'image/jpeg' }),
    fileName: 'photo-id.jpg',
    originalType: 'image/jpeg',
    originalSize: 1024,
    expirationDate,
  };
}

/** Full seed at a fixed "now", with a new applicant started from Agency A's intake link. */
async function newApplicant() {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  const caregiver = dataLayer.startIntake('hoosier-home-care')!;
  return { backend, dataLayer, caregiverId: caregiver.id, system: createSystemDataLayer(backend) };
}

describe('rejecting expired documents (R24, ADR-15)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses a past expiration date in the upload step and saves nothing', async () => {
    const { dataLayer } = await newApplicant();

    const result = await uploadDocument(dataLayer, photo(YESTERDAY), applicant);

    expect(result).toEqual({
      ok: false,
      errors: { expiration_date: `This document expired on ${YESTERDAY}. Please upload a current one.` },
    });
    expect(await dataLayer.listDocuments()).toEqual([]);
  });

  it('accepts a document that expires today', async () => {
    const { dataLayer } = await newApplicant();

    expect((await uploadDocument(dataLayer, photo(TODAY), applicant)).ok).toBe(true);
    expect(checkExpirationDate(TODAY, TODAY)).toBe('');
  });

  it('refuses a direct data-layer call with a past date, even when the upload step is skipped', async () => {
    const { dataLayer, system, caregiverId } = await newApplicant();
    const row = { caregiver_id: caregiverId, agency_id: 'agency-a', item_key: 'photo_id', expiration_date: YESTERDAY };

    expect(() => dataLayer.insert('documents', row, applicant)).toThrow(EXPIRED);
    await expect(
      dataLayer.putDocument({ id: 'doc-direct', file: new Blob(['x']), meta: row }, applicant),
    ).rejects.toThrow(EXPIRED);
    // The unfiltered system data layer refuses it too.
    const system_: Actor = { role: 'system', name: 'CareMatch' };
    expect(() => system.insert('documents', row, system_)).toThrow(EXPIRED);
    await expect(system.putDocument({ id: 'doc-system', file: new Blob(['x']), meta: row }, system_)).rejects.toThrow(
      EXPIRED,
    );
    expect(await system.listDocuments()).toEqual([]);
  });

  it('uses the demo date as today', async () => {
    const { dataLayer } = await newApplicant();
    dataLayer.setDemoDate('2027-01-10');

    const result = await uploadDocument(dataLayer, photo('2026-12-31'), applicant);

    expect(!result.ok && result.errors.expiration_date).toBe(
      'This document expired on 2026-12-31. Please upload a current one.',
    );
  });
});
