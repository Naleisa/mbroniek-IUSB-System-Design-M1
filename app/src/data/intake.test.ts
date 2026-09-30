import { describe, expect, it } from 'vitest';
import { AUDIT_TABLE, createDataLayer, createSystemDataLayer } from './dataLayer';
import { formatPhoneInput, formatSsnInput, normalizeSsn, saveIdentityStep, type IdentityFields } from './intake';
import { createMemoryBackend } from './memoryBackend';
import type { SeedFiles } from './seed';
import type { Actor } from './types';
import { createVendorVault } from './vault';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const applicant: Actor = { role: 'applicant', name: 'Nina Lopez' };
const NINA: IdentityFields = {
  first_name: 'Nina',
  last_name: 'Lopez',
  email: 'nina.lopez@example.com',
  phone: '(574) 555-0142',
  date_of_birth: '1990-04-12',
  ssn: '900-30-0001',
};

/** Full seed, with a new applicant started from Agency A's intake link. */
async function newApplicant() {
  const backend = createMemoryBackend();
  const dataLayer = createDataLayer(backend);
  await dataLayer.loadSeed(async () => realSeed);
  const caregiver = dataLayer.startIntake('hoosier-home-care')!;
  return { backend, dataLayer, caregiverId: caregiver.id };
}

describe('identity and contact step (R5, R8, ADR-11)', () => {
  it('stores only the SSN token and last four on the record, with the full SSN in the vault', async () => {
    const { backend, dataLayer, caregiverId } = await newApplicant();

    expect(saveIdentityStep(dataLayer, NINA, applicant)).toEqual({ ok: true });

    const record = createSystemDataLayer(backend).get('caregivers', caregiverId)!;
    expect(record).not.toHaveProperty('ssn');
    expect(record.ssn_token).toMatch(/^tok_/);
    expect(record.ssn_last4).toBe('0001');
    expect(JSON.stringify(record)).not.toContain('900-30-0001');
    expect(createVendorVault(backend).readSsn(record.ssn_token)).toBe('900-30-0001');
  });

  it('saves progress so a reload shows the same details, and renames the applicant account', async () => {
    const { backend, dataLayer, caregiverId } = await newApplicant();
    saveIdentityStep(dataLayer, NINA, applicant);

    // A reload is a new data layer on the same storage.
    const afterReload = createDataLayer(backend);
    expect(afterReload.get('caregivers', caregiverId)).toMatchObject({
      first_name: 'Nina',
      last_name: 'Lopez',
      email: 'nina.lopez@example.com',
      phone: '(574) 555-0142',
      date_of_birth: '1990-04-12',
      lifecycle_state: 'Intake In Progress',
    });
    expect(afterReload.getSignedInUser()).toMatchObject({ display_name: 'Nina Lopez', email: 'nina.lopez@example.com' });
    expect(afterReload.list(AUDIT_TABLE)).toEqual([]); // applicants never see the audit log
    expect(createSystemDataLayer(backend).list(AUDIT_TABLE).some((event) => event.actor_name === 'Nina Lopez')).toBe(true);
  });

  it('explains every missing field and saves nothing', async () => {
    const { backend, dataLayer, caregiverId } = await newApplicant();
    const blank: IdentityFields = { first_name: '', last_name: ' ', email: '', phone: '', date_of_birth: '', ssn: '' };

    const result = saveIdentityStep(dataLayer, blank, applicant);

    expect(result).toEqual({
      ok: false,
      errors: {
        first_name: 'Enter your first name.',
        last_name: 'Enter your last name.',
        email: 'Enter your email address.',
        phone: 'Enter your mobile phone number, including area code.',
        date_of_birth: 'Enter your date of birth.',
        ssn: 'Enter your Social Security number.',
      },
    });
    expect(createSystemDataLayer(backend).get('caregivers', caregiverId)?.first_name).toBe('');
  });

  it('refuses a badly formatted SSN, a real-looking SSN, and a future date of birth', async () => {
    const { dataLayer } = await newApplicant();

    const result = saveIdentityStep(
      dataLayer,
      { ...NINA, ssn: '123-45-6789', date_of_birth: '2999-01-01' },
      applicant,
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual({
      ssn: 'This demo accepts only test numbers that start with 9, like 900-12-3456.',
      date_of_birth: 'Enter a real date of birth.',
    });
    const short = saveIdentityStep(dataLayer, { ...NINA, ssn: '900-12' }, applicant);
    expect(!short.ok && short.errors.ssn).toBe('Enter your Social Security number as 9 digits, like 900-12-3456.');
  });

  it("refuses an email that's already on another application", async () => {
    const { dataLayer } = await newApplicant();

    const result = saveIdentityStep(dataLayer, { ...NINA, email: 'Maria.Gonzalez@example.com' }, applicant);

    expect(!result.ok && result.errors.email).toBe(
      'That email is already used on another application. Sign in with it to continue that one.',
    );
  });

  it('keeps the SSN on file when the field is left blank', async () => {
    const { backend, dataLayer, caregiverId } = await newApplicant();
    saveIdentityStep(dataLayer, NINA, applicant);
    const token = createSystemDataLayer(backend).get('caregivers', caregiverId)!.ssn_token;

    expect(saveIdentityStep(dataLayer, { ...NINA, phone: '(574) 555-0199', ssn: '' }, applicant)).toEqual({ ok: true });

    const record = createSystemDataLayer(backend).get('caregivers', caregiverId)!;
    expect(record.ssn_token).toBe(token);
    expect(record.phone).toBe('(574) 555-0199');
  });

  it('accepts an SSN typed without dashes', () => {
    expect(normalizeSsn('900300001')).toBe('900-30-0001');
    expect(normalizeSsn('900 30 0001')).toBe('900-30-0001');
    expect(normalizeSsn('90030')).toBeUndefined();
  });
});

describe('formatting phone and SSN as they are typed', () => {
  it('shapes a phone number step by step', () => {
    expect(formatPhoneInput('')).toBe('');
    expect(formatPhoneInput('5')).toBe('(5');
    expect(formatPhoneInput('574')).toBe('(574');
    expect(formatPhoneInput('5745')).toBe('(574) 5');
    expect(formatPhoneInput('574555')).toBe('(574) 555');
    expect(formatPhoneInput('5745550')).toBe('(574) 555-0');
    expect(formatPhoneInput('5745550142')).toBe('(574) 555-0142');
  });

  it('reformats pasted or messy phone numbers, drops a leading 1, and stops at 10 digits', () => {
    expect(formatPhoneInput('574.555.0142')).toBe('(574) 555-0142');
    expect(formatPhoneInput('+1 574 555 0142')).toBe('(574) 555-0142');
    expect(formatPhoneInput('15745550142')).toBe('(574) 555-0142');
  });

  it('keeps every typed digit, including a first digit of 1', () => {
    expect(formatPhoneInput('1')).toBe('(1');
    expect(formatPhoneInput('12')).toBe('(12');
    expect(formatPhoneInput('1234567890')).toBe('(123) 456-7890');
    expect(formatPhoneInput('0')).toBe('(0');
    expect(formatPhoneInput('(574) 555-01429')).toBe('(574) 555-0142');
    expect(formatPhoneInput('(574) 555-0142')).toBe('(574) 555-0142');
  });

  it('shapes an SSN step by step and stops at 9 digits', () => {
    expect(formatSsnInput('')).toBe('');
    expect(formatSsnInput('900')).toBe('900');
    expect(formatSsnInput('9003')).toBe('900-3');
    expect(formatSsnInput('90030')).toBe('900-30');
    expect(formatSsnInput('900300')).toBe('900-30-0');
    expect(formatSsnInput('900300001')).toBe('900-30-0001');
    expect(formatSsnInput('900-30-00019')).toBe('900-30-0001');
    expect(formatSsnInput('900 30 0001')).toBe('900-30-0001');
  });
});
