import { describe, expect, it } from 'vitest';
import { createDataLayer, createSystemDataLayer } from './dataLayer';
import { runExpirationJob } from './jobs';
import { createMemoryBackend } from './memoryBackend';
import { formatLocalDateTime } from './relativeDates';
import type { SeedFiles } from './seed';
import type { Actor } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const system: Actor = { role: 'system', name: 'CareMatch' };
const TODAY = new Date(2026, 9, 5); // Monday, October 5, 2026

/** The date `days` from TODAY as YYYY-MM-DD. */
function daysOut(days: number): string {
  return formatLocalDateTime(new Date(2026, 9, 5 + days)).slice(0, 10);
}

/** Full seed, with Robert King's (cg-06, Cleared) items set up for each test. Only notifications sent after setup are checked. */
async function setUp(items: Record<string, { status: string; expiration_date: string }>) {
  const backend = createMemoryBackend();
  await createDataLayer(backend).loadSeed(async () => realSeed);
  const systemDataLayer = createSystemDataLayer(backend);
  for (const [id, changes] of Object.entries(items)) {
    systemDataLayer.update('required_items', id, changes, system);
  }
  const status = (id: string) => systemDataLayer.get('required_items', id)?.status;
  const notificationCount = systemDataLayer.list('notifications').length;
  const newNotifications = () => systemDataLayer.list('notifications').slice(notificationCount);
  return { systemDataLayer, status, newNotifications };
}

describe('expiration job (R15, C6, ADR-13)', () => {
  it('marks items 29 days out Expiring and past-date items Expired, and leaves items 31 days out unchanged', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-06-tb_test': { status: 'Verified', expiration_date: daysOut(29) },
      'ri-cg-06-drivers_license': { status: 'Verified', expiration_date: daysOut(-1) },
      'ri-cg-06-photo_id': { status: 'Verified', expiration_date: daysOut(31) },
    });

    const changed = runExpirationJob(systemDataLayer, TODAY);

    expect(status('ri-cg-06-tb_test')).toBe('Expiring');
    expect(status('ri-cg-06-drivers_license')).toBe('Expired');
    expect(status('ri-cg-06-photo_id')).toBe('Verified');
    expect(changed).toEqual(expect.arrayContaining(['ri-cg-06-tb_test', 'ri-cg-06-drivers_license']));
    expect(changed).not.toContain('ri-cg-06-photo_id');
  });

  it('counts exactly 30 days out and the expiration day itself as Expiring', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-06-tb_test': { status: 'Verified', expiration_date: daysOut(30) },
      'ri-cg-06-drivers_license': { status: 'Verified', expiration_date: daysOut(0) },
    });

    runExpirationJob(systemDataLayer, TODAY);

    expect(status('ri-cg-06-tb_test')).toBe('Expiring');
    expect(status('ri-cg-06-drivers_license')).toBe('Expiring');
  });

  it('emails the caregiver and the coordinator for each change, and sends nothing when run again', async () => {
    const { systemDataLayer, newNotifications } = await setUp({
      'ri-cg-06-tb_test': { status: 'Verified', expiration_date: daysOut(29) },
      'ri-cg-06-drivers_license': { status: 'Verified', expiration_date: daysOut(-1) },
    });

    runExpirationJob(systemDataLayer, TODAY);
    // Robert is Cleared, so the expired license also sends a Not Current email (T26); only expiration emails are checked here.
    const sent = newNotifications().filter((row) => row.caregiver_id === 'cg-06' && !row.subject.endsWith('is Not Current'));

    expect(sent.map((row) => [row.recipient_user_id, row.subject]).sort()).toEqual(
      [
        ['u-cg-06', 'Your TB test result expires soon'],
        ['u-cg-06', "Your Driver's license has expired"],
        ['u-coord-a', 'TB test result expiring for Robert King'],
        ['u-coord-a', "Driver's license expired for Robert King"],
      ].sort(),
    );
    expect(sent.every((row) => row.channel === 'email' && row.agency_id === 'agency-a')).toBe(true);
    expect(sent.find((row) => row.recipient_user_id === 'u-cg-06')?.body).toMatch(/on \d{4}-\d{2}-\d{2}\./);

    const before = newNotifications().length;
    expect(runExpirationJob(systemDataLayer, TODAY)).toEqual([]);
    expect(newNotifications()).toHaveLength(before);
  });

  it('returns items to the status that fits when the date moves back, without notifying', async () => {
    const { systemDataLayer, status, newNotifications } = await setUp({
      'ri-cg-06-tb_test': { status: 'Verified', expiration_date: daysOut(29) },
      'ri-cg-06-drivers_license': { status: 'Verified', expiration_date: daysOut(-1) },
    });
    runExpirationJob(systemDataLayer, TODAY);
    const sent = newNotifications().length;

    runExpirationJob(systemDataLayer, new Date(2026, 9, 5 - 10)); // September 25

    expect(status('ri-cg-06-tb_test')).toBe('Verified');
    expect(status('ri-cg-06-drivers_license')).toBe('Expiring');
    expect(newNotifications()).toHaveLength(sent);
  });

  it('leaves Pending, Ordered, and Manual Verification items alone', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-06-tb_test': { status: 'Pending', expiration_date: daysOut(-10) },
      'ri-cg-06-drivers_license': { status: 'Manual Verification', expiration_date: daysOut(5) },
      'ri-cg-06-photo_id': { status: 'Ordered', expiration_date: daysOut(5) },
    });

    runExpirationJob(systemDataLayer, TODAY);

    expect(status('ri-cg-06-tb_test')).toBe('Pending');
    expect(status('ri-cg-06-drivers_license')).toBe('Manual Verification');
    expect(status('ri-cg-06-photo_id')).toBe('Ordered');
  });

  it('uses the warning window from settings', async () => {
    const { systemDataLayer, status } = await setUp({
      'ri-cg-06-tb_test': { status: 'Verified', expiration_date: daysOut(45) },
    });
    const setting = systemDataLayer.list('settings').find((row) => row.key === 'warning_window_days')!;
    systemDataLayer.update('settings', setting.id, { value: '60' }, system);

    runExpirationJob(systemDataLayer, TODAY);

    expect(status('ri-cg-06-tb_test')).toBe('Expiring');
  });
});
