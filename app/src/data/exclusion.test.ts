import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundCheckVendor, createExclusionCheckVendor, orderCheck } from './checks';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { checkEligibility, transitionCaregiver } from './lifecycle';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';
import type { VendorVault } from './vault';
import { createMockExclusionCheck, type VendorResult } from './vendors';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const system: Actor = { role: 'system', name: 'CareMatch' };
const DELAY_MS = 10_000; // mock_vendor_delay_seconds in settings.csv

/**
 * Tom Nguyen (cg-04) is in Screening In Progress. He gets a test SSN ending 0002,
 * and his exclusion checks and background check are reset so they can be ordered.
 */
async function tomWithMatchingSsn() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  const systemDataLayer = createSystemDataLayer(backend);
  dataLayer.storeSsn('cg-04', '900-13-0002', dana);
  for (const key of ['oig_exclusion', 'sam_exclusion']) {
    systemDataLayer.update('required_items', `ri-cg-04-${key}`, { status: 'Pending', result: '', verified_date: '' }, system);
  }
  systemDataLayer.update('required_items', 'ri-cg-04-hha_certification', { status: 'Verified' }, system);
  const order = (itemId: string, vendor = createExclusionCheckVendor(backend, 'OIG')) =>
    orderCheck(dataLayer, systemDataLayer, vendor, itemId, dana);
  return { backend, dataLayer, systemDataLayer, order };
}

describe('mock OIG/SAM exclusion vendor (R19, R17, ADR-12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves the record to Review Required on a match (SSN ending 0002)', async () => {
    const { dataLayer, order } = await tomWithMatchingSsn();

    expect(order('ri-cg-04-oig_exclusion').ok).toBe(true);
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(dataLayer.get('caregivers', 'cg-04')?.lifecycle_state).toBe('Review Required');
    expect(dataLayer.get('required_items', 'ri-cg-04-oig_exclusion')).toMatchObject({
      status: 'Manual Verification',
      result: 'Possible match',
    });
    const orders = dataLayer.list('check_orders').filter((row) => row.required_item_id === 'ri-cg-04-oig_exclusion');
    expect(orders.slice(-1)[0]).toMatchObject({ result: 'Possible match' });
    const notice = dataLayer.list('notifications').find((row) => row.caregiver_id === 'cg-04');
    expect(notice?.subject).toBe('OIG exclusion check result for Tom Nguyen: Possible match');
  });

  it('refuses any later automated advancement (R17)', async () => {
    const { backend, dataLayer, systemDataLayer, order } = await tomWithMatchingSsn();
    order('ri-cg-04-oig_exclusion');
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(checkEligibility(systemDataLayer, 'cg-04').ok).toBe(false);
    for (const state of ['Eligible', 'Screening In Progress', 'Cleared']) {
      expect(transitionCaregiver(systemDataLayer, 'cg-04', state, system).ok, state).toBe(false);
    }

    // A later Clear on another item leaves the record where it is.
    order('ri-cg-04-background_check', createBackgroundCheckVendor(backend));
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(dataLayer.get('required_items', 'ri-cg-04-background_check')?.status).toBe('Verified');
    expect(dataLayer.get('caregivers', 'cg-04')?.lifecycle_state).toBe('Review Required');
  });

  it('also matches on the SAM list', async () => {
    const { backend, dataLayer, order } = await tomWithMatchingSsn();

    order('ri-cg-04-sam_exclusion', createExclusionCheckVendor(backend, 'SAM'));
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(dataLayer.get('required_items', 'ri-cg-04-sam_exclusion')?.result).toBe('Possible match');
    expect(dataLayer.get('caregivers', 'cg-04')?.lifecycle_state).toBe('Review Required');
  });

  it('returns each reserved outcome after the configured delay', async () => {
    const ssns: Record<string, string> = {
      tok_clear: '900-10-0001',
      tok_match: '900-11-0002',
      tok_never: '900-12-0003',
      tok_failure: '900-13-0004',
    };
    const vault: VendorVault = { readSsn: (token) => ssns[token] };
    const adapter = createMockExclusionCheck(vault, 10, 'OIG');
    const received: Record<string, VendorResult['outcome']> = {};
    for (const token of Object.keys(ssns)) {
      void adapter.order({ caregiver_id: 'cg-01', ssn_token: token }).then((result) => {
        received[token] = result.outcome;
      });
    }

    await vi.advanceTimersByTimeAsync(DELAY_MS - 1);
    expect(received).toEqual({});
    await vi.advanceTimersByTimeAsync(DELAY_MS * 100);
    expect(received).toEqual({ tok_clear: 'clear', tok_match: 'match', tok_failure: 'failure' });
  });
});
