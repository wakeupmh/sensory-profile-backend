/** The version of the consent term the app shows today. Bump it when the term changes. */
export const CURRENT_CONSENT_VERSION = '2026-11-23';

export interface ConsentRecord {
  version: string;
  acceptedAt: Date;
}

export interface ConsentStatus {
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: Date | null;
}
