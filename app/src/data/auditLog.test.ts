import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import type { Actor } from './types';

const coordinator: Actor = { role: 'coordinator', name: 'Dana Whitfield' };

async function loadTestSeed() {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => ({
    caregivers: 'id,agency_id,first_name,lifecycle_state\ncg-05,agency-a,Linda,Eligible\n',
    required_items: 'id,caregiver_id,item_key,status\nri-cg-05-tb_test,cg-05,tb_test,Pending\n',
    audit_events: 'id,caregiver_id,occurred_at,actor_role,actor_name,event,details\nev-1,cg-05,today-8 09:20,applicant,Linda,Record created,Seeded history\n',
  }));
  return dataLayer;
}

describe('append-only audit log (R1, C5, ADR-10)', () => {
  it('records a matching event when a caregiver record changes', async () => {
    const dataLayer = await loadTestSeed();

    dataLayer.update('caregivers', 'cg-05', { lifecycle_state: 'Cleared' }, coordinator);

    const [event] = dataLayer.list(AUDIT_TABLE).slice(-1);
    expect(event).toMatchObject({
      caregiver_id: 'cg-05',
      actor_role: 'coordinator',
      actor_name: 'Dana Whitfield',
      event: 'Updated',
      details: 'lifecycle_state: Eligible → Cleared',
      table: 'caregivers',
      record_id: 'cg-05',
    });
    expect(event?.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('records an event for every write: inserts, updates, and documents', async () => {
    const dataLayer = await loadTestSeed();
    const before = dataLayer.list(AUDIT_TABLE).length;

    dataLayer.insert('consents', { caregiver_id: 'cg-05', type: 'disclosure' }, coordinator);
    dataLayer.update('required_items', 'ri-cg-05-tb_test', { status: 'Verified' }, coordinator);
    await dataLayer.putDocument(
      { id: 'doc-1', file: new Blob(['test']), meta: { caregiver_id: 'cg-05', file_name: 'tb-test.pdf' } },
      coordinator,
    );

    const added = dataLayer.list(AUDIT_TABLE).slice(before);
    expect(added.map((event) => [event.event, event.table, event.caregiver_id])).toEqual([
      ['Created', 'consents', 'cg-05'],
      ['Updated', 'required_items', 'cg-05'],
      ['Document stored', 'documents', 'cg-05'],
    ]);
  });

  it('keeps the seeded history and adds no events while seeding', async () => {
    const dataLayer = await loadTestSeed();

    expect(dataLayer.list(AUDIT_TABLE).map((event) => event.id)).toEqual(['ev-1']);
  });

  it('offers no way to change or remove an audit event', async () => {
    const dataLayer = await loadTestSeed();

    expect(() => dataLayer.update(AUDIT_TABLE, 'ev-1', { details: 'Edited' }, coordinator)).toThrow(
      /cannot be changed or removed/,
    );
    expect(() => dataLayer.insert(AUDIT_TABLE, { event: 'Forged' }, coordinator)).toThrow(
      /cannot be changed or removed/,
    );
    expect(Object.keys(dataLayer).filter((operation) => /delete|remove/i.test(operation))).toEqual([]);
    expect(dataLayer.get(AUDIT_TABLE, 'ev-1')?.details).toBe('Seeded history');
  });
});
