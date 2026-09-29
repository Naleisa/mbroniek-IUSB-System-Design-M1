import { describe, expect, it } from 'vitest';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { businessDaysBetween, runDelayedCheckJob } from './jobs';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const system: Actor = { role: 'system', name: 'CareMatch' };
const MONDAY = new Date(2026, 9, 5); // Monday, October 5, 2026

/** Full seed, with James Carter's (cg-02) checks set up as needed for each test. */
async function setUp(items: Record<string, { status: string; ordered_at: string }>) {
  const backend = createMemoryBackend();
  await createDataLayer(backend).loadSeed(async () => realSeed);
  const systemDataLayer = createSystemDataLayer(backend);
  for (const [id, changes] of Object.entries(items)) {
    systemDataLayer.update('required_items', id, changes, system);
  }
  const status = (id: string) => systemDataLayer.get('required_items', id)?.status;
  return { systemDataLayer, status };
}

describe('delayed-check job (R20, ADR-13)', () => {
  it('counts weekdays only', () => {
    expect(businessDaysBetween(new Date(2026, 8, 29), MONDAY)).toBe(4); // Tue → Mon
    expect(businessDaysBetween(new Date(2026, 9, 1), MONDAY)).toBe(2); // Thu → Mon, across a weekend
    expect(businessDaysBetween(MONDAY, MONDAY)).toBe(0);
  });

  it('marks an order placed four business days ago Delayed, but not one placed two business days ago across a weekend', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-02-background_check': { status: 'Ordered', ordered_at: '2026-09-29T10:00' },
      'ri-cg-02-oig_exclusion': { status: 'Ordered', ordered_at: '2026-10-01T10:00' },
    });

    const changed = runDelayedCheckJob(systemDataLayer, MONDAY);

    expect(status('ri-cg-02-background_check')).toBe('Delayed');
    expect(status('ri-cg-02-oig_exclusion')).toBe('Ordered');
    expect(changed).toContain('ri-cg-02-background_check');
    expect(changed).not.toContain('ri-cg-02-oig_exclusion');
  });

  it('leaves an order at exactly the threshold as Ordered', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-02-background_check': { status: 'Ordered', ordered_at: '2026-09-30T10:00' }, // Wed → Mon = 3
    });

    runDelayedCheckJob(systemDataLayer, MONDAY);

    expect(status('ri-cg-02-background_check')).toBe('Ordered');
  });

  it('returns a Delayed check to Ordered when the date moves back under the threshold', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-02-background_check': { status: 'Ordered', ordered_at: '2026-09-29T10:00' },
    });

    runDelayedCheckJob(systemDataLayer, MONDAY);
    expect(status('ri-cg-02-background_check')).toBe('Delayed');
    runDelayedCheckJob(systemDataLayer, new Date(2026, 9, 1));
    expect(status('ri-cg-02-background_check')).toBe('Ordered');
  });

  it('leaves Retryable and Verified items alone', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-02-background_check': { status: 'Retryable', ordered_at: '2026-09-01T10:00' },
      'ri-cg-02-oig_exclusion': { status: 'Verified', ordered_at: '2026-09-01T10:00' },
    });

    runDelayedCheckJob(systemDataLayer, MONDAY);

    expect(status('ri-cg-02-background_check')).toBe('Retryable');
    expect(status('ri-cg-02-oig_exclusion')).toBe('Verified');
  });

  it('uses the threshold from settings', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-02-oig_exclusion': { status: 'Ordered', ordered_at: '2026-10-01T10:00' }, // 2 business days
    });
    const setting = systemDataLayer.list('settings').find((row) => row.key === 'delayed_threshold_business_days')!;
    systemDataLayer.update('settings', setting.id, { value: '1' }, system);

    runDelayedCheckJob(systemDataLayer, MONDAY);

    expect(status('ri-cg-02-oig_exclusion')).toBe('Delayed');
  });

  it('records each change in the audit log as CareMatch', async () => {
    const { systemDataLayer } = await setUp({
      'ri-cg-02-background_check': { status: 'Ordered', ordered_at: '2026-09-29T10:00' },
    });

    runDelayedCheckJob(systemDataLayer, MONDAY);

    const event = systemDataLayer
      .list('audit_events')
      .filter((row) => row.record_id === 'ri-cg-02-background_check')
      .slice(-1)[0];
    expect(event).toMatchObject({ actor_role: 'system', actor_name: 'CareMatch' });
  });
});
