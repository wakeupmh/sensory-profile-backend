import { ConsentRecord } from '../entities/Consent';

export interface ConsentRepository {
  /** The most recent version this user accepted, or null if none. */
  findLatest(userId: string): Promise<ConsentRecord | null>;
  /** Idempotent: accepting a version already accepted returns the original record. */
  accept(userId: string, version: string): Promise<ConsentRecord>;
}
