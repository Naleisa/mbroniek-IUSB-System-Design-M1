import { describe, expect, it } from 'vitest';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { caregiverRecord } from './record';
import type { SeedFiles } from './seed';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

async function signedInAs(email: string) {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn(email, 'demo1234');
  return { dataLayer, system: createSystemDataLayer(backend) };
}

const DANA = 'dana.whitfield@hoosierhomecare.example';

describe('caregiver record view (R2, R16, ADR-09)', () => {
  it('shows every template item with its status, source, method, and dates', async () => {
    const { dataLayer } = await signedInAs(DANA);

    const record = caregiverRecord(dataLayer, 'cg-03')!;

    expect(record).toMatchObject({ name: 'Aisha Patel', lifecycleState: 'Screening In Progress', ssnLast4: '0003' });
    expect(record.items.map((item) => item.name)).toEqual([
      'Government photo ID',
      'Home Health Aide certification',
      'Criminal background check',
      'OIG exclusion check',
      'SAM exclusion check',
      'TB test result',
      'CPR and First Aid certification',
      "Driver's license",
    ]);
    const oig = record.items.find((item) => item.item_key === 'oig_exclusion')!;
    expect(oig).toMatchObject({ status: 'Verified', source: 'OIG exclusion list (mock)', method: 'Exclusion screening' });
    expect(oig.verified_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(oig.expiration_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows elapsed time for delayed and ordered checks', async () => {
    const aisha = caregiverRecord((await signedInAs(DANA)).dataLayer, 'cg-03')!;
    expect(aisha.items.find((item) => item.item_key === 'background_check')).toMatchObject({
      status: 'Delayed',
      elapsed: 'Ordered 8 days ago',
    });
    expect(aisha.items.find((item) => item.item_key === 'photo_id')?.elapsed).toBe('');

    const hannah = caregiverRecord((await signedInAs('marcus.lee@riverbendcaregivers.example')).dataLayer, 'cg-11')!;
    expect(hannah.items.find((item) => item.item_key === 'background_check')).toMatchObject({
      status: 'Ordered',
      elapsed: 'Ordered 1 day ago',
    });
  });

  it("shows a retryable check's result and a manual-verification note", async () => {
    const tom = caregiverRecord((await signedInAs(DANA)).dataLayer, 'cg-04')!;

    expect(tom.items.find((item) => item.item_key === 'background_check')).toMatchObject({
      status: 'Retryable',
      result: 'Vendor failure',
    });
    expect(tom.items.find((item) => item.item_key === 'hha_certification')?.notes).toBe(
      'State registry unavailable. Verify the certificate by hand.',
    );
  });

  it('shows a cleared record with complete evidence and its open replacement request', async () => {
    const robert = caregiverRecord((await signedInAs(DANA)).dataLayer, 'cg-06')!;

    expect(robert.lifecycleState).toBe('Cleared');
    for (const item of robert.items) {
      expect(item.source && item.method && item.verified_date && item.expiration_date, item.name).toBeTruthy();
    }
    expect(robert.replacement).toMatch(/^Replacement requested for CPR and First Aid certification, due \d{4}-\d{2}-\d{2}$/);
    expect(robert.authorization).toMatch(/^Granted on \d{4}-\d{2}-\d{2}$/);
    expect(robert.templateIsSample).toBe(true);
  });

  it('shows a declined authorization', async () => {
    const ethan = caregiverRecord((await signedInAs(DANA)).dataLayer, 'cg-10')!;

    expect(ethan.authorizationDeclined).toBe(true);
    expect(ethan.authorization).toMatch(/^Declined on /);
  });

  it("finds nothing for another agency's caregiver", async () => {
    const { dataLayer } = await signedInAs(DANA);

    expect(caregiverRecord(dataLayer, 'cg-11')).toBeUndefined();
    expect(caregiverRecord(dataLayer, 'no-such-id')).toBeUndefined();
  });

  it('shows a template item with no record as Missing', async () => {
    const { dataLayer } = await signedInAs(DANA);
    // Take one item away through a seed edit, the way the clearing tests do.
    const backend = createMemoryBackend();
    const edited = createDataLayer(backend);
    await edited.loadSeed(async () => ({
      ...realSeed,
      required_items: realSeed.required_items
        .split('\n')
        .filter((line) => !line.startsWith('ri-cg-07-tb_test,'))
        .join('\n'),
    }));
    edited.signIn(DANA, 'demo1234');

    const grace = caregiverRecord(edited, 'cg-07')!;

    expect(grace.items.find((item) => item.item_key === 'tb_test')).toMatchObject({ status: 'Missing', source: 'Applicant upload' });
    expect(caregiverRecord(dataLayer, 'cg-07')!.items.find((item) => item.item_key === 'tb_test')?.status).toBe('Verified');
  });
});
