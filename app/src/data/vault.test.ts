import { describe, expect, it } from 'vitest';
import caregiversCsv from '../../public/seed/caregivers.csv?raw';
import { AUDIT_TABLE, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { SEED_TABLES } from './seed';
import type { Actor } from './types';
import { createVendorVault, VAULT_TABLE } from './vault';

const applicant: Actor = { role: 'applicant', name: 'Robert King' };

async function loadSeed(caregivers = caregiversCsv) {
  const backend = createMemoryBackend();
  const dataLayer = createSystemDataLayer(backend);
  await dataLayer.loadSeed(async () => ({ caregivers }));
  return { dataLayer, vendorVault: createVendorVault(backend) };
}

/** Everything a screen can read through the data layer, as one string. */
function everythingScreensCanRead(dataLayer: Awaited<ReturnType<typeof loadSeed>>['dataLayer']): string {
  return JSON.stringify([...SEED_TABLES, AUDIT_TABLE].map((table) => dataLayer.list(table)));
}

describe('SSN vault (R5, C4, ADR-11)', () => {
  it('stores an SSN in the vault and keeps only a token and last four on the record', async () => {
    const { dataLayer, vendorVault } = await loadSeed('id,agency_id,lifecycle_state\ncg-06,agency-a,Intake In Progress\n');

    const { ssn_token, ssn_last4 } = dataLayer.storeSsn('cg-06', '900-15-0001', applicant);

    const caregiver = dataLayer.get('caregivers', 'cg-06');
    expect(caregiver?.ssn_token).toBe(ssn_token);
    expect(ssn_token).toMatch(/^tok_/);
    expect(caregiver?.ssn_last4).toBe('0001');
    expect(caregiver).not.toHaveProperty('ssn');
    expect(vendorVault.readSsn(ssn_token)).toBe('900-15-0001');
  });

  it('returns the full SSN from no read used by screens', async () => {
    const { dataLayer } = await loadSeed('id,agency_id,lifecycle_state\ncg-06,agency-a,Intake In Progress\n');
    dataLayer.storeSsn('cg-06', '900-15-0001', applicant);

    expect(everythingScreensCanRead(dataLayer)).not.toContain('900-15-0001');
    expect(() => dataLayer.list(VAULT_TABLE)).toThrow(/vault cannot be read/);
    expect(() => dataLayer.get(VAULT_TABLE, 'anything')).toThrow(/vault cannot be read/);
    expect(dataLayer.list(AUDIT_TABLE).map((event) => event.event)).toEqual(['SSN stored', 'Updated']);
  });

  it('moves every seeded SSN into the vault', async () => {
    const { dataLayer, vendorVault } = await loadSeed();
    const caregivers = dataLayer.list('caregivers');

    expect(caregivers).toHaveLength(13);
    for (const caregiver of caregivers) {
      expect(caregiver, caregiver.id).not.toHaveProperty('ssn');
      const ssn = vendorVault.readSsn(caregiver.ssn_token);
      expect(ssn, caregiver.id).toMatch(/^900-\d{2}-\d{4}$/);
      expect(ssn?.slice(-4)).toBe(caregiver.ssn_last4);
    }
    expect(everythingScreensCanRead(dataLayer)).not.toMatch(/900-\d{2}-\d{4}/);
  });

  it('refuses SSNs outside the 900 test series', async () => {
    const { dataLayer } = await loadSeed('id,agency_id,lifecycle_state\ncg-06,agency-a,Intake In Progress\n');

    expect(() => dataLayer.storeSsn('cg-06', '123-45-6789', applicant)).toThrow(/900 series/);
    expect(() => dataLayer.storeSsn('cg-06', '900150001', applicant)).toThrow(/900 series/);
    expect(dataLayer.get('caregivers', 'cg-06')?.ssn_token).toBeUndefined();
  });

  it('refuses writing an SSN any other way', async () => {
    const { dataLayer } = await loadSeed('id,agency_id,lifecycle_state\ncg-06,agency-a,Intake In Progress\n');

    expect(() => dataLayer.update('caregivers', 'cg-06', { ssn: '900-15-0001' }, applicant)).toThrow(/storeSsn/);
    expect(() => dataLayer.insert('caregivers', { id: 'cg-99', ssn: '900-15-0001' }, applicant)).toThrow(/storeSsn/);
    expect(() => dataLayer.insert(VAULT_TABLE, { ssn: '900-15-0001' }, applicant)).toThrow(/storeSsn/);
  });
});
