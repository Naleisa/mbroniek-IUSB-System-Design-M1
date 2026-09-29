import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { SEED_TABLES, type SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };

async function signedInAs(email: string) {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn(email, 'demo1234');
  return { backend, dataLayer };
}

/** Caregiver ids in Agency B (Riverbend), from the unfiltered seed. */
function agencyBCaregivers(backend: ReturnType<typeof createMemoryBackend>): string[] {
  return createSystemDataLayer(backend)
    .list('caregivers')
    .filter((caregiver) => caregiver.agency_id === 'agency-b')
    .map((caregiver) => caregiver.id);
}

describe('agency filter for coordinators (R4, C7)', () => {
  it('shows Agency A coordinator zero Agency B rows from every table', async () => {
    const { backend, dataLayer } = await signedInAs('dana.whitfield@hoosierhomecare.example');
    const agencyB = agencyBCaregivers(backend);
    expect(agencyB).toEqual(['cg-11', 'cg-12', 'cg-13']);

    for (const table of [...SEED_TABLES, AUDIT_TABLE]) {
      for (const row of dataLayer.list(table)) {
        expect(row.agency_id === 'agency-b' || agencyB.includes(row.caregiver_id) || row.id === 'agency-b', `${table} ${row.id}`).toBe(
          false,
        );
      }
    }
  });

  it('shows Agency A coordinator their own agency records', async () => {
    const { dataLayer } = await signedInAs('dana.whitfield@hoosierhomecare.example');

    expect(dataLayer.list('agencies').map((agency) => agency.id)).toEqual(['agency-a']);
    expect(dataLayer.list('caregivers')).toHaveLength(10);
    expect(dataLayer.list('required_items')).toHaveLength(80);
    expect(dataLayer.list('users').every((user) => user.agency_id === 'agency-a')).toBe(true);
    // Shared tables stay visible to every agency.
    expect(dataLayer.list('template_items')).toHaveLength(8);
    expect(dataLayer.list('settings')).toHaveLength(4);
  });

  it('shows Agency B coordinator only their own caregivers', async () => {
    const { dataLayer } = await signedInAs('marcus.lee@riverbendcaregivers.example');

    expect(dataLayer.list('caregivers').map((caregiver) => caregiver.id)).toEqual(['cg-11', 'cg-12', 'cg-13']);
  });

  it('returns nothing from get for another agency record', async () => {
    const { dataLayer } = await signedInAs('dana.whitfield@hoosierhomecare.example');

    expect(dataLayer.get('caregivers', 'cg-12')).toBeUndefined();
    expect(dataLayer.get('agencies', 'agency-b')).toBeUndefined();
    expect(dataLayer.get('caregivers', 'cg-07')?.first_name).toBe('Grace');
  });

  it('refuses writes to another agency records', async () => {
    const { dataLayer } = await signedInAs('dana.whitfield@hoosierhomecare.example');

    expect(() => dataLayer.update('caregivers', 'cg-12', { phone: '(574) 555-0199' }, dana)).toThrow(/own agency/);
    expect(() => dataLayer.update('caregivers', 'cg-07', { agency_id: 'agency-b' }, dana)).toThrow(/own agency/);
    expect(() => dataLayer.insert('consents', { caregiver_id: 'cg-12', type: 'disclosure' }, dana)).toThrow(
      /own agency/,
    );
    expect(dataLayer.update('caregivers', 'cg-07', { phone: '(574) 555-0199' }, dana).phone).toBe('(574) 555-0199');
  });

  it('keeps the system data layer unfiltered for scheduled jobs', async () => {
    const { backend } = await signedInAs('dana.whitfield@hoosierhomecare.example');

    expect(createSystemDataLayer(backend).list('caregivers')).toHaveLength(13);
  });

  it('hides internal tables such as sign-in links from coordinators', async () => {
    const { backend, dataLayer } = await signedInAs('dana.whitfield@hoosierhomecare.example');
    createSystemDataLayer(backend).requestSignInLink('maria.gonzalez@example.com');

    expect(dataLayer.list('sign_in_links')).toEqual([]);
  });
});
