import { ConsentRepository } from '../../domain/repositories/ConsentRepository';
import { CURRENT_CONSENT_VERSION, ConsentRecord, ConsentStatus } from '../../domain/entities/Consent';
import { ValidationError } from '../../infrastructure/utils/errors/CustomErrors';

function toStatus(record: ConsentRecord | null): ConsentStatus {
  return {
    currentVersion: CURRENT_CONSENT_VERSION,
    acceptedVersion: record?.version ?? null,
    acceptedAt: record?.acceptedAt ?? null,
  };
}

export class ConsentService {
  constructor(private readonly repo: ConsentRepository) {}

  async getStatus(userId: string): Promise<ConsentStatus> {
    return toStatus(await this.repo.findLatest(userId));
  }

  /** Only the current term can be accepted: an old version means the client showed an outdated text. */
  async accept(userId: string, version: string): Promise<ConsentStatus> {
    if (version !== CURRENT_CONSENT_VERSION) {
      throw new ValidationError(`Versão do termo desatualizada: a versão atual é ${CURRENT_CONSENT_VERSION}`);
    }
    return toStatus(await this.repo.accept(userId, version));
  }
}
