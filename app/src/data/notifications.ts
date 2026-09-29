import type { DataLayer } from './dataLayer';
import { formatLocalDateTime } from './relativeDates';
import type { Row } from './storageBackend';
import type { Actor } from './types';

/**
 * The notification service (ADR-06). Every notification is created here and written
 * to the in-app outbox, marked with its channel. Nothing is sent: the demo makes no
 * network request (Spec D6). A real sender can be added behind this service for the pilot.
 */

const SYSTEM: Actor = { role: 'system', name: 'CareMatch' };

export interface EmailMessage {
  recipient_user_id: string;
  agency_id: string;
  /** The caregiver the message is about, or blank. */
  caregiver_id: string;
  subject: string;
  body: string;
}

/** Writes one email to the outbox as CareMatch and returns the outbox row. */
export function sendEmail(systemDataLayer: DataLayer, message: EmailMessage, now: Date): Row {
  return systemDataLayer.insert(
    'notifications',
    { ...message, channel: 'email', created_at: formatLocalDateTime(now) },
    SYSTEM,
  );
}

/** The coordinators of one agency, who receive that agency's record notifications. */
export function coordinatorsOf(systemDataLayer: DataLayer, agencyId: string): Row[] {
  return systemDataLayer.list('users').filter((user) => user.role === 'coordinator' && user.agency_id === agencyId);
}
