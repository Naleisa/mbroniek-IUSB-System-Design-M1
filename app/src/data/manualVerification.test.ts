import { describe, expect, it } from 'vitest';
import { verifyManually } from './checks';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { formatLocalDateTime } from './relativeDates';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const maria: Actor = { role: 'applicant', name: 'Maria Gonzalez' };
const system: Actor = { role: 'system', name: 'CareMatch' };

// Tom Nguyen's certification is seeded in Manual Verification because the registry was unavailable.
const TOM_REGISTRY_ITEM = 'ri-cg-04-hha_certification';
const NOTE = 'Called the Indiana aide registry help line; certificate 55012 is active.';
const EXPIRES = '2027-06-30';

async function signedInAsDana() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  return { dataLayer, systemDataLayer: createSystemDataLayer(backend) };
}

describe('verifying an item by hand (R26, R22, R2, R14, C1)', () => {
  it('records the method, note, dates, and an audit event under the coordinator', async () => {
    const { dataLayer } = await signedInAsDana();
    const today = formatLocalDateTime(new Date()).slice(0, 10);

    const result = verifyManually(dataLayer, TOM_REGISTRY_ITEM, { note: NOTE, expirationDate: EXPIRES }, dana);

    expect(result.ok).toBe(true);
    expect(dataLayer.get('required_items', TOM_REGISTRY_ITEM)).toMatchObject({
      status: 'Verified',
      source: 'Indiana aide registry (mock)',
      method: 'Manual verification',
      verified_date: today,
      expiration_date: EXPIRES,
      result: 'Verified by hand',
      evidence: NOTE,
      notes: '',
    });
    const event = dataLayer.list(AUDIT_TABLE).filter((row) => row.record_id === TOM_REGISTRY_ITEM).slice(-1)[0];
    expect(event).toMatchObject({ actor_role: 'coordinator', actor_name: 'Dana Whitfield', caregiver_id: 'cg-04' });
  });

  it('refuses the system and applicants', async () => {
    const { dataLayer } = await signedInAsDana();
    const verification = { note: NOTE, expirationDate: EXPIRES };

    expect(verifyManually(dataLayer, TOM_REGISTRY_ITEM, verification, system)).toEqual({
      ok: false,
      reason: 'Only a coordinator can verify an item by hand.',
    });
    expect(verifyManually(dataLayer, TOM_REGISTRY_ITEM, verification, maria).ok).toBe(false);
    expect(dataLayer.get('required_items', TOM_REGISTRY_ITEM)?.status).toBe('Manual Verification');
  });

  it('refuses items in any other status', async () => {
    const { dataLayer } = await signedInAsDana();
    const verification = { note: NOTE, expirationDate: EXPIRES };

    expect(verifyManually(dataLayer, 'ri-cg-04-photo_id', verification, dana)).toEqual({
      ok: false,
      reason: 'Only items in Manual Verification can be verified by hand. This one is Verified.',
    });
    expect(verifyManually(dataLayer, 'ri-cg-02-hha_certification', verification, dana).ok).toBe(false);
  });

  it('requires a note and a real expiration date that has not passed', async () => {
    const { dataLayer } = await signedInAsDana();
    const verify = (note: string, expirationDate: string) =>
      verifyManually(dataLayer, TOM_REGISTRY_ITEM, { note, expirationDate }, dana);

    expect(verify('   ', EXPIRES)).toEqual({ ok: false, reason: 'Describe what you checked before marking this verified.' });
    expect(verify(NOTE, '')).toEqual({ ok: false, reason: 'Enter the expiration date as a real date (YYYY-MM-DD).' });
    expect(verify(NOTE, '2027-02-30').ok).toBe(false);
    expect(verify(NOTE, '2020-01-01')).toEqual({
      ok: false,
      reason: 'That expiration date has already passed, so this item cannot be marked verified.',
    });
    expect(dataLayer.get('required_items', TOM_REGISTRY_ITEM)?.status).toBe('Manual Verification');
  });

  it("can't find another agency's items", async () => {
    const { dataLayer, systemDataLayer } = await signedInAsDana();
    systemDataLayer.update('required_items', 'ri-cg-11-hha_certification', { status: 'Manual Verification' }, system);

    expect(verifyManually(dataLayer, 'ri-cg-11-hha_certification', { note: NOTE, expirationDate: EXPIRES }, dana)).toEqual({
      ok: false,
      reason: 'We could not find that item.',
    });
  });

  it('moves a record in screening to Eligible when the last item is verified by hand', async () => {
    const { dataLayer, systemDataLayer } = await signedInAsDana();
    systemDataLayer.update(
      'required_items',
      'ri-cg-04-background_check',
      { status: 'Verified', verified_date: '2026-01-01', expiration_date: EXPIRES },
      system,
    );
    expect(dataLayer.get('caregivers', 'cg-04')?.lifecycle_state).toBe('Screening In Progress');

    verifyManually(dataLayer, TOM_REGISTRY_ITEM, { note: NOTE, expirationDate: EXPIRES }, dana);

    expect(dataLayer.get('caregivers', 'cg-04')?.lifecycle_state).toBe('Eligible');
  });
});
