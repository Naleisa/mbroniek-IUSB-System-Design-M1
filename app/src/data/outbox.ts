import type { DataLayer } from './dataLayer';

/**
 * The coordinator's agency outbox (T49, ADR-06, R4): every email and text sent in their
 * agency, each marked by channel. Read through the coordinator's own data layer, so another
 * agency's messages never appear. Nothing here is really sent (Spec D6).
 */

export interface OutboxMessage {
  id: string;
  channel: 'email' | 'sms';
  recipientName: string;
  /** The recipient's email address for an email, or phone number for a text, when known. */
  recipientAddress: string;
  caregiverId: string;
  caregiverName: string;
  /** Blank for texts. */
  subject: string;
  body: string;
  createdAt: string;
}

/** Sign-in links would let a coordinator sign in as the applicant, so they are hidden here. */
function hideSignInLinks(body: string): string {
  return body.replace(/#\/auth\?\S+/g, '[sign-in link hidden]');
}

/** The coordinator's agency messages, newest first. */
export function agencyOutbox(dataLayer: DataLayer): OutboxMessage[] {
  const users = dataLayer.list('users');
  const caregivers = dataLayer.list('caregivers');
  return dataLayer
    .list('notifications')
    // Newest first; messages sent in the same minute are listed in reverse of the order they were sent.
    .reverse()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((message) => {
      const recipient = users.find((user) => user.id === message.recipient_user_id);
      const recipientCaregiver = recipient?.caregiver_id
        ? caregivers.find((caregiver) => caregiver.id === recipient.caregiver_id)
        : undefined;
      const about = caregivers.find((caregiver) => caregiver.id === message.caregiver_id);
      const channel = message.channel === 'sms' ? 'sms' : 'email';
      return {
        id: message.id,
        channel,
        recipientName: recipient?.display_name ?? 'Unknown recipient',
        recipientAddress: channel === 'sms' ? (recipientCaregiver?.phone ?? '') : (recipient?.email ?? ''),
        caregiverId: message.caregiver_id ?? '',
        caregiverName: about ? `${about.first_name} ${about.last_name}`.trim() || 'New applicant' : '',
        subject: message.subject ?? '',
        body: hideSignInLinks(message.body ?? ''),
        createdAt: message.created_at,
      };
    });
}
