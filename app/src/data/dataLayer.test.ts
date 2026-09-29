import { describe, expect, it } from 'vitest';
import { createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { resolveRelativeDate } from './relativeDates';
import type { SeedFiles } from './seed';

const today = new Date(2026, 8, 29); // 2026-09-29, local time

const testSeed: SeedFiles = {
  agencies: 'id,name\nagency-a,Hoosier Home Care\nagency-b,Riverbend Caregivers\n',
  required_items: 'caregiver_id,item_key,expiration_date,ordered_at\ncg-01,tb_test,today+20,today-3 10:05\n',
};

describe('resolveRelativeDate', () => {
  it('resolves today, today+N, and today-N with a time', () => {
    expect(resolveRelativeDate('today', today)).toBe('2026-09-29');
    expect(resolveRelativeDate('today+20', today)).toBe('2026-10-19');
    expect(resolveRelativeDate('today-3 10:05', today)).toBe('2026-09-26T10:05');
  });

  it('leaves other values unchanged', () => {
    expect(resolveRelativeDate('1990-03-14', today)).toBe('1990-03-14');
    expect(resolveRelativeDate('Hoosier Home Care', today)).toBe('Hoosier Home Care');
  });
});

describe('data layer seed loading', () => {
  it('loads a test seed, resolves relative dates, and reads rows back through the interface', async () => {
    const dataLayer = createDataLayer(createMemoryBackend());

    expect(await dataLayer.loadSeed(async () => testSeed, today)).toBe(true);

    expect(dataLayer.list('agencies')).toHaveLength(2);
    expect(dataLayer.get('agencies', 'agency-a')?.name).toBe('Hoosier Home Care');

    const [item] = dataLayer.list('required_items');
    expect(item.expiration_date).toBe('2026-10-19');
    expect(item.ordered_at).toBe('2026-09-26T10:05');
    expect(item.id).toBe('required_items-1');
  });

  it('does not reload the seed over saved data on a second start', async () => {
    const backend = createMemoryBackend();
    const firstStart = createDataLayer(backend);
    await firstStart.loadSeed(async () => testSeed, today);
    firstStart.update('agencies', 'agency-a', { name: 'Changed Name' }, { role: 'system', name: 'Test' });

    const secondStart = createDataLayer(backend);
    expect(await secondStart.loadSeed(async () => testSeed, today)).toBe(false);
    expect(secondStart.get('agencies', 'agency-a')?.name).toBe('Changed Name');
  });
});
