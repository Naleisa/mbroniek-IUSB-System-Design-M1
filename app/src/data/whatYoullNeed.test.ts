import { describe, expect, it } from 'vitest';
import { createDataLayer } from './dataLayer';
import { whatYoullNeed } from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

/** A new applicant started from Agency A's link, on the given seed. */
async function newApplicant(seed: SeedFiles = realSeed) {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => seed);
  dataLayer.startIntake('hoosier-home-care');
  return dataLayer;
}

describe('"what you\'ll need and why" (R18, ADR-03)', () => {
  it('lists every template item in order, each with its reason', async () => {
    const needed = whatYoullNeed(await newApplicant());

    expect([...needed.upload, ...needed.check]).toHaveLength(8);
    expect(needed.upload.map((item) => item.name)).toEqual([
      'Government photo ID',
      'Home Health Aide certification',
      'TB test result',
      'CPR and First Aid certification',
      "Driver's license",
    ]);
    expect(needed.check.map((item) => item.name)).toEqual([
      'Criminal background check',
      'OIG exclusion check',
      'SAM exclusion check',
    ]);
    expect(needed.upload[0].reason).toBe('We use this to confirm who you are.');
    expect([...needed.upload, ...needed.check].every((item) => item.reason.length > 0)).toBe(true);
  });

  it('shows a changed or added template item with no code change', async () => {
    const edited = realSeed.template_items
      .replace('Helps protect clients from tuberculosis.', 'Protects clients and coworkers from TB.')
      .trimEnd()
      .concat('\ntpl-in-hha,flu_shot,Flu vaccination record,Protects clients during flu season.,Applicant upload,Document review,true,9\n');

    const needed = whatYoullNeed(await newApplicant({ ...realSeed, template_items: edited }));

    expect(needed.upload.find((item) => item.item_key === 'tb_test')?.reason).toBe('Protects clients and coworkers from TB.');
    expect(needed.upload.slice(-1)[0]).toEqual({
      item_key: 'flu_shot',
      name: 'Flu vaccination record',
      reason: 'Protects clients during flu season.',
    });
  });

  it('shows nothing to someone who is not signed in as an applicant', async () => {
    const dataLayer = await newApplicant();
    dataLayer.signOut();

    expect(whatYoullNeed(dataLayer)).toEqual({ upload: [], check: [] });
  });
});
