import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRegistryCheckVendor, orderCheck } from './checks';
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
const ITEM = 'ri-cg-02-hha_certification'; // James Carter, Pending, test SSN ending 0001
const CERTIFICATE_EXPIRES = '2027-06-30';

/** Full seed with Dana signed in, and James's uploaded certificate carrying an expiration date. */
async function setUp(registryAvailable: 'true' | 'false') {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  const systemDataLayer = createSystemDataLayer(backend);
  const setting = systemDataLayer.list('settings').find((row) => row.key === 'state_registry_available')!;
  systemDataLayer.update('settings', setting.id, { value: registryAvailable }, system);
  systemDataLayer.update('required_items', ITEM, { expiration_date: CERTIFICATE_EXPIRES }, system);
  const order = () => orderCheck(dataLayer, systemDataLayer, createRegistryCheckVendor(backend), ITEM, dana);
  return { dataLayer, order };
}

describe('mock state registry with manual verification fallback (R26, ADR-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('verifies the registry item automatically when the registry is available', async () => {
    const { dataLayer, order } = await setUp('true');

    expect(order().ok).toBe(true);
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    const item = dataLayer.get('required_items', ITEM);
    expect(item).toMatchObject({
      status: 'Verified',
      result: 'Active',
      source: 'Indiana aide registry (mock)',
      method: 'Registry lookup',
      expiration_date: CERTIFICATE_EXPIRES,
    });
    expect(item?.verified_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(item?.evidence).toMatch(/^Mock registry result IN-/);
    const orders = dataLayer.list('check_orders').filter((row) => row.required_item_id === ITEM);
    expect(orders.slice(-1)[0]).toMatchObject({ result: 'Active' });
    expect(dataLayer.list('notifications').some((row) => row.subject.endsWith('James Carter: Active'))).toBe(true);
  });

  it('lands in Manual Verification and notifies the coordinator when the registry is unavailable', async () => {
    const { dataLayer, order } = await setUp('false');

    expect(order().ok).toBe(true);
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(dataLayer.get('required_items', ITEM)).toMatchObject({
      status: 'Manual Verification',
      result: 'Registry unavailable',
      notes: 'State registry unavailable. Verify the certificate by hand.',
      verified_date: '',
    });
    const orders = dataLayer.list('check_orders').filter((row) => row.required_item_id === ITEM);
    expect(orders.slice(-1)[0]).toMatchObject({ result: 'Registry unavailable' });
    const notice = dataLayer.list('notifications').find((row) => row.caregiver_id === 'cg-02');
    expect(notice?.subject).toBe('Home Health Aide certification result for James Carter: Registry unavailable');
    expect(notice?.body).toMatch(/verified by hand/);
  });
});
