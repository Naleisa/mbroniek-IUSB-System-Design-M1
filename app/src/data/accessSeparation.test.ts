import { describe, expect, it } from 'vitest';
import caregiversCsv from '../../public/seed/caregivers.csv?raw';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { SEED_TABLES, type SeedFiles } from './seed';
import type { Row, StoredDocument } from './storageBackend';
import type { Actor } from './types';
import { createVendorVault, VAULT_TABLE } from './vault';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const system: Actor = { role: 'system', name: 'CareMatch' };
const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const marcus: Actor = { role: 'coordinator', name: 'Marcus Lee' };
const maria: Actor = { role: 'applicant', name: 'Maria Gonzalez' };

const TABLES = [...SEED_TABLES, AUDIT_TABLE, 'sign_in_links'];

function file(id: string, caregiverId: string): StoredDocument {
  return {
    id,
    file: new Blob(['sample'], { type: 'image/jpeg' }),
    meta: { caregiver_id: caregiverId, item_key: 'tb_test', file_name: `${id}.jpg` },
  };
}

/** Full seed plus stored files for Maria (cg-01) and James (cg-02) in Agency A, and Hannah (cg-11) in Agency B. */
async function seedWithFiles() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  const systemDataLayer = createSystemDataLayer(backend);
  await systemDataLayer.putDocument(file('doc-maria', 'cg-01'), system);
  await systemDataLayer.putDocument(file('doc-james', 'cg-02'), system);
  await systemDataLayer.putDocument(file('doc-hannah', 'cg-11'), system);
  const caregiversOf = (agencyId: string) =>
    systemDataLayer
      .list('caregivers')
      .filter((caregiver) => caregiver.agency_id === agencyId)
      .map((caregiver) => caregiver.id);
  return { backend, dataLayer, caregiversOf };
}

type DataLayer = Awaited<ReturnType<typeof seedWithFiles>>['dataLayer'];

async function signInAsMaria(dataLayer: DataLayer) {
  dataLayer.requestSignInLink('maria.gonzalez@example.com');
  const token = /token=([^&\s]+)/.exec(dataLayer.outboxFor('maria.gonzalez@example.com')[0].body)?.[1] ?? '';
  expect(dataLayer.signInWithLink(decodeURIComponent(token)).ok).toBe(true);
}

/** True when a row belongs to the given agency or to one of its caregivers. */
function belongsToAgency(table: string, row: Row, agencyId: string, caregiverIds: string[]): boolean {
  return (
    row.agency_id === agencyId ||
    caregiverIds.includes(row.caregiver_id) ||
    (table === 'agencies' && row.id === agencyId) ||
    (table === 'caregivers' && caregiverIds.includes(row.id))
  );
}

/** True when a row belongs to any caregiver other than the given one. */
function belongsToAnotherApplicant(table: string, row: Row, caregiverId: string): boolean {
  return (
    (!!row.caregiver_id && row.caregiver_id !== caregiverId) ||
    (table === 'caregivers' && row.id !== caregiverId) ||
    (table === 'users' && row.id !== `u-${caregiverId}`)
  );
}

/** Everything a screen can read through the data layer, records and file details, as one string. */
async function everythingScreensCanRead(dataLayer: DataLayer): Promise<string> {
  const records = TABLES.map((table) => dataLayer.list(table));
  const files = (await dataLayer.listDocuments()).map((document) => document.meta);
  return JSON.stringify([records, files]);
}

