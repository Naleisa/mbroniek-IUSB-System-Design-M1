import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDataLayer } from './dataLayer';
import { applicantStatus } from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

/** Full seed with one seeded applicant signed in by magic link. */
async function signedInAs(email: string) {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.requestSignInLink(email);
  const token = /token=([^&\s]+)/.exec(dataLayer.outboxFor(email)[0].body)?.[1] ?? '';
  expect(dataLayer.signInWithLink(decodeURIComponent(token)).ok).toBe(true);
  return dataLayer;
}

function item(status: NonNullable<ReturnType<typeof applicantStatus>>, key: string) {
  return status.items.find((entry) => entry.item_key === key);
}

describe('applicant status page (R6, R18, R16)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an unsubmitted applicant what is waiting on them and what starts later', async () => {
    const status = applicantStatus(await signedInAs('maria.gonzalez@example.com'))!;

    expect(status).toMatchObject({
      agencyName: 'Hoosier Home Care',
      lifecycleState: 'Intake In Progress',
      summary: "Your application isn't submitted yet.",
    });
    expect(item(status, 'hha_certification')).toMatchObject({
      status: 'Pending',
      waitingOn: 'Waiting on you to upload it',
      outstanding: true,
    });
    expect(item(status, 'photo_id')?.waitingOn).toBe('Waiting on Hoosier Home Care to review it');
    expect(item(status, 'background_check')?.waitingOn).toBe('Starts after you submit your application');
    expect(status.items).toHaveLength(8);
  });

  it('shows how long a delayed background check has been waiting', async () => {
    const status = applicantStatus(await signedInAs('aisha.patel@example.com'))!;

    expect(item(status, 'background_check')).toMatchObject({
      status: 'Delayed',
      waitingOn: 'Taking longer than usual. Started 8 days ago. Hoosier Home Care is following up.',
      outstanding: true,
    });
    expect(status.summary).toBe('Your checks are in progress.');
  });

  it('explains a check to retry and an item to verify by hand', async () => {
    const status = applicantStatus(await signedInAs('tom.nguyen@example.com'))!;

    expect(item(status, 'background_check')?.waitingOn).toBe('Waiting on Hoosier Home Care to try again');
    expect(item(status, 'hha_certification')?.waitingOn).toBe('Waiting on Hoosier Home Care to check it by hand');
    expect(item(status, 'photo_id')).toMatchObject({ status: 'Verified', outstanding: false });
    expect(item(status, 'photo_id')?.waitingOn).toMatch(/^Done\. Good until \d{4}-\d{2}-\d{2}\.$/);
  });

  it('does not name an exclusion match to the applicant', async () => {
    const status = applicantStatus(await signedInAs('olivia.martin@example.com'))!;

    expect(status.summary).toBe("Hoosier Home Care is reviewing your checks. They'll contact you.");
    expect(JSON.stringify(status)).not.toMatch(/exclusion match|possible match/i);
  });

  it('shows a cleared caregiver an expiring item with its date', async () => {
    const status = applicantStatus(await signedInAs('robert.king@example.com'))!;

    expect(status.summary).toBe("You're cleared to work with Hoosier Home Care.");
    expect(item(status, 'cpr_first_aid')?.waitingOn).toMatch(
      /^Expires on \d{4}-\d{2}-\d{2}\. You'll be asked for a replacement\.$/,
    );
  });

  it('counts elapsed days by the demo date', async () => {
    const dataLayer = await signedInAs('hannah.schultz@example.com');
    expect(item(applicantStatus(dataLayer)!, 'background_check')?.waitingOn).toBe('In progress. Started 1 day ago.');

    const later = new Date(dataLayer.today());
    later.setDate(later.getDate() + 2);
    dataLayer.setDemoDate(
      `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, '0')}-${String(later.getDate()).padStart(2, '0')}`,
    );

    expect(item(applicantStatus(dataLayer)!, 'background_check')?.waitingOn).toBe('In progress. Started 3 days ago.');
  });

  it('returns nothing when no applicant is signed in', async () => {
    const dataLayer = await signedInAs('maria.gonzalez@example.com');
    dataLayer.signOut();

    expect(applicantStatus(dataLayer)).toBeUndefined();
  });
});
