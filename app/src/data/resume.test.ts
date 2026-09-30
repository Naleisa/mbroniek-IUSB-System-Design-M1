import { describe, expect, it } from 'vitest';
import { createDataLayer } from './dataLayer';
import {
  declineAuthorization,
  recordConsent,
  resumeStep,
  saveIdentityStep,
  submitIntake,
  uploadDocument,
  whatYoullNeed,
  type IdentityFields,
} from './intake';
import { createMemoryBackend } from './memoryBackend';
import { formatLocalDateTime } from './relativeDates';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const nina: Actor = { role: 'applicant', name: 'Nina Lopez' };
const NINA: IdentityFields = {
  first_name: 'Nina',
  last_name: 'Lopez',
  email: 'nina.lopez@example.com',
  phone: '(574) 555-0142',
  date_of_birth: '1990-04-12',
  ssn: '900-30-0001',
};

async function newApplicant() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.startIntake('hoosier-home-care');
  return dataLayer;
}

type DataLayer = Awaited<ReturnType<typeof newApplicant>>;

async function upload(dataLayer: DataLayer, itemKey: string) {
  await uploadDocument(
    dataLayer,
    {
      itemKey,
      file: new Blob(['photo'], { type: 'image/jpeg' }),
      fileName: `${itemKey}.jpg`,
      originalType: 'image/jpeg',
      originalSize: 1024,
      expirationDate: '2030-06-30',
    },
    nina,
  );
}

/** The token in the newest resume email to Nina. */
function resumeToken(dataLayer: DataLayer): string {
  const email = dataLayer
    .outboxFor('nina.lopez@example.com')
    .find((message) => message.subject === 'Continue your CareMatch application');
  return decodeURIComponent(/token=([^&\s]+)/.exec(email?.body ?? '')?.[1] ?? '');
}

describe('resuming an abandoned intake (R8, ADR-05)', () => {
  it('resumes at the first unfinished step', async () => {
    const dataLayer = await newApplicant();
    expect(resumeStep(dataLayer)).toBe('/applicant/intake/identity');

    saveIdentityStep(dataLayer, NINA, nina);
    expect(resumeStep(dataLayer)).toBe('/applicant/intake/needed');

    await upload(dataLayer, 'photo_id');
    expect(resumeStep(dataLayer)).toBe('/applicant/intake/uploads');

    for (const item of whatYoullNeed(dataLayer).upload) {
      await upload(dataLayer, item.item_key);
    }
    expect(resumeStep(dataLayer)).toBe('/applicant/intake/disclosure');

    recordConsent(dataLayer, 'disclosure', 'acknowledged', nina);
    expect(resumeStep(dataLayer)).toBe('/applicant/intake/authorization');

    declineAuthorization(dataLayer, nina);
    expect(resumeStep(dataLayer)).toBe('/applicant/intake/authorization');

    recordConsent(dataLayer, 'authorization', 'granted', nina);
    expect(resumeStep(dataLayer)).toBe('/applicant/intake/review');

    submitIntake(dataLayer, nina);
    expect(resumeStep(dataLayer)).toBe('/applicant');
  });

  it('emails one resume link when About you is first saved, valid for the 7-day window', async () => {
    const dataLayer = await newApplicant();

    saveIdentityStep(dataLayer, NINA, nina);
    saveIdentityStep(dataLayer, { ...NINA, phone: '(574) 555-0199', ssn: '' }, nina);

    const emails = dataLayer
      .outboxFor('nina.lopez@example.com')
      .filter((message) => message.subject === 'Continue your CareMatch application');
    expect(emails).toHaveLength(1);
    expect(emails[0].body).toMatch(/^Hi Nina, you can pick up your application where you left off any time in the next 7 days: #\/auth\?token=/);
    expect(emails[0].body).toContain(`next=${encodeURIComponent('/applicant/resume')}`);
  });

  it('sends a new resume link when the email changes', async () => {
    const dataLayer = await newApplicant();
    saveIdentityStep(dataLayer, NINA, nina);

    saveIdentityStep(dataLayer, { ...NINA, email: 'nina.l@example.com', ssn: '' }, nina);

    // One link for the first address and one for the new one; the outbox is per applicant.
    expect(dataLayer.outboxFor('nina.l@example.com').map((message) => message.subject)).toEqual([
      'Continue your CareMatch application',
      'Continue your CareMatch application',
    ]);
  });

  it('signs a returning applicant back in and sends them on to their next step', async () => {
    const dataLayer = await newApplicant();
    saveIdentityStep(dataLayer, NINA, nina);
    await upload(dataLayer, 'photo_id');
    const token = resumeToken(dataLayer);
    dataLayer.signOut();

    const result = dataLayer.signInWithLink(token);

    expect(result).toMatchObject({ ok: true, next: '/applicant/resume' });
    expect(resumeStep(dataLayer)).toBe('/applicant/intake/uploads');
  });

  it('refuses the link after the resume window, moved with the demo date', async () => {
    const dataLayer = await newApplicant();
    saveIdentityStep(dataLayer, NINA, nina);
    const token = resumeToken(dataLayer);
    dataLayer.signOut();

    const eightDaysOut = new Date(dataLayer.today());
    eightDaysOut.setDate(eightDaysOut.getDate() + 8);
    dataLayer.setDemoDate(formatLocalDateTime(eightDaysOut).slice(0, 10));

    expect(dataLayer.signInWithLink(token)).toEqual({
      ok: false,
      reason: 'This sign-in link has expired. Please request a new one.',
      email: 'nina.lopez@example.com',
    });
    // A fresh link still works: the partial record is kept.
    expect(dataLayer.requestSignInLink('nina.lopez@example.com')).toBe(true);
  });
});
