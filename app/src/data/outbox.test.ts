import { describe, expect, it } from 'vitest';
import { createDataLayer } from './dataLayer';
import { createMemoryBackend } from './memoryBackend';
import { agencyOutbox } from './outbox';
import type { SeedFiles } from './seed';
import type { Actor } from './types';
import { requestReplacement } from './worklist';

// Every real seed file, loaded the way the app loads it.
const seedFiles = import.meta.glob('../../public/seed/*.csv', { query: '?raw', import: 'default', eager: true });
const realSeed: SeedFiles = Object.fromEntries(
  Object.entries(seedFiles).map(([path, csv]) => [path.split('/').pop()!.replace('.csv', ''), csv as string]),
);

const dana: Actor = { role: 'coordinator', name: 'Dana Whitfield' };

/** Full seed with a few messages: sign-in links for Maria (A) and Hannah (B), and Dana's replacement request for Samuel. */
async function withMessages() {
  const dataLayer = createDataLayer(createMemoryBackend());
  await dataLayer.loadSeed(async () => realSeed);
  dataLayer.requestSignInLink('maria.gonzalez@example.com');
  dataLayer.requestSignInLink('hannah.schultz@example.com');
  dataLayer.signIn('dana.whitfield@hoosierhomecare.example', 'demo1234');
  expect(requestReplacement(dataLayer, 'ri-cg-08-tb_test', dana).ok).toBe(true);
  return dataLayer;
}

describe('agency outbox (ADR-06, R4)', () => {
  it("shows the coordinator only their agency's messages, each marked email or SMS", async () => {
    const dataLayer = await withMessages();

    const messages = agencyOutbox(dataLayer);

    expect(messages.map((message) => message.caregiverName).sort()).toEqual([
      'Maria Gonzalez',
      'Samuel Okafor',
      'Samuel Okafor',
    ]);
    expect(messages.every((message) => message.channel === 'email' || message.channel === 'sms')).toBe(true);
  });

  it("shows a replacement request's email and text, with the address or phone number for each", async () => {
    const dataLayer = await withMessages();

    const samuel = agencyOutbox(dataLayer).filter((message) => message.caregiverId === 'cg-08');

    const email = samuel.find((message) => message.channel === 'email')!;
    const sms = samuel.find((message) => message.channel === 'sms')!;
    expect(email).toMatchObject({
      recipientName: 'Samuel Okafor',
      recipientAddress: 'samuel.okafor@example.com',
      subject: 'Please replace your TB test result',
    });
    expect(sms).toMatchObject({ recipientName: 'Samuel Okafor', subject: '' });
    expect(sms.recipientAddress).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
    expect(sms.body).toMatch(/^CareMatch: Hoosier Home Care needs a new TB test result by \d{4}-\d{2}-\d{2}\.$/);
  });

  it('hides sign-in links from coordinators', async () => {
    const dataLayer = await withMessages();

    const maria = agencyOutbox(dataLayer).find((message) => message.caregiverId === 'cg-01')!;

    expect(maria.body).toContain('[sign-in link hidden]');
    expect(maria.body).not.toMatch(/token=/);
  });

  it('lists the newest message first', async () => {
    const dataLayer = await withMessages();

    const messages = agencyOutbox(dataLayer);

    // The replacement request (email, then text) came after Maria's sign-in link.
    expect(messages.map((message) => message.channel)).toEqual(['sms', 'email', 'email']);
    expect(messages[2].caregiverName).toBe('Maria Gonzalez');
  });

  it("shows Agency B's coordinator none of Agency A's messages", async () => {
    const dataLayer = await withMessages();
    dataLayer.signOut();
    dataLayer.signIn('marcus.lee@riverbendcaregivers.example', 'demo1234');

    expect(agencyOutbox(dataLayer).map((message) => message.caregiverName)).toEqual(['Hannah Schultz']);
  });
});
