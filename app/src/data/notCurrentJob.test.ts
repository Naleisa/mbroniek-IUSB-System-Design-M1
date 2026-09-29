import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
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
const YESTERDAY = formatLocalDateTime(new Date(2026, 9, 4)).slice(0, 10);

/** Full seed, with Robert King's (cg-06, Cleared) TB test expiring yesterday. */
async function robertWithExpiredItem() {
  const backend = createMemoryBackend();
  await createDataLayer(backend).loadSeed(async () => realSeed);
  const systemDataLayer = createSystemDataLayer(backend);
  systemDataLayer.update('required_items', 'ri-cg-06-tb_test', { status: 'Verified', expiration_date: YESTERDAY }, system);
  const state = (caregiverId: string) => systemDataLayer.get('caregivers', caregiverId)?.lifecycle_state;
  const notCurrentEmails = (caregiverId: string) =>
    systemDataLayer
      .list('notifications')
      .filter((row) => row.caregiver_id === caregiverId && row.subject.endsWith('is Not Current'));
  return { systemDataLayer, state, notCurrentEmails };
}

describe('expiration job moves Cleared records with an expired item to Not Current (ADR-19, C2, C6, R14)', () => {
  it('moves a Cleared record with one expired item to Not Current and notifies the coordinator', async () => {
    const { systemDataLayer, state, notCurrentEmails } = await robertWithExpiredItem();
    expect(state('cg-06')).toBe('Cleared');

    runExpirationJob(systemDataLayer, TODAY);

    expect(state('cg-06')).toBe('Not Current');
    const emails = notCurrentEmails('cg-06');
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ recipient_user_id: 'u-coord-a', channel: 'email', subject: 'Robert King is Not Current' });
    expect(emails[0].body).toContain(`TB test result expired on ${YESTERDAY}`);
  });

  it('leaves a fully current Cleared record untouched', async () => {
    const { systemDataLayer, state, notCurrentEmails } = await robertWithExpiredItem();

    runExpirationJob(systemDataLayer, TODAY);

    expect(state('cg-07')).toBe('Cleared');
    expect(notCurrentEmails('cg-07')).toEqual([]);
  });

  it('does nothing more when run again', async () => {
    const { systemDataLayer, notCurrentEmails } = await robertWithExpiredItem();

    runExpirationJob(systemDataLayer, TODAY);
    runExpirationJob(systemDataLayer, TODAY);

    expect(notCurrentEmails('cg-06')).toHaveLength(1);
    const moves = systemDataLayer
      .list(AUDIT_TABLE)
      .filter((row) => row.record_id === 'cg-06' && row.details.includes('Not Current'));
    expect(moves).toHaveLength(1);
  });

  it('keeps the record Not Current when the date moves back, since only a coordinator restores Cleared', async () => {
    const { systemDataLayer, state } = await robertWithExpiredItem();

    runExpirationJob(systemDataLayer, TODAY);
    runExpirationJob(systemDataLayer, new Date(2026, 8, 20));

    expect(systemDataLayer.get('required_items', 'ri-cg-06-tb_test')?.status).not.toBe('Expired');
    expect(state('cg-06')).toBe('Not Current');
  });

  it('leaves an Eligible record with an expired item Eligible', async () => {
    const { systemDataLayer, state } = await robertWithExpiredItem();
    // Linda Brooks (cg-05) is Eligible.
    systemDataLayer.update('required_items', 'ri-cg-05-tb_test', { status: 'Verified', expiration_date: YESTERDAY }, system);

    runExpirationJob(systemDataLayer, TODAY);

    expect(systemDataLayer.get('required_items', 'ri-cg-05-tb_test')?.status).toBe('Expired');
    expect(state('cg-05')).toBe('Eligible');
  });

  it('records the move in the audit log as CareMatch', async () => {
    const { systemDataLayer } = await robertWithExpiredItem();
    const before = systemDataLayer.list(AUDIT_TABLE).length;

    runExpirationJob(systemDataLayer, TODAY);

    const recordEvents = systemDataLayer
      .list(AUDIT_TABLE)
      .slice(before)
      .filter((row) => row.table === 'caregivers' && row.record_id === 'cg-06');
    expect(recordEvents).toHaveLength(1);
    expect(recordEvents[0]).toMatchObject({ actor_role: 'system', actor_name: 'CareMatch' });
  });
});
