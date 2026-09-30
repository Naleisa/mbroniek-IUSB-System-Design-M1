import { afterEach, describe, expect, it, vi } from 'vitest';
import settingsCsv from '../../public/seed/settings.csv?raw';
import usersCsv from '../../public/seed/users.csv?raw';
import { AUDIT_TABLE, createSystemDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';

async function loadSeed() {
  const dataLayer = createSystemDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => ({ users: usersCsv, settings: settingsCsv }));
  return dataLayer;
}

function tokenFromOutbox(dataLayer: Awaited<ReturnType<typeof loadSeed>>): string {
  const [message] = dataLayer.list('notifications').slice(-1);
  return decodeURIComponent(/token=([^&\s]+)/.exec(message.body)?.[1] ?? '');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('applicant magic-link sign-in (ADR-05, ADR-06, R8)', () => {
  it('writes a sign-in link to the outbox for an applicant', async () => {
    const dataLayer = await loadSeed();

    expect(dataLayer.requestSignInLink('Maria.Gonzalez@example.com')).toBe(true);

    const [message] = dataLayer.list('notifications');
    expect(message).toMatchObject({
      channel: 'email',
      recipient_user_id: 'u-cg-01',
      caregiver_id: 'cg-01',
      agency_id: 'agency-a',
    });
    expect(message.body).toMatch(/#\/auth\?token=.+&next=%2Fapplicant/);
    expect(message.body).toContain('7 days');
  });

  it('sends nothing for unknown emails or coordinator accounts', async () => {
    const dataLayer = await loadSeed();

    expect(dataLayer.requestSignInLink('nobody@example.com')).toBe(false);
    expect(dataLayer.requestSignInLink('dana.whitfield@hoosierhomecare.example')).toBe(false);
    expect(dataLayer.list('notifications')).toEqual([]);
  });

  it('signs the applicant in and returns the intended route', async () => {
    const dataLayer = await loadSeed();
    dataLayer.requestSignInLink('maria.gonzalez@example.com', '/applicant');

    const result = dataLayer.signInWithLink(tokenFromOutbox(dataLayer));

    expect(result).toMatchObject({ ok: true, next: '/applicant' });
    expect(dataLayer.getSignedInUser()?.display_name).toBe('Maria Gonzalez');
  });

  it('only sends links to in-app routes', async () => {
    const dataLayer = await loadSeed();
    dataLayer.requestSignInLink('maria.gonzalez@example.com', '//evil.example');

    expect(dataLayer.signInWithLink(tokenFromOutbox(dataLayer))).toMatchObject({ ok: true, next: '/applicant' });
  });

  it('refuses unknown and expired links', async () => {
    const dataLayer = await loadSeed();
    expect(dataLayer.signInWithLink('not-a-token')).toEqual({
      ok: false,
      reason: "This sign-in link isn't valid. Please request a new one.",
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 29, 9, 0));
    dataLayer.requestSignInLink('maria.gonzalez@example.com');
    vi.setSystemTime(new Date(2026, 9, 7, 9, 0)); // 8 days later, past the 7-day window

    expect(dataLayer.signInWithLink(tokenFromOutbox(dataLayer))).toEqual({
      ok: false,
      reason: 'This sign-in link has expired. Please request a new one.',
    });
    expect(dataLayer.getSignedInUser()).toBeUndefined();
  });

  it('keeps tokens out of the audit log', async () => {
    const dataLayer = await loadSeed();
    dataLayer.requestSignInLink('maria.gonzalez@example.com');
    const token = tokenFromOutbox(dataLayer);
    dataLayer.signInWithLink(token);

    expect(JSON.stringify(dataLayer.list(AUDIT_TABLE))).not.toContain(token);
  });
});
