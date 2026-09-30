import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCheckService, vendorForItem } from './checks';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { caregiverRecord } from './record';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const DELAY_MS = 10_000;

/** Full seed with Dana signed in, and the check service the record view uses. */
async function setUp() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  return { backend, dataLayer, system: createSystemDataLayer(backend), service: createCheckService(backend, dataLayer) };
}

describe('ordering checks from the record view (R9, R21, T43)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('picks the vendor from the item method', async () => {
    const { backend, system } = await setUp();
    const vendorOf = (id: string) => vendorForItem(backend, system.get('required_items', id)!)?.vendor;

    expect(vendorOf('ri-cg-02-background_check')).toBe('Mock Background Check');
    expect(vendorOf('ri-cg-02-oig_exclusion')).toBe('Mock OIG Exclusion List');
    expect(vendorOf('ri-cg-02-sam_exclusion')).toBe('Mock SAM Exclusion List');
    expect(vendorOf('ri-cg-02-hha_certification')).toBe('Mock Indiana Aide Registry');
    expect(vendorOf('ri-cg-02-tb_test')).toBeUndefined();
  });

  it('starts screening on the first order for a submitted application, then records the result', async () => {
    const { dataLayer, system, service } = await setUp();
    // James Carter (cg-02) is Intake Complete with authorization granted and a 0001 test SSN.

    const result = service.order('ri-cg-02-background_check', dana);

    expect(result.ok).toBe(true);
    expect(dataLayer.get('caregivers', 'cg-02')?.lifecycle_state).toBe('Screening In Progress');
    expect(dataLayer.get('required_items', 'ri-cg-02-background_check')?.status).toBe('Ordered');
    const move = system
      .list(AUDIT_TABLE)
      .filter((row) => row.record_id === 'cg-02' && row.details.includes('Screening In Progress'));
    expect(move[0]).toMatchObject({ actor_role: 'coordinator', actor_name: 'Dana Whitfield' });

    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(dataLayer.get('required_items', 'ri-cg-02-background_check')?.status).toBe('Verified');
  });

  it('returns a Retryable check to Ordered on retry', async () => {
    const { dataLayer, service } = await setUp();

    expect(caregiverRecord(dataLayer, 'cg-04')!.items.find((item) => item.item_key === 'background_check')?.orderAction).toBe(
      'Retry',
    );
    expect(service.order('ri-cg-04-background_check', dana).ok).toBe(true);
    expect(dataLayer.get('required_items', 'ri-cg-04-background_check')?.status).toBe('Ordered');
  });

  it('orders a Delayed check again, keeping the earlier order on file', async () => {
    const { dataLayer, service } = await setUp();
    const ordersBefore = dataLayer.list('check_orders').filter((row) => row.required_item_id === 'ri-cg-03-background_check');

    expect(caregiverRecord(dataLayer, 'cg-03')!.items.find((item) => item.item_key === 'background_check')?.orderAction).toBe(
      'Order again',
    );
    expect(service.order('ri-cg-03-background_check', dana).ok).toBe(true);

    expect(dataLayer.get('required_items', 'ri-cg-03-background_check')?.status).toBe('Ordered');
    const ordersAfter = dataLayer.list('check_orders').filter((row) => row.required_item_id === 'ri-cg-03-background_check');
    expect(ordersAfter).toHaveLength(ordersBefore.length + 1);
  });

  it("refuses an application that isn't submitted, and one whose authorization was declined", async () => {
    const { service } = await setUp();

    // Maria (cg-01) hasn't submitted and hasn't authorized; Ethan (cg-10) declined.
    expect(service.order('ri-cg-01-background_check', dana)).toEqual({
      ok: false,
      reason: "Checks can't be ordered: Maria Gonzalez hasn't given authorization yet.",
    });
    expect(service.order('ri-cg-10-background_check', dana)).toEqual({
      ok: false,
      reason: "Checks can't be ordered: Ethan Walker declined authorization.",
    });
  });

  it('refuses an order on an application that is still in progress', async () => {
    const { system, service } = await setUp();
    // Give Maria an authorization, but leave her application unsubmitted.
    system.insert(
      'consents',
      { caregiver_id: 'cg-01', type: 'authorization', decision: 'granted', wording_version: 'v1.0', recorded_at: '2026-09-28T10:00' },
      { role: 'system', name: 'CareMatch' },
    );

    expect(service.order('ri-cg-01-background_check', dana)).toEqual({
      ok: false,
      reason: 'Checks can be ordered once the application is submitted.',
    });
  });

  it('offers no order button for document uploads', async () => {
    const { dataLayer } = await setUp();

    const items = caregiverRecord(dataLayer, 'cg-02')!.items;
    expect(items.find((item) => item.item_key === 'tb_test')?.orderAction).toBe('');
    expect(items.find((item) => item.item_key === 'background_check')?.orderAction).toBe('Order check');
  });
});
