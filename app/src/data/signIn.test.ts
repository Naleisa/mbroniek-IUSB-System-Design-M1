import { describe, expect, it } from 'vitest';
import usersCsv from '../../public/seed/users.csv?raw';
import { AUDIT_TABLE, createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';

async function loadUsers() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => ({ users: usersCsv }));
  return { backend, dataLayer };
}

describe('coordinator sign-in (ADR-05)', () => {
  it('signs in a seeded coordinator, ignoring email capitalization', async () => {
    const { dataLayer } = await loadUsers();

    const user = dataLayer.signIn('Dana.Whitfield@HoosierHomeCare.example', 'demo1234');

    expect(user?.display_name).toBe('Dana Whitfield');
    expect(dataLayer.getSignedInUser()?.id).toBe('u-coord-a');
    expect(dataLayer.list(AUDIT_TABLE).map((event) => event.event)).toEqual(['Signed in']);
  });

  it('refuses a wrong password, an unknown email, and applicant accounts', async () => {
    const { dataLayer } = await loadUsers();

    expect(dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'wrong')).toBeUndefined();
    expect(dataLayer.signIn('nobody@example.com', 'demo1234')).toBeUndefined();
    expect(dataLayer.signIn('maria.gonzalez@example.com', '')).toBeUndefined();
    expect(dataLayer.getSignedInUser()).toBeUndefined();
  });

  it('stays signed in across a reload and signs out', async () => {
    const { backend, dataLayer } = await loadUsers();
    dataLayer.signIn('marcus.lee@riverbendcaregivers.example', 'demo1234');

    const afterReload = createDataLayer(backend);
    expect(afterReload.getSignedInUser()?.display_name).toBe('Marcus Lee');

    afterReload.signOut();
    expect(afterReload.getSignedInUser()).toBeUndefined();
    expect(afterReload.list(AUDIT_TABLE).map((event) => event.event)).toEqual(['Signed in', 'Signed out']);
  });
});
