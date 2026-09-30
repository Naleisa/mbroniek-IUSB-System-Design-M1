import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundCheckVendor, orderCheck } from './checks';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const system: Actor = { role: 'system', name: 'CareMatch' };
const DELAY_MS = 10_000; // mock_vendor_delay_seconds in settings.csv

/** Full seed with Dana (Agency A) signed in. */
async function setUp() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  const systemDataLayer = createSystemDataLayer(backend);
  const vendor = createBackgroundCheckVendor(backend);
  const order = (itemId: string) => orderCheck(dataLayer, systemDataLayer, vendor, itemId, dana);
  return { dataLayer, systemDataLayer, order };
}

describe('ordering a background check (R9, R10, R21, R2, ADR-11)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends Verified with source, method, and dates filled, and notifies the coordinator (SSN ending 0001)', async () => {
    const { dataLayer, order } = await setUp();
    // James Carter, cg-02, test SSN ending 0001.

    expect(order('ri-cg-02-background_check').ok).toBe(true);
    const ordered = dataLayer.get('required_items', 'ri-cg-02-background_check');
    expect(ordered?.status).toBe('Ordered');
    expect(ordered?.ordered_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    await vi.advanceTimersByTimeAsync(DELAY_MS);

    const item = dataLayer.get('required_items', 'ri-cg-02-background_check');
    expect(item).toMatchObject({
      status: 'Verified',
      source: 'Background check vendor (mock)',
      method: 'Background check',
      result: 'Clear',
    });
    expect(item?.verified_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(item!.expiration_date > item!.verified_date).toBe(true);
    expect(item?.evidence).toMatch(/^Mock vendor result BG-/);

    const orders = dataLayer.list('check_orders').filter((row) => row.required_item_id === 'ri-cg-02-background_check');
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ result: 'Clear', ordered_at: ordered?.ordered_at });
    expect(orders[0].completed_at).toBeTruthy();

    const notice = dataLayer.list('notifications').find((row) => row.caregiver_id === 'cg-02');
    expect(notice).toMatchObject({ recipient_user_id: 'u-coord-a', channel: 'email' });
    expect(notice?.subject).toBe('Criminal background check result for James Carter: Clear');
  });

  it('ends Retryable on a vendor failure and returns to Ordered on retry (SSN ending 0004)', async () => {
    const { dataLayer, order } = await setUp();
    // Tom Nguyen, cg-04, test SSN ending 0004, seeded as Retryable. Start from a fresh order.
    const retryable = order('ri-cg-04-background_check');
    expect(retryable.ok).toBe(true);
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    const failed = dataLayer.get('required_items', 'ri-cg-04-background_check');
    expect(failed).toMatchObject({ status: 'Retryable', result: 'Vendor failure' });
    expect(dataLayer.list('notifications').some((row) => row.subject.endsWith('Tom Nguyen: Vendor failure'))).toBe(true);

    expect(order('ri-cg-04-background_check').ok).toBe(true);
    expect(dataLayer.get('required_items', 'ri-cg-04-background_check')).toMatchObject({ status: 'Ordered', result: '' });
    // Each attempt keeps its own order row: the seeded one plus two new ones.
    expect(dataLayer.list('check_orders').filter((row) => row.caregiver_id === 'cg-04' && row.source.startsWith('Background'))).toHaveLength(3);
  });

  it('moves the record to Eligible when the last outstanding item clears', async () => {
    const { dataLayer, systemDataLayer, order } = await setUp();
    // Tom Nguyen is in Screening with every item current except the registry and the background check.
    systemDataLayer.update('required_items', 'ri-cg-04-hha_certification', { status: 'Verified', verified_date: '2026-01-01' }, system);
    dataLayer.storeSsn('cg-04', '900-13-0001', dana);

    order('ri-cg-04-background_check');
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(dataLayer.get('caregivers', 'cg-04')?.lifecycle_state).toBe('Eligible');
  });

  it('refuses an order for another agency', async () => {
    const { order } = await setUp();

    expect(order('ri-cg-13-background_check')).toEqual({ ok: false, reason: 'We could not find that item.' });
  });

  it('refuses an order for a check that is verified or still waiting on the vendor', async () => {
    const { systemDataLayer, order } = await setUp();
    systemDataLayer.update('required_items', 'ri-cg-04-sam_exclusion', { status: 'Ordered' }, system);

    expect(order('ri-cg-05-background_check')).toEqual({
      ok: false,
      reason: "This check can't be ordered while it is Verified.",
    });
    expect(order('ri-cg-04-sam_exclusion')).toEqual({
      ok: false,
      reason: "This check can't be ordered while it is Ordered.",
    });
  });
});
