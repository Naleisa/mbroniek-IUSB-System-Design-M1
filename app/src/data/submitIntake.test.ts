import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import {
  declineAuthorization,
  intakeChecklist,
  recordConsent,
  saveIdentityStep,
  submitIntake,
  uploadDocument,
  whatYoullNeed,
} from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const nina: Actor = { role: 'applicant', name: 'Nina Lopez' };

async function newApplicant() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  const caregiverId = dataLayer.startIntake('hoosier-home-care')!.id;
  return { dataLayer, system: createSystemDataLayer(backend), caregiverId };
}

function fillIdentity(dataLayer: Awaited<ReturnType<typeof newApplicant>>['dataLayer']) {
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
}

async function uploadAll(dataLayer: Awaited<ReturnType<typeof newApplicant>>['dataLayer'], except?: string) {
  for (const item of whatYoullNeed(dataLayer).upload.filter((entry) => entry.item_key !== except)) {
    await uploadDocument(
      dataLayer,
      {
        itemKey: item.item_key,
        file: new Blob(['photo'], { type: 'image/jpeg' }),
        fileName: `${item.item_key}.jpg`,
        originalType: 'image/jpeg',
        originalSize: 1024,
        expirationDate: '2030-06-30',
      },
      nina,
    );
  }
}

/** Nina Lopez with every intake step done. */
async function completeApplicant() {
  const setup = await newApplicant();
  fillIdentity(setup.dataLayer);
  await uploadAll(setup.dataLayer);
  recordConsent(setup.dataLayer, 'disclosure', 'acknowledged', nina);
  recordConsent(setup.dataLayer, 'authorization', 'granted', nina);
  return setup;
}

describe('submitting an intake (R7, ADR-08)', () => {
  it('moves a complete intake to Intake Complete and notifies the coordinator', async () => {
    const { dataLayer, system, caregiverId } = await completeApplicant();
    expect(intakeChecklist(dataLayer).every((line) => line.done)).toBe(true);

    expect(submitIntake(dataLayer, nina)).toEqual({ ok: true });

    expect(system.get('caregivers', caregiverId)?.lifecycle_state).toBe('Intake Complete');
    const email = system.list('notifications').find((row) => row.subject === 'New application: Nina Lopez');
    expect(email).toMatchObject({
      recipient_user_id: 'u-coord-a',
      channel: 'email',
      caregiver_id: caregiverId,
      body: "Nina Lopez submitted a complete application to Hoosier Home Care. It's ready for screening.",
    });
    const move = system
      .list(AUDIT_TABLE)
      .filter((row) => row.record_id === caregiverId && row.details.includes('Intake Complete'));
    expect(move[0]).toMatchObject({ actor_role: 'applicant', actor_name: 'Nina Lopez' });
  });

  it('refuses an intake with missing pieces, naming each one, and changes nothing', async () => {
    const { dataLayer, system, caregiverId } = await newApplicant();
    fillIdentity(dataLayer);
    await uploadAll(dataLayer, 'tb_test');

    const result = submitIntake(dataLayer, nina);

    expect(result).toEqual({
      ok: false,
      missing: [
        'Add your TB test result.',
        'Read the background check disclosure.',
        'Give your authorization for the background checks.',
      ],
    });
    expect(system.get('caregivers', caregiverId)?.lifecycle_state).toBe('Intake In Progress');
    expect(system.list('notifications').some((row) => row.subject.startsWith('New application'))).toBe(false);
  });

  it('refuses an intake with no identity details', async () => {
    const { dataLayer } = await newApplicant();

    const result = submitIntake(dataLayer, nina);

    expect(!result.ok && result.missing[0]).toBe('Finish your details in About you.');
  });

  it('refuses an intake whose authorization was declined', async () => {
    const { dataLayer } = await newApplicant();
    fillIdentity(dataLayer);
    await uploadAll(dataLayer);
    recordConsent(dataLayer, 'disclosure', 'acknowledged', nina);
    declineAuthorization(dataLayer, nina);

    const result = submitIntake(dataLayer, nina);

    expect(!result.ok && result.missing).toEqual([
      "You didn't authorize the background checks. Authorize them to submit.",
    ]);
  });

  it('refuses a second submission', async () => {
    const { dataLayer, system } = await completeApplicant();
    submitIntake(dataLayer, nina);

    expect(submitIntake(dataLayer, nina)).toEqual({
      ok: false,
      missing: ['Your application has already been submitted.'],
    });
    expect(system.list('notifications').filter((row) => row.subject === 'New application: Nina Lopez')).toHaveLength(1);
  });
});