describe('access separation between agencies and applicants (R4, R5, C7, ADR-07)', () => {
  it("shows Agency A's coordinator none of Agency B's records or files, and only their own", async () => {
    const { dataLayer, caregiversOf } = await seedWithFiles();
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
    const agencyB = caregiversOf('agency-b');

    for (const table of TABLES) {
      for (const row of dataLayer.list(table)) {
        expect(belongsToAgency(table, row, 'agency-b', agencyB), `${table} ${row.id}`).toBe(false);
      }
    }
    expect(dataLayer.get('caregivers', 'cg-11')).toBeUndefined();
    expect(dataLayer.get('required_items', 'ri-cg-11-photo_id')).toBeUndefined();
    expect((await dataLayer.listDocuments()).map((document) => document.id).sort()).toEqual(['doc-james', 'doc-maria']);
    expect(await dataLayer.getDocument('doc-hannah')).toBeUndefined();

    // Own agency stays visible, so an empty result can't pass by accident.
    expect(dataLayer.list('caregivers')).toHaveLength(10);
    expect(dataLayer.get('caregivers', 'cg-01')?.first_name).toBe('Maria');
  });

  it("shows Agency B's coordinator none of Agency A's records or files, and only their own", async () => {
    const { dataLayer, caregiversOf } = await seedWithFiles();
    dataLayer.signIn('marcus.lee@riverbendcaregivers.example', 'demo1234');
    const agencyA = caregiversOf('agency-a');

    for (const table of TABLES) {
      for (const row of dataLayer.list(table)) {
        expect(belongsToAgency(table, row, 'agency-a', agencyA), `${table} ${row.id}`).toBe(false);
      }
    }
    expect(dataLayer.get('caregivers', 'cg-01')).toBeUndefined();
    expect((await dataLayer.listDocuments()).map((document) => document.id)).toEqual(['doc-hannah']);
    expect(await dataLayer.getDocument('doc-maria')).toBeUndefined();

    expect(dataLayer.list('caregivers').map((caregiver) => caregiver.id)).toEqual(['cg-11', 'cg-12', 'cg-13']);
  });

  it("refuses a coordinator's changes to another agency's records and files", async () => {
    const { dataLayer } = await seedWithFiles();
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');

    expect(() => dataLayer.update('caregivers', 'cg-11', { phone: '(574) 555-0199' }, dana)).toThrow(/your own agency/);
    await expect(dataLayer.putDocument(file('doc-for-hannah', 'cg-11'), dana)).rejects.toThrow(/your own agency/);

    dataLayer.signOut();
    dataLayer.signIn('marcus.lee@riverbendcaregivers.example', 'demo1234');
    expect(() => dataLayer.update('caregivers', 'cg-01', { phone: '(574) 555-0199' }, marcus)).toThrow(/your own agency/);
    await expect(dataLayer.putDocument(file('doc-for-maria', 'cg-01'), marcus)).rejects.toThrow(/your own agency/);
  });

  it("shows an applicant none of another applicant's records or files, in their agency or another", async () => {
    const { dataLayer } = await seedWithFiles();
    await signInAsMaria(dataLayer);

    for (const table of TABLES) {
      for (const row of dataLayer.list(table)) {
        expect(belongsToAnotherApplicant(table, row, 'cg-01'), `${table} ${row.id}`).toBe(false);
      }
    }
    expect(dataLayer.get('caregivers', 'cg-02')).toBeUndefined();
    expect(dataLayer.get('caregivers', 'cg-11')).toBeUndefined();
    expect(await dataLayer.getDocument('doc-james')).toBeUndefined();
    expect(await dataLayer.getDocument('doc-hannah')).toBeUndefined();

    expect(dataLayer.list('caregivers').map((caregiver) => caregiver.id)).toEqual(['cg-01']);
    expect((await dataLayer.listDocuments()).map((document) => document.id)).toEqual(['doc-maria']);
  });

  it("refuses an applicant's changes to another applicant's records and files", async () => {
    const { dataLayer } = await seedWithFiles();
    await signInAsMaria(dataLayer);

    expect(() => dataLayer.update('caregivers', 'cg-02', { phone: '(574) 555-0199' }, maria)).toThrow(
      /your own application/,
    );
    await expect(dataLayer.putDocument(file('doc-for-james', 'cg-02'), maria)).rejects.toThrow(/your own application/);
    await expect(dataLayer.putDocument(file('doc-for-hannah', 'cg-11'), maria)).rejects.toThrow(/your own application/);
  });

  it('returns no full SSN from any read a screen uses, for coordinators or applicants', async () => {
    const { backend, dataLayer } = await seedWithFiles();
    const seededSsns = caregiversCsv.match(/9\d{2}-\d{2}-\d{4}/g) ?? [];
    expect(seededSsns).toHaveLength(13);

    // The SSNs really are held in the vault, so the check below isn't passing over empty data.
    const vendorVault = createVendorVault(backend);
    const tokens = createSystemDataLayer(backend)
      .list('caregivers')
      .map((caregiver) => caregiver.ssn_token);
    expect(tokens.map((token) => vendorVault.readSsn(token)).sort()).toEqual([...seededSsns].sort());

    const signIns: Array<() => Promise<void>> = [
      async () => void dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234'),
      async () => void dataLayer.signIn('marcus.lee@riverbendcaregivers.example', 'demo1234'),
      () => signInAsMaria(dataLayer),
    ];
    for (const signIn of signIns) {
      dataLayer.signOut();
      await signIn();
      const readable = await everythingScreensCanRead(dataLayer);

      expect(readable).not.toMatch(/\d{3}-\d{2}-\d{4}/);
      expect(() => dataLayer.list(VAULT_TABLE)).toThrow(/vault cannot be read/);
      expect(() => dataLayer.get(VAULT_TABLE, 'anything')).toThrow(/vault cannot be read/);
    }
  });
});
