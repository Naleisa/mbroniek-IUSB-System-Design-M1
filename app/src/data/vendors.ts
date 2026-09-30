import type { VendorVault } from './vault';

/**
 * The shared vendor adapter interface (ADR-01). Background check, exclusion,
 * and registry vendors all take the same request and return the same result,
 * so real vendors can replace the mocks after the pilot.
 */
export interface VendorRequest {
  caregiver_id: string;
  /** The vault token only. The adapter looks up the full SSN itself (ADR-11). */
  ssn_token: string;
}

/** `unavailable` means the source can't be queried right now, so the item needs a manual check (R26). */
export type VendorOutcome = 'clear' | 'match' | 'failure' | 'unavailable';

export interface VendorResult {
  outcome: VendorOutcome;
  /** The result in the vendor's own words, such as Clear or Active. Stored on the item and order. */
  label: string;
  vendor: string;
  /** The vendor's reference number for the order. */
  reference: string;
  /** Plain-language summary a coordinator can read. */
  detail: string;
}

export interface VendorAdapter {
  vendor: string;
  /** Places the order. Resolves with the result, or never resolves if the vendor never answers. */
  order(request: VendorRequest): Promise<VendorResult>;
}

export const BACKGROUND_CHECK_VENDOR = 'Mock Background Check';

/**
 * The reserved test SSN endings and what the mock vendors do with each (ADR-12), for the
 * "Test SSNs" hint on the intake SSN field (T62). A test keeps this list matching the mocks.
 */
export const TEST_SSN_OUTCOMES = [
  { ending: '0001', example: '900-12-0001', outcome: 'clear', label: 'Clear', meaning: '' },
  {
    ending: '0002',
    example: '900-12-0002',
    outcome: 'match',
    label: 'Exclusion match',
    meaning: 'the record goes to Review Required',
  },
  {
    ending: '0003',
    example: '900-12-0003',
    outcome: 'never',
    label: 'Never returns',
    meaning: 'the check shows as Delayed after 3 business days',
  },
  {
    ending: '0004',
    example: '900-12-0004',
    outcome: 'failure',
    label: 'Vendor failure',
    meaning: 'the check can be ordered again',
  },
] as const;

export type ExclusionList = 'OIG' | 'SAM';

interface MockVendorOptions {
  vendor: string;
  referencePrefix: string;
  /** What this vendor calls a clean result. */
  clearLabel: string;
  /** Set for vendors that report a match on SSNs ending 0002. */
  matchDetail?: string;
  /** Whether the source can be queried. When false, every order comes back unavailable. */
  isAvailable?: boolean;
}

/**
 * Shared mock vendor behavior (ADR-12). The last four digits of the test SSN pick
 * the outcome: 0002 is a match (exclusion vendors only), 0003 never returns,
 * 0004 is a vendor failure, and any other ending is clean.
 */
function createMockVendor(vault: VendorVault, delaySeconds: number, options: MockVendorOptions): VendorAdapter {
  const { vendor, referencePrefix, clearLabel, matchDetail, isAvailable = true } = options;
  let orderCount = 0;

  return {
    vendor,
    order: (request) => {
      orderCount += 1;
      const reference = `${referencePrefix}-${request.caregiver_id}-${orderCount}`;
      const ssn = vault.readSsn(request.ssn_token);
      const ending = ssn?.slice(-4);

      if (isAvailable && ending === '0003') {
        return new Promise<VendorResult>(() => {});
      }
      let result: VendorResult;
      if (!isAvailable) {
        result = {
          outcome: 'unavailable',
          label: 'Registry unavailable',
          vendor,
          reference,
          detail: 'State registry unavailable. Verify the certificate by hand.',
        };
      } else if (!ssn || ending === '0004') {
        result = {
          outcome: 'failure',
          label: 'Vendor failure',
          vendor,
          reference,
          detail: 'The vendor could not complete this check. Try again.',
        };
      } else if (ending === '0002' && matchDetail) {
        result = { outcome: 'match', label: 'Possible match', vendor, reference, detail: matchDetail };
      } else {
        result = { outcome: 'clear', label: clearLabel, vendor, reference, detail: 'No records found.' };
      }
      return new Promise((resolve) => setTimeout(() => resolve(result), delaySeconds * 1000));
    },
  };
}

/** The mock background check vendor. An SSN ending 0002 is Clear here; the exclusion vendors report the match. */
export function createMockBackgroundCheck(vault: VendorVault, delaySeconds: number): VendorAdapter {
  return createMockVendor(vault, delaySeconds, { vendor: BACKGROUND_CHECK_VENDOR, referencePrefix: 'BG', clearLabel: 'Clear' });
}

/** The mock OIG or SAM exclusion list vendor (R19). An SSN ending 0002 matches on both lists. */
export function createMockExclusionCheck(vault: VendorVault, delaySeconds: number, list: ExclusionList): VendorAdapter {
  return createMockVendor(vault, delaySeconds, {
    vendor: `Mock ${list} Exclusion List`,
    referencePrefix: list,
    clearLabel: 'Clear',
    matchDetail: `Name and date of birth match an ${list} exclusion entry. Coordinator review required.`,
  });
}

/**
 * The mock Indiana aide registry vendor (R26). When the registry is marked unavailable,
 * every order comes back unavailable so the item is tracked as a manual verification.
 */
export function createMockRegistryCheck(vault: VendorVault, delaySeconds: number, isAvailable: boolean): VendorAdapter {
  return createMockVendor(vault, delaySeconds, {
    vendor: 'Mock Indiana Aide Registry',
    referencePrefix: 'IN',
    clearLabel: 'Active',
    isAvailable,
  });
}
