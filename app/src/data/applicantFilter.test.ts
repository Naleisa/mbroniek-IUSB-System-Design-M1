import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { SEED_TABLES, type SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const maria: Actor = { role: 'applicant', name: 'Maria Gonzalez' };

/** Signs Maria Gonzalez (cg-01) in through her magic link. */
async function signedInAsMaria() {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.requestSignInLink('maria.gonzalez@example.com');
  const token = /token=([^&\s]+)/.exec(dataLayer.list('notifications').slice(-1)[0].body)?.[1] ?? '';
  expect(dataLayer.signInWithLink(decodeURIComponent(token)).ok).toBe(true);
  return dataLayer;
}

describe('applicant filter (R4, R6)', () => {
  it('lets an applicant read their own record and items', async () => {
    const dataLayer = await signedInAsMaria();

    expect(dataLayer.list('caregivers').map((caregiver) => caregiver.id)).toEqual(['cg-01']);
    expect(dataLayer.get('caregivers', 'cg-01')?.first_name).toBe('Maria');
    expect(dataLayer.list('required_items')).toHaveLength(8);
    expect(dataLayer.list('documents').every((document) => document.caregiver_id === 'cg-01')).toBe(true);
    expect(dataLayer.list('users').map((user) => user.id)).toEqual(['u-cg-01']);
    expect(dataLayer.list('agencies').map((agency) => agency.id)).toEqual(['agency-a']);
    expect(dataLayer.list('notifications')).toHaveLength(1);
    // Shared tables stay readable, so intake can show what's needed and why.
    expect(dataLayer.list('template_items')).toHaveLength(8);
  });

  it('returns zero rows for another applicant from every table', async () => {
    const dataLayer = await signedInAsMaria();

    for (const table of [...SEED_TABLES, AUDIT_TABLE, 'sign_in_links']) {
      for (const row of dataLayer.list(table)) {
        const belongsToSomeoneElse =
          (row.caregiver_id && row.caregiver_id !== 'cg-01') ||
          (table === 'caregivers' && row.id !== 'cg-01') ||
          (table === 'users' && row.id !== 'u-cg-01');
        expect(belongsToSomeoneElse, `${table} ${row.id}`).toBe(false);
      }
    }
    expect(dataLayer.get('caregivers', 'cg-02')).toBeUndefined();
    expect(dataLayer.get('required_items', 'ri-cg-02-photo_id')).toBeUndefined();
  });

  it('hides internal compliance records from applicants', async () => {
    const dataLayer = await signedInAsMaria();

    expect(dataLayer.list('check_orders')).toEqual([]);
    expect(dataLayer.list(AUDIT_TABLE)).toEqual([]);
    expect(dataLayer.list('sign_in_links')).toEqual([]);
  });

  it('refuses changes to another applicant record', async () => {
    const dataLayer = await signedInAsMaria();

    expect(() => dataLayer.update('caregivers', 'cg-02', { phone: '(574) 555-0199' }, maria)).toThrow(
      /your own application/,
    );
    expect(() => dataLayer.insert('consents', { caregiver_id: 'cg-02', type: 'disclosure' }, maria)).toThrow(
      /your own application/,
    );
    expect(dataLayer.update('caregivers', 'cg-01', { phone: '(574) 555-0199' }, maria).phone).toBe('(574) 555-0199');
  });
});
