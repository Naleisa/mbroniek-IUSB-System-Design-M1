import { describe, expect, it } from 'vitest';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { StoredDocument } from './storageBackend';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const system: Actor = { role: 'system', name: 'CareMatch' };
const maria: Actor = { role: 'applicant', name: 'Maria Gonzalez' };

function file(id: string, caregiverId: string, extra: Record<string, string> = {}): StoredDocument {
  return {
    id,
    file: new Blob(['sample'], { type: 'image/jpeg' }),
    meta: { caregiver_id: caregiverId, item_key: 'tb_test', file_name: `${id}.jpg`, ...extra },
  };
}

/** Full seed plus stored files for Maria (cg-01, Hoosier), Grace (cg-07, Hoosier), and Hannah (cg-11, Riverbend). */
async function seedWithFiles() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  const system_ = createSystemDataLayer(backend);
  await system_.putDocument(file('doc-maria', 'cg-01'), system);
  await system_.putDocument(file('doc-grace', 'cg-07'), system);
  await system_.putDocument(file('doc-hannah', 'cg-11'), system);
  return dataLayer;
}

async function signInAsMaria(dataLayer: Awaited<ReturnType<typeof seedWithFiles>>) {
  dataLayer.requestSignInLink('maria.gonzalez@example.com');
  const token = /token=([^&\s]+)/.exec(dataLayer.list('notifications').slice(-1)[0].body)?.[1] ?? '';
  expect(dataLayer.signInWithLink(decodeURIComponent(token)).ok).toBe(true);
}

describe('documents behind the access filter (R4, R11, ADR-15)', () => {
  it("lets a coordinator read only their own agency's files", async () => {
    const dataLayer = await seedWithFiles();
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');

    const ids = (await dataLayer.listDocuments()).map((document) => document.id).sort();

    expect(ids).toEqual(['doc-grace', 'doc-maria']);
    expect(await dataLayer.getDocument('doc-grace')).toBeDefined();
    expect(await dataLayer.getDocument('doc-hannah')).toBeUndefined();
  });

  it('lets an applicant upload and read only their own files', async () => {
    const dataLayer = await seedWithFiles();
    await signInAsMaria(dataLayer);

    await dataLayer.putDocument(file('doc-maria-2', 'cg-01'), maria);

    const ids = (await dataLayer.listDocuments()).map((document) => document.id).sort();
    expect(ids).toEqual(['doc-maria', 'doc-maria-2']);
    expect(await dataLayer.getDocument('doc-grace')).toBeUndefined();
    await expect(dataLayer.putDocument(file('doc-for-james', 'cg-02'), maria)).rejects.toThrow(
      /your own application/,
    );
  });

  it('tags every file with its caregiver agency, whatever the caller sends', async () => {
    const dataLayer = await seedWithFiles();
    await signInAsMaria(dataLayer);

    await dataLayer.putDocument(file('doc-tagged', 'cg-01', { agency_id: 'agency-b' }), maria);

    expect((await dataLayer.getDocument('doc-tagged'))?.meta.agency_id).toBe('agency-a');
  });

  it('refuses a file that belongs to no caregiver', async () => {
    const dataLayer = await seedWithFiles();

    await expect(
      dataLayer.putDocument({ id: 'doc-orphan', file: new Blob(['x']), meta: {} }, system),
    ).rejects.toThrow(/belong to a caregiver/);
    await expect(dataLayer.putDocument(file('doc-unknown', 'cg-99'), system)).rejects.toThrow(/No caregivers row/);
  });
});
