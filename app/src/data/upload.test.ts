import { describe, expect, it } from 'vitest';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { MAX_UPLOAD_BYTES, uploadDocument, type UploadInput } from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const applicant: Actor = { role: 'applicant', name: 'New applicant' };

function photo(overrides: Partial<UploadInput> = {}): UploadInput {
  return {
    itemKey: 'photo_id',
    file: new Blob(['compressed photo'], { type: 'image/jpeg' }),
    fileName: 'photo-id.jpg',
    originalType: 'image/jpeg',
    originalSize: 2 * 1024 * 1024,
    expirationDate: '2030-06-30',
    ...overrides,
  };
}

/** Full seed, with a new applicant started from Agency A's intake link. */
async function newApplicant() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  const caregiver = dataLayer.startIntake('hoosier-home-care')!;
  return { backend, dataLayer, caregiverId: caregiver.id, system: createSystemDataLayer(backend) };
}

describe('document upload (R11, ADR-15)', () => {
  it('stores the file and a documents row with the same id, and keeps the item Pending with its type and date', async () => {
    const { dataLayer, caregiverId } = await newApplicant();

    const result = await uploadDocument(dataLayer, photo(), applicant);

    expect(result.ok).toBe(true);
    const documentId = result.ok ? result.documentId : '';
    expect(dataLayer.get('documents', documentId)).toMatchObject({
      caregiver_id: caregiverId,
      agency_id: 'agency-a',
      item_key: 'photo_id',
      file_name: 'photo-id.jpg',
      file_type: 'image/jpeg',
      expiration_date: '2030-06-30',
    });
    const stored = await dataLayer.getDocument(documentId);
    expect(stored?.meta).toMatchObject({ caregiver_id: caregiverId, item_key: 'photo_id', file_type: 'image/jpeg' });
    expect(await stored?.file.text()).toBe('compressed photo');
    expect(dataLayer.get('required_items', `ri-${caregiverId}-photo_id`)).toMatchObject({
      status: 'Pending',
      expiration_date: '2030-06-30',
      evidence: 'Uploaded photo-id.jpg',
    });
  });

  it('rejects a 12 MB file and an unsupported format, and saves nothing', async () => {
    const { dataLayer, system } = await newApplicant();
    const documentsBefore = system.list('documents').length;

    const tooBig = await uploadDocument(dataLayer, photo({ originalSize: 12 * 1024 * 1024 }), applicant);
    const gif = await uploadDocument(
      dataLayer,
      photo({ originalType: 'image/gif', file: new Blob(['gif'], { type: 'image/gif' }), fileName: 'photo.gif' }),
      applicant,
    );

    expect(tooBig).toEqual({ ok: false, errors: { file: "This file is 12.0 MB. Choose one that's 10 MB or smaller." } });
    expect(gif).toEqual({ ok: false, errors: { file: 'Choose a JPG, PNG, or PDF file.' } });
    expect(system.list('documents')).toHaveLength(documentsBefore);
    expect(await dataLayer.listDocuments()).toEqual([]);
  });

  it('accepts a file of exactly 10 MB, and PDFs and PNGs', async () => {
    const { dataLayer } = await newApplicant();

    expect((await uploadDocument(dataLayer, photo({ originalSize: MAX_UPLOAD_BYTES }), applicant)).ok).toBe(true);
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    expect(
      (await uploadDocument(dataLayer, photo({ itemKey: 'tb_test', file: pdf, originalType: 'application/pdf' }), applicant)).ok,
    ).toBe(true);
    expect((await uploadDocument(dataLayer, photo({ itemKey: 'cpr_first_aid', originalType: 'image/png' }), applicant)).ok).toBe(
      true,
    );
  });

  it('requires an expiration date', async () => {
    const { dataLayer } = await newApplicant();

    expect(await uploadDocument(dataLayer, photo({ expirationDate: '' }), applicant)).toEqual({
      ok: false,
      errors: { expiration_date: 'Enter the expiration date shown on the document.' },
    });
  });

  it("refuses items that don't take an upload or aren't Pending", async () => {
    const { dataLayer, system, caregiverId } = await newApplicant();

    const check = await uploadDocument(dataLayer, photo({ itemKey: 'background_check' }), applicant);
    expect(!check.ok && check.errors.file).toBe("This item doesn't need an upload. We check it for you.");

    system.update('required_items', `ri-${caregiverId}-photo_id`, { status: 'Verified' }, { role: 'system', name: 'CareMatch' });
    const verified = await uploadDocument(dataLayer, photo(), applicant);
    expect(!verified.ok && verified.errors.file).toBe("This document is already Verified, so it can't be changed here.");
  });

  it("only touches the signed-in applicant's own application", async () => {
    const { dataLayer, system, caregiverId } = await newApplicant();

    await uploadDocument(dataLayer, photo(), applicant);

    // Maria's seeded photo ID item is untouched.
    expect(system.get('required_items', 'ri-cg-01-photo_id')?.evidence).toBe('Seeded sample upload (no image)');
    expect((await dataLayer.listDocuments()).every((document) => document.meta.caregiver_id === caregiverId)).toBe(true);
  });

  it('points the item at the newest document when a Pending item is uploaded again', async () => {
    const { dataLayer, caregiverId } = await newApplicant();

    await uploadDocument(dataLayer, photo(), applicant);
    await uploadDocument(dataLayer, photo({ fileName: 'photo-id-clearer.jpg', expirationDate: '2031-01-15' }), applicant);

    expect(dataLayer.get('required_items', `ri-${caregiverId}-photo_id`)).toMatchObject({
      expiration_date: '2031-01-15',
      evidence: 'Uploaded photo-id-clearer.jpg',
    });
    expect(dataLayer.list('documents').filter((row) => row.caregiver_id === caregiverId)).toHaveLength(2);
  });
});
