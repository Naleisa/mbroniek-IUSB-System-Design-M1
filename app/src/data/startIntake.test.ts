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

const SHARED_TABLES = ['settings', 'requirement_templates', 'template_items'];

async function seeded() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  return { backend, dataLayer, systemDataLayer: createSystemDataLayer(backend) };
}

describe('agency intake link (ADR-18, R4, R7, C7)', () => {
  it("creates an Intake In Progress record under Agency A with every template item Pending, and signs the applicant in", async () => {
    const { dataLayer, systemDataLayer } = await seeded();

    const caregiver = dataLayer.startIntake('hoosier-home-care');

    expect(caregiver).toMatchObject({ agency_id: 'agency-a', template_id: 'tpl-in-hha', lifecycle_state: 'Intake In Progress' });
    const user = dataLayer.getSignedInUser();
    expect(user).toMatchObject({ role: 'applicant', agency_id: 'agency-a', caregiver_id: caregiver!.id });
    // Signed in, the applicant reads their own new record and its items.
    expect(dataLayer.list('caregivers').map((row) => row.id)).toEqual([caregiver!.id]);
    const items = dataLayer.list('required_items');
    expect(items).toHaveLength(systemDataLayer.list('template_items').length);
    expect(items.every((item) => item.status === 'Pending' && item.source && item.method)).toBe(true);
    const event = systemDataLayer.list(AUDIT_TABLE).find((row) => row.record_id === caregiver!.id);
    expect(event).toMatchObject({ event: 'Record created', details: 'Started intake from the Hoosier Home Care link' });
  });

  it("keeps the new record under Agency A only", async () => {
    const { dataLayer } = await seeded();
    const caregiver = dataLayer.startIntake('hoosier-home-care')!;
    dataLayer.signOut();

    dataLayer.signIn('marcus.lee@riverbendcaregivers.example', 'demo1234');
    expect(dataLayer.get('caregivers', caregiver.id)).toBeUndefined();
    dataLayer.signOut();
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
    expect(dataLayer.get('caregivers', caregiver.id)?.lifecycle_state).toBe('Intake In Progress');
  });

  it('creates nothing for an unknown link', async () => {
    const { dataLayer, systemDataLayer } = await seeded();
    const before = systemDataLayer.list('caregivers').length;

    expect(dataLayer.startIntake('not-an-agency')).toBeUndefined();
    expect(dataLayer.startIntake('')).toBeUndefined();

    expect(systemDataLayer.list('caregivers')).toHaveLength(before);
    expect(dataLayer.getSignedInUser()).toBeUndefined();
    expect(dataLayer.agencyNameForIntake('hoosier-home-care')).toBe('Hoosier Home Care');
    expect(dataLayer.agencyNameForIntake('not-an-agency')).toBeUndefined();
  });

  it('never matches a new applicant with a blank email when requesting a sign-in link', async () => {
    const { dataLayer } = await seeded();
    dataLayer.startIntake('hoosier-home-care');
    dataLayer.signOut();

    expect(dataLayer.requestSignInLink('')).toBe(false);
    expect(dataLayer.requestSignInLink('   ')).toBe(false);
  });
});

describe('signed-out access (C7)', () => {
  it('returns only the shared tables while signed out', async () => {
    const { dataLayer } = await seeded();

    for (const table of [...SEED_TABLES, AUDIT_TABLE, 'notifications', 'sign_in_links']) {
      const rows = dataLayer.list(table);
      if (SHARED_TABLES.includes(table)) {
        expect(rows.length, table).toBeGreaterThan(0);
      } else {
        expect(rows, table).toEqual([]);
      }
    }
    expect(dataLayer.get('caregivers', 'cg-01')).toBeUndefined();
    expect(await dataLayer.listDocuments()).toEqual([]);
  });

  it('refuses writes while signed out', async () => {
    const { dataLayer } = await seeded();
    const anyone: Actor = { role: 'applicant', name: 'Someone' };

    expect(() => dataLayer.update('caregivers', 'cg-01', { phone: '(574) 555-0199' }, anyone)).toThrow(/sign in/);
    expect(() => dataLayer.insert('consents', { caregiver_id: 'cg-01' }, anyone)).toThrow(/sign in/);
  });

  it("looks up one address's outbox while signed out, and nothing else", async () => {
    const { dataLayer } = await seeded();
    dataLayer.requestSignInLink('maria.gonzalez@example.com');
    dataLayer.requestSignInLink('james.carter@example.com');

    const maria = dataLayer.outboxFor('Maria.Gonzalez@example.com');
    expect(maria).toHaveLength(1);
    expect(maria[0].subject).toBe('Your CareMatch sign-in link');
    expect(maria[0].recipient_user_id).toBe('u-cg-01');
    expect(dataLayer.outboxFor('nobody@example.com')).toEqual([]);
    expect(dataLayer.outboxFor('')).toEqual([]);
  });
});
