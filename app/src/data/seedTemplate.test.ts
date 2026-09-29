import { describe, expect, it } from 'vitest';
import requirementTemplatesCsv from '../../public/seed/requirement_templates.csv?raw';
import templateItemsCsv from '../../public/seed/template_items.csv?raw';
import { createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';

// A fresh data layer loading the seed is what "Reset demo data" does (clear storage, load the seed).
async function loadFreshSeed() {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => ({
    requirement_templates: requirementTemplatesCsv,
    template_items: templateItemsCsv,
  }));
  return dataLayer;
}

describe('seeded Indiana Home Health Aide template', () => {
  it('exists and carries the sample label (ADR-03, Spec Q1)', async () => {
    const dataLayer = await loadFreshSeed();
    const template = dataLayer.get('requirement_templates', 'tpl-in-hha');

    expect(template).toBeDefined();
    expect(template?.state).toBe('IN');
    expect(template?.role).toBe('Home Health Aide');
    expect(template?.is_sample).toBe('true');
    expect(template?.sample_note).toMatch(/confirm against current Indiana rules/i);
  });

  it('has its eight required items', async () => {
    const dataLayer = await loadFreshSeed();
    const items = dataLayer.list('template_items').filter((item) => item.template_id === 'tpl-in-hha');

    expect(items.map((item) => item.item_key)).toEqual([
      'photo_id',
      'hha_certification',
      'background_check',
      'oig_exclusion',
      'sam_exclusion',
      'tb_test',
      'cpr_first_aid',
      'drivers_license',
    ]);
  });

  it('gives every item a plain-language reason for applicants (R18)', async () => {
    const dataLayer = await loadFreshSeed();

    for (const item of dataLayer.list('template_items')) {
      expect(item.reason.trim(), item.item_key).not.toBe('');
    }
  });
});
