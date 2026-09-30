import { describe, expect, it } from 'vitest';
import { createBackgroundCheckVendor, orderCheck } from './checks';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { declineAuthorization, recordConsent, saveIdentityStep } from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const nina: Actor = { role: 'applicant', name: 'Nina Lopez' };
const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };

/** A new Agency A applicant, Nina Lopez, who has read the disclosure. */
async function ninaAtAuthorization() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  const caregiverId = dataLayer.startIntake('hoosier-home-care')!.id;
  saveIdentityStep(
    dataLayer,
    {
      first_name: 'Nina',
      last_name: 'Lopez',
      email: 'nina.lopez@example.com',
      phone: '(574) 555-0142',
      date_of_birth: '1990-04-12',
      ssn: '900-30-0001',
    },
    nina,
  );
  recordConsent(dataLayer, 'disclosure', 'acknowledged', nina);
  const system = createSystemDataLayer(backend);
  /** Dana orders Nina's background check. */
  const danaOrders = () => {
    dataLayer.signOut();
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
    return orderCheck(dataLayer, system, createBackgroundCheckVendor(backend), `ri-${caregiverId}-background_check`, dana);
  };
  return { dataLayer, system, caregiverId, danaOrders };
}

describe('declined consent (R25, ADR-16)', () => {
  it('keeps the record, notifies the coordinator, and stops checks from being ordered', async () => {
    const { dataLayer, system, caregiverId, danaOrders } = await ninaAtAuthorization();

    const result = declineAuthorization(dataLayer, nina);

    expect(result.ok && result.consent).toMatchObject({ type: 'authorization', decision: 'declined', wording_version: 'v1.0' });
    expect(system.get('caregivers', caregiverId)?.lifecycle_state).toBe('Intake In Progress');
    const email = system.list('notifications').find((row) => row.caregiver_id === caregiverId && row.recipient_user_id === 'u-coord-a');
    expect(email).toMatchObject({
      recipient_user_id: 'u-coord-a',
      channel: 'email',
      subject: 'Nina Lopez declined background check authorization',
      body: 'Screening has stopped for Nina Lopez. The application is kept.',
    });
    expect(danaOrders()).toEqual({ ok: false, reason: "Checks can't be ordered: Nina Lopez declined authorization." });
    expect(system.get('required_items', `ri-${caregiverId}-background_check`)?.status).toBe('Pending');
  });

  it("refuses checks for an applicant who hasn't given authorization yet", async () => {
    const { danaOrders } = await ninaAtAuthorization();

    expect(danaOrders()).toEqual({
      ok: false,
      reason: "Checks can't be ordered: Nina Lopez hasn't given authorization yet.",
    });
  });

  it('refuses checks for the seeded applicant who declined (Ethan Walker)', async () => {
    const backend = createMemoryBackend();
    const dataLayer = createDataLayer(backend);
    await dataLayer.loadSeed(async () => realSeed);
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');

    const result = orderCheck(
      dataLayer,
      createSystemDataLayer(backend),
      createBackgroundCheckVendor(backend),
      'ri-cg-10-background_check',
      dana,
    );

    expect(result).toEqual({ ok: false, reason: "Checks can't be ordered: Ethan Walker declined authorization." });
  });

  it('allows checks again when the applicant changes their mind, even within the same minute', async () => {
    const { dataLayer, caregiverId, danaOrders } = await ninaAtAuthorization();
    declineAuthorization(dataLayer, nina);

    // A newer "granted" answer replaces the decline; the decline stays on file.
    expect(recordConsent(dataLayer, 'authorization', 'granted', nina).ok).toBe(true);
    expect(
      dataLayer.list('consents').filter((row) => row.caregiver_id === caregiverId && row.type === 'authorization'),
    ).toHaveLength(2);
    expect(danaOrders().ok).toBe(true);
  });

  it("only emails the applicant's own agency, and refuses when no applicant is signed in", async () => {
    const { dataLayer, system } = await ninaAtAuthorization();

    dataLayer.notifyMyCoordinators('Test subject', 'Test body');
    const sent = system.list('notifications').filter((row) => row.subject === 'Test subject');
    expect(sent.map((row) => row.recipient_user_id)).toEqual(['u-coord-a']);

    dataLayer.signOut();
    expect(() => dataLayer.notifyMyCoordinators('Test subject', 'Test body')).toThrow(/sign in/);
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
    expect(() => dataLayer.notifyMyCoordinators('Test subject', 'Test body')).toThrow(/sign in/);
  });
});
