import { describe, expect, it } from 'vitest';
import { verifyDocument } from './checks';
import { createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { complianceReport } from './report';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };

async function signedInAs(email: string) {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn(email, 'demo1234');
  return dataLayer;
}

const DANA = 'dana.whitfield@hoosierhomecare.example';

describe('compliance report (R13, R2, ADR-14)', () => {
  it('lists every required item of a fully screened caregiver with source, method, dates, and evidence', async () => {
    const report = complianceReport(await signedInAs(DANA), 'cg-07')!;

    expect(report).toMatchObject({
      caregiverName: 'Grace Kim',
      agencyName: 'Hoosier Home Care',
      lifecycleState: 'Cleared',
      ssnLast4: '0001',
      summary: { complete: true, itemCount: 8, blockers: [] },
    });
    expect(report.items).toHaveLength(8);
    for (const item of report.items) {
      expect(item.status, item.name).toBe('Verified');
      expect(item.source && item.method && item.verified_date && item.expiration_date && item.evidence, item.name).toBeTruthy();
    }
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("includes each vendor check's history and the record's full audit timeline, oldest first", async () => {
    const report = complianceReport(await signedInAs(DANA), 'cg-07')!;

    const background = report.items.find((item) => item.item_key === 'background_check')!;
    expect(background.checkHistory).toEqual([
      { orderedAt: expect.any(String), completedAt: expect.any(String), result: 'Clear' },
    ]);
    expect(report.history.map((entry) => entry.event)).toEqual([
      'Record created',
      'Consent recorded',
      'State changed',
      'Checks ordered',
      'State changed',
      'Result received',
      'Item verified',
      'Documents verified',
      'State changed',
      'State changed',
    ]);
    expect(report.history[0].who).toBe('Grace Kim (applicant)');
    expect(report.history.slice(-1)[0]).toMatchObject({ who: 'Dana Whitfield (coordinator)', details: 'Eligible to Cleared' });
  });

  it("shows an item's activity in the app, and names what is still needed", async () => {
    const dataLayer = await signedInAs(DANA);
    verifyDocument(dataLayer, 'ri-cg-02-tb_test', dana);

    const report = complianceReport(dataLayer, 'cg-02')!;

    const tb = report.items.find((item) => item.item_key === 'tb_test')!;
    expect(tb.activity.slice(-1)[0]).toMatchObject({ who: 'Dana Whitfield (coordinator)', event: 'Updated' });
    expect(tb.activity.slice(-1)[0].details).toContain('status: Pending → Verified');
    expect(report.summary.complete).toBe(false);
    expect(report.summary.blockers).toContain('Criminal background check (not verified yet)');
  });

  it("refuses another agency's coordinator", async () => {
    const dataLayer = await signedInAs('marcus.lee@riverbendcaregivers.example');

    expect(complianceReport(dataLayer, 'cg-07')).toBeUndefined();
    expect(complianceReport(dataLayer, 'cg-12')?.caregiverName).toBe('David Reyes');
  });
});
