import type { ConsentType } from './types';

/**
 * The wording shown on the disclosure and authorization screens (R3, ADR-16, C8). Each
 * saved consent records this version, so there's proof of exactly what the applicant saw.
 * Change the wording only together with a new version.
 *
 * Sample wording for the demo; it needs legal review before real use.
 */
export const CONSENT_WORDING_VERSION = 'v1.0';

export interface ConsentWording {
  heading: string;
  paragraphs: string[];
}

export function consentWording(type: ConsentType, agencyName: string): ConsentWording {
  if (type === 'disclosure') {
    return {
      heading: 'Background check disclosure',
      paragraphs: [
        `${agencyName} will get a background check report about you from a screening company. They'll also check the federal exclusion lists (OIG and SAM) and the Indiana aide registry.`,
        "The report is used only to decide whether you can work in clients' homes, and only the information needed for that is shared.",
        'You can ask for a copy of your report.',
      ],
    };
  }
  return {
    heading: 'Authorization for background checks',
    paragraphs: [
      `I authorize ${agencyName} to get a background check report about me and to run the exclusion list and aide registry checks described in the disclosure.`,
    ],
  };
}
