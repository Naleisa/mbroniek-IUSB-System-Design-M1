import { describe, expect, it } from 'vitest';
import { coordinatorDashboard } from './dashboard';
import { createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import { LIFECYCLE_STATES } from './types';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

async function signedInAs(email: string) {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.signIn(email, 'demo1234');
  return dataLayer;
}

function card(dashboard: ReturnType<typeof coordinatorDashboard>, name: string) {
  return dashboard.groups.flatMap((group) => group.cards).find((entry) => entry.name === name);
}

describe('coordinator dashboard (R4, R7, R8, R16, R20, R25)', () => {
  it("groups Agency A's caregivers by lifecycle state, in lifecycle order", async () => {
    const dashboard = coordinatorDashboard(await signedInAs('dana.whitfield@hoosierhomecare.example'));

    expect(dashboard.agencyName).toBe('Hoosier Home Care');
    expect(dashboard.total).toBe(10);
    expect(dashboard.groups.map((group) => group.state)).toEqual([...LIFECYCLE_STATES]);
    expect(dashboard.groups[0].cards.map((entry) => entry.name)).toEqual(['Maria Gonzalez', 'Ethan Walker']);
    expect(dashboard.groups.find((group) => group.state === 'Cleared')?.cards.map((entry) => entry.name)).toEqual([
      'Grace Kim',
      'Robert King',
    ]);
  });

  it('highlights incomplete intakes, declined consents, and delayed checks', async () => {
    const dashboard = coordinatorDashboard(await signedInAs('dana.whitfield@hoosierhomecare.example'));

    expect(dashboard.counts).toEqual({ 'Incomplete intake': 2, 'Declined consent': 1, 'Delayed check': 1 });
    expect(card(dashboard, 'Ethan Walker')?.highlights.map((entry) => entry.label)).toEqual([
      'Incomplete intake',
      'Declined consent',
    ]);
    expect(card(dashboard, 'Maria Gonzalez')?.highlights[0].detail).toMatch(/^Started (today|\d+ days? ago)$/);
    expect(card(dashboard, 'Aisha Patel')?.highlights).toEqual([
      { label: 'Delayed check', detail: 'Criminal background check: started 8 days ago' },
    ]);
    expect(card(dashboard, 'Grace Kim')?.highlights).toEqual([]);
  });

  it("shows Agency B's coordinator only Agency B's caregivers", async () => {
    const dashboard = coordinatorDashboard(await signedInAs('marcus.lee@riverbendcaregivers.example'));

    const names = dashboard.groups.flatMap((group) => group.cards).map((entry) => entry.name).sort();
    expect(names).toEqual(['Chloe Adams', 'David Reyes', 'Hannah Schultz']);
    expect(dashboard.counts).toEqual({ 'Incomplete intake': 0, 'Declined consent': 0, 'Delayed check': 0 });
  });

  it('shows a brand-new intake as a new applicant with an incomplete intake', async () => {
    const dataLayer = createDataLayer(createMemoryBackend());
    await dataLayer.loadSeed(async () => realSeed);
    dataLayer.startIntake('hoosier-home-care');
    dataLayer.signOut();
    dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');

    const dashboard = coordinatorDashboard(dataLayer);

    expect(dashboard.total).toBe(11);
    expect(card(dashboard, 'New applicant')?.highlights).toEqual([
      { label: 'Incomplete intake', detail: 'Started today' },
    ]);
  });
});
