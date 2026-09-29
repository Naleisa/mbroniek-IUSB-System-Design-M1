import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };

describe('Reset demo data (T59, ADR-21)', () => {
  it('puts changed records back to their seeded values and clears everything added since', async () => {
    const dataLayer = createDataLayer(createMemoryBackend());
    await dataLayer.loadSeed(async () => realSeed);
    const seededAuditCount = dataLayer.list(AUDIT_TABLE).length;

    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
    dataLayer.update('caregivers', 'cg-07', { phone: '(574) 555-0199' }, dana);
    dataLayer.requestSignInLink('maria.gonzalez@example.com');
    await dataLayer.putDocument({ id: 'doc-new', file: new Blob(['x']), meta: { caregiver_id: 'cg-07' } }, dana);

    await dataLayer.resetDemoData(async () => realSeed);

    expect(dataLayer.getSignedInUser()).toBeUndefined();
    expect(dataLayer.get('caregivers', 'cg-07')?.phone).toBe('(574) 555-0107');
    expect(dataLayer.list('notifications')).toEqual([]);
    expect(await dataLayer.listDocuments()).toEqual([]);
    expect(dataLayer.list(AUDIT_TABLE)).toHaveLength(seededAuditCount);
  });

  it('keeps the current data when the seed files cannot be loaded', async () => {
    const dataLayer = createDataLayer(createMemoryBackend());
    await dataLayer.loadSeed(async () => realSeed);
    dataLayer.update('caregivers', 'cg-07', { phone: '(574) 555-0199' }, dana);

    await expect(
      dataLayer.resetDemoData(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');

    expect(dataLayer.get('caregivers', 'cg-07')?.phone).toBe('(574) 555-0199');
  });
});
