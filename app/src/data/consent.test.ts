import { afterEach, describe, expect, it, vi } from 'vitest';
import { consentWording, CONSENT_WORDING_VERSION } from './consentWording';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { currentConsent, recordConsent } from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const applicant: Actor = { role: 'applicant', name: 'Nina Lopez' };

/** Full seed, with a new applicant started from Agency A's intake link. */
async function newApplicant() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  const caregiver = dataLayer.startIntake('hoosier-home-care')!;
  const consentsFor = () => dataLayer.list('consents').filter((row) => row.caregiver_id === caregiver.id);
  return { backend, dataLayer, caregiverId: caregiver.id, consentsFor };
}

describe('disclosure and authorization screens (R3, ADR-16, C8)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds one consent row per screen, each with its timestamp and wording version', async () => {
    const { dataLayer, consentsFor } = await newApplicant();
    vi.useFakeTimers({ now: new Date(2026, 9, 5, 18, 40), toFake: ['Date'] });

    expect(recordConsent(dataLayer, 'disclosure', 'acknowledged', applicant).ok).toBe(true);
    vi.setSystemTime(new Date(2026, 9, 5, 18, 42));
    expect(recordConsent(dataLayer, 'authorization', 'granted', applicant).ok).toBe(true);

    const rows = consentsFor().map(({ type, decision, wording_version, recorded_at }) => ({
      type,
      decision,
      wording_version,
      recorded_at,
    }));
    expect(rows).toEqual([
      { type: 'disclosure', decision: 'acknowledged', wording_version: 'v1.0', recorded_at: '2026-10-05T18:40' },
      { type: 'authorization', decision: 'granted', wording_version: 'v1.0', recorded_at: '2026-10-05T18:42' },
    ]);
  });

  it('does not record the same answer twice', async () => {
    const { dataLayer, consentsFor } = await newApplicant();

    recordConsent(dataLayer, 'disclosure', 'acknowledged', applicant);
    recordConsent(dataLayer, 'disclosure', 'acknowledged', applicant);

    expect(consentsFor()).toHaveLength(1);
    expect(currentConsent(dataLayer, 'disclosure')?.decision).toBe('acknowledged');
  });

  it('refuses authorization before the disclosure is read', async () => {
    const { dataLayer, consentsFor } = await newApplicant();

    expect(recordConsent(dataLayer, 'authorization', 'granted', applicant)).toEqual({
      ok: false,
      reason: 'Please read the background check disclosure first.',
    });
    expect(consentsFor()).toEqual([]);
  });

  it("records consent only on the signed-in applicant's own record, and audits it", async () => {
    const { backend, dataLayer, caregiverId } = await newApplicant();
    const system = createSystemDataLayer(backend);
    const seededConsents = system.list('consents').filter((row) => row.caregiver_id !== caregiverId).length;

    const result = recordConsent(dataLayer, 'disclosure', 'acknowledged', applicant);

    expect(result.ok && result.consent.caregiver_id).toBe(caregiverId);
    expect(system.list('consents').filter((row) => row.caregiver_id !== caregiverId)).toHaveLength(seededConsents);
    const event = system.list(AUDIT_TABLE).find((row) => result.ok && row.record_id === result.consent.id);
    expect(event).toMatchObject({ actor_role: 'applicant', actor_name: 'Nina Lopez', table: 'consents' });
  });

  it('names the applicant agency in the wording and keeps one version for both screens', () => {
    expect(CONSENT_WORDING_VERSION).toBe('v1.0');
    expect(consentWording('disclosure', 'Hoosier Home Care').paragraphs[0]).toContain('Hoosier Home Care will get');
    expect(consentWording('authorization', 'Hoosier Home Care').paragraphs[0]).toContain('I authorize Hoosier Home Care');
  });
});
