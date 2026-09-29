import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { coordinatorsOf, sendEmail, sendSms } from './notifications';
import type { SeedFiles } from './seed';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const NOW = new Date(2026, 9, 5, 9, 30);
const MESSAGE = {
  recipient_user_id: 'u-coord-a',
  agency_id: 'agency-a',
  caregiver_id: 'cg-02',
  subject: 'Criminal background check result for James Carter: Clear',
  body: 'Mock Background Check returned Clear for James Carter. The item is now Verified.',
};

async function systemDataLayer() {
  const backend = createMemoryBackend();
  await createDataLayer(backend).loadSeed(async () => realSeed);
  return createSystemDataLayer(backend);
}

describe('notification service (ADR-06, R7, R10, R15, R25)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes exactly one outbox row marked email', async () => {
    const dataLayer = await systemDataLayer();
    const before = dataLayer.list('notifications').length;

    const row = sendEmail(dataLayer, MESSAGE, NOW);

    const added = dataLayer.list('notifications').slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toEqual({ ...MESSAGE, id: row.id, channel: 'email', created_at: '2026-10-05T09:30' });
  });

  it('makes no network request', async () => {
    const dataLayer = await systemDataLayer();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    sendEmail(dataLayer, MESSAGE, NOW);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('records the write in the audit log as CareMatch', async () => {
    const dataLayer = await systemDataLayer();

    const row = sendEmail(dataLayer, MESSAGE, NOW);

    const event = dataLayer.list(AUDIT_TABLE).find((entry) => entry.record_id === row.id);
    expect(event).toMatchObject({ actor_role: 'system', actor_name: 'CareMatch', table: 'notifications' });
    expect(event?.details).not.toContain(MESSAGE.body);
  });

  it("finds only one agency's coordinators", async () => {
    const dataLayer = await systemDataLayer();

    expect(coordinatorsOf(dataLayer, 'agency-a').map((user) => user.id)).toEqual(['u-coord-a']);
    expect(coordinatorsOf(dataLayer, 'agency-b').map((user) => user.id)).toEqual(['u-coord-b']);
  });
});

describe('SMS notifications (ADR-06)', () => {
  const SMS = {
    recipient_user_id: 'u-cg-06',
    agency_id: 'agency-a',
    caregiver_id: 'cg-06',
    body: 'CareMatch: your CPR and First Aid certification expires soon. Your agency will ask you for a replacement.',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes exactly one outbox row marked SMS, with no subject', async () => {
    const dataLayer = await systemDataLayer();
    const before = dataLayer.list('notifications').length;

    const row = sendSms(dataLayer, SMS, NOW);

    const added = dataLayer.list('notifications').slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toEqual({ ...SMS, id: row.id, subject: '', channel: 'sms', created_at: '2026-10-05T09:30' });
  });

  it('makes no network request', async () => {
    const dataLayer = await systemDataLayer();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    sendSms(dataLayer, SMS, NOW);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('records the write in the audit log as CareMatch', async () => {
    const dataLayer = await systemDataLayer();

    const row = sendSms(dataLayer, SMS, NOW);

    const event = dataLayer.list(AUDIT_TABLE).find((entry) => entry.record_id === row.id);
    expect(event).toMatchObject({ actor_role: 'system', actor_name: 'CareMatch', table: 'notifications' });
  });
});
