import { describe, expect, it } from 'vitest';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { runExpirationJob } from './jobs';
import { createMemoryBackend } from './memoryBackend';
import { formatLocalDateTime } from './relativeDates';
import type { SeedFiles } from './seed';
import type { Actor } from './types';
import { expirationWorklist, requestReplacement } from './worklist';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };

async function danaSignedIn() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  return { dataLayer, system: createSystemDataLayer(backend) };
}

describe('expiration worklist (R15, C6, ADR-19)', () => {
  it("lists each Expiring item with its caregiver and date, and expired items separately, for the coordinator's agency only", async () => {
    const { dataLayer } = await danaSignedIn();

    const worklist = expirationWorklist(dataLayer);

    expect(worklist.expiring).toEqual([
      expect.objectContaining({
        caregiverId: 'cg-06',
        caregiverName: 'Robert King',
        itemName: 'CPR and First Aid certification',
        status: 'Expiring',
        when: 'in 20 days',
        replacement: { status: 'Requested', dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      }),
    ]);
    expect(worklist.expired).toEqual([
      expect.objectContaining({ caregiverName: 'Samuel Okafor', itemName: 'TB test result', when: '5 days ago' }),
    ]);
    expect([...worklist.expiring, ...worklist.expired].every((row) => !['cg-11', 'cg-12', 'cg-13'].includes(row.caregiverId))).toBe(
      true,
    );
  });

  it('requests a replacement and notifies the caregiver by email and text', async () => {
    const { dataLayer, system } = await danaSignedIn();

    const result = requestReplacement(dataLayer, 'ri-cg-08-tb_test', dana);

    expect(result.ok).toBe(true);
    const request = result.ok ? result.request : {};
    const inFourteenDays = new Date(dataLayer.today());
    inFourteenDays.setDate(inFourteenDays.getDate() + 14);
    expect(request).toMatchObject({
      caregiver_id: 'cg-08',
      item_key: 'tb_test',
      status: 'Requested',
      requested_by: 'u-coord-a',
      due_date: formatLocalDateTime(inFourteenDays).slice(0, 10),
    });
    const messages = system.list('notifications').filter((row) => row.caregiver_id === 'cg-08' && row.recipient_user_id === 'u-cg-08');
    expect(messages.map((row) => row.channel).sort()).toEqual(['email', 'sms']);
    expect(messages.find((row) => row.channel === 'email')?.subject).toBe('Please replace your TB test result');
    expect(expirationWorklist(dataLayer).expired[0].replacement?.status).toBe('Requested');
  });

  it('uses the expiration date as the due date for an item that is still Expiring', async () => {
    const { dataLayer, system } = await danaSignedIn();
    // Grace Kim's TB test: Verified, made Expiring by setting its date 10 days out and running the job.
    const tenDaysOut = new Date(dataLayer.today());
    tenDaysOut.setDate(tenDaysOut.getDate() + 10);
    const date = formatLocalDateTime(tenDaysOut).slice(0, 10);
    system.update('required_items', 'ri-cg-07-tb_test', { expiration_date: date }, { role: 'system', name: 'CareMatch' });
    runExpirationJob(system, system.today());

    const result = requestReplacement(dataLayer, 'ri-cg-07-tb_test', dana);

    expect(result.ok && result.request.due_date).toBe(date);
  });

  it('refuses an item that already has an open request, one that is still current, and applicants', async () => {
    const { dataLayer } = await danaSignedIn();

    expect(requestReplacement(dataLayer, 'ri-cg-06-cpr_first_aid', dana)).toEqual({
      ok: false,
      reason: 'A replacement has already been requested for this item.',
    });
    expect(requestReplacement(dataLayer, 'ri-cg-06-photo_id', dana)).toEqual({
      ok: false,
      reason: 'Only an expiring or expired item needs a replacement.',
    });
    expect(requestReplacement(dataLayer, 'ri-cg-08-tb_test', { role: 'applicant', name: 'Samuel Okafor' }).ok).toBe(false);
  });

  it('grows as the demo date moves forward', async () => {
    const { dataLayer, system } = await danaSignedIn();
    const later = new Date(dataLayer.today());
    later.setDate(later.getDate() + 150);
    dataLayer.setDemoDate(formatLocalDateTime(later).slice(0, 10));
    runExpirationJob(system, system.today());

    expect(expirationWorklist(dataLayer).expiring.length).toBeGreaterThan(1);
  });
});
