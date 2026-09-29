import { describe, expect, it } from 'vitest';
import agenciesCsv from '../../public/seed/agencies.csv?raw';
import settingsCsv from '../../public/seed/settings.csv?raw';
import usersCsv from '../../public/seed/users.csv?raw';
import { createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';

// A fresh data layer loading the seed is what "Reset demo data" does (clear storage, load the seed).
async function loadFreshSeed(files: SeedFiles) {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => files);
  return dataLayer;
}

function settingValue(rows: Record<string, string>[], key: string): string | undefined {
  return rows.find((row) => row.key === key)?.value;
}

describe('seeded settings, agencies, and coordinators', () => {
  it('reads all five settings from settings.csv', async () => {
    const dataLayer = await loadFreshSeed({ settings: settingsCsv });
    const settings = dataLayer.list('settings');

    expect(settings).toHaveLength(5);
    expect(settingValue(settings, 'warning_window_days')).toBe('30');
    expect(settingValue(settings, 'delayed_threshold_business_days')).toBe('3');
    expect(settingValue(settings, 'resume_window_days')).toBe('7');
    expect(settingValue(settings, 'mock_vendor_delay_seconds')).toBe('10');
    expect(settingValue(settings, 'state_registry_available')).toBe('true');
  });

  it('reads both agencies, each with one coordinator', async () => {
    const dataLayer = await loadFreshSeed({ agencies: agenciesCsv, users: usersCsv });
    const agencies = dataLayer.list('agencies');
    const coordinators = dataLayer.list('users').filter((user) => user.role === 'coordinator');

    expect(agencies.map((agency) => agency.name)).toEqual(['Hoosier Home Care', 'Riverbend Caregivers']);
    for (const agency of agencies) {
      expect(coordinators.filter((user) => user.agency_id === agency.id)).toHaveLength(1);
    }
  });

  it('returns a changed settings.csv value with no code change', async () => {
    const changedSettingsCsv = settingsCsv.replace('warning_window_days,30,', 'warning_window_days,45,');
    expect(changedSettingsCsv).not.toBe(settingsCsv);

    const dataLayer = await loadFreshSeed({ settings: changedSettingsCsv });

    expect(settingValue(dataLayer.list('settings'), 'warning_window_days')).toBe('45');
  });
});
