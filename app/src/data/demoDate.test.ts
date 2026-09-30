import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { findBlockingItems } from './lifecycle';
import { createMemoryBackend } from './memoryBackend';
import { formatLocalDateTime } from './relativeDates';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };
const REAL_NOW = new Date(2026, 9, 5, 14, 45); // Monday, October 5, 2026, 2:45 PM

async function seeded() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  return { backend, dataLayer };
}

describe('demo date (ADR-13, T60)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the real date when no demo date is set', async () => {
    vi.useFakeTimers({ now: REAL_NOW });
    const { dataLayer } = await seeded();

    expect(dataLayer.getDemoDate()).toBeUndefined();
    expect(formatLocalDateTime(dataLayer.today())).toBe('2026-10-05T14:45');
  });

  it('treats the demo date as today, at the current clock time, for every data layer on the same storage', async () => {
    vi.useFakeTimers({ now: REAL_NOW });
    const { backend, dataLayer } = await seeded();

    dataLayer.setDemoDate('2026-11-20');

    expect(formatLocalDateTime(dataLayer.today())).toBe('2026-11-20T14:45');
    expect(formatLocalDateTime(createSystemDataLayer(backend).today())).toBe('2026-11-20T14:45');
    // A new data layer on the same storage (a page reload) keeps it.
    expect(createDataLayer(backend).getDemoDate()).toBe('2026-11-20');
  });

  it('returns to the real date when the demo date is cleared', async () => {
    vi.useFakeTimers({ now: REAL_NOW });
    const { dataLayer } = await seeded();
    dataLayer.setDemoDate('2026-11-20');

    dataLayer.setDemoDate(undefined);

    expect(dataLayer.getDemoDate()).toBeUndefined();
    expect(formatLocalDateTime(dataLayer.today())).toBe('2026-10-05T14:45');
  });

  it('is cleared by "Reset demo data"', async () => {
    const { dataLayer } = await seeded();
    dataLayer.setDemoDate('2026-11-20');

    await dataLayer.resetDemoData(async () => realSeed);

    expect(dataLayer.getDemoDate()).toBeUndefined();
  });

  it('refuses a date not written as YYYY-MM-DD', async () => {
    const { dataLayer } = await seeded();

    expect(() => dataLayer.setDemoDate('11/20/2026')).toThrow(/YYYY-MM-DD/);
  });

  it('stamps audit events with the demo date', async () => {
    vi.useFakeTimers({ now: REAL_NOW });
    const { dataLayer } = await seeded();
    dataLayer.setDemoDate('2026-11-20');
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');

    dataLayer.update('caregivers', 'cg-07', { phone: '(574) 555-0199' }, dana);

    expect(dataLayer.list(AUDIT_TABLE).slice(-1)[0].occurred_at).toBe('2026-11-20T14:45');
  });

  it('blocks clearing when an item has expired by the demo date', async () => {
    const { dataLayer } = await seeded();
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
    // Robert King's CPR card is seeded to expire 20 days from today.
    const robert = dataLayer.get('caregivers', 'cg-06')!;
    expect(findBlockingItems(dataLayer, robert)).toEqual([]);

    const expires = dataLayer.get('required_items', 'ri-cg-06-cpr_first_aid')!.expiration_date;
    const [year, month, day] = expires.split('-').map(Number);
    dataLayer.setDemoDate(formatLocalDateTime(new Date(year, month - 1, day + 1)).slice(0, 10));

    expect(findBlockingItems(dataLayer, robert)).toEqual(['CPR and First Aid certification (expired)']);
  });

  it('expires a sign-in link by the demo date', async () => {
    const { dataLayer } = await seeded();
    dataLayer.requestSignInLink('maria.gonzalez@example.com');
    const token = /token=([^&\s]+)/.exec(dataLayer.outboxFor('maria.gonzalez@example.com')[0].body)?.[1] ?? '';

    const eightDaysOut = formatLocalDateTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)).slice(0, 10);
    dataLayer.setDemoDate(eightDaysOut);

    expect(dataLayer.signInWithLink(decodeURIComponent(token))).toEqual({
      ok: false,
      reason: 'This sign-in link has expired. Please request a new one.',
    });
  });
});
