import { v7 as uuidv7 } from 'uuid';
import { FormDraft } from '../../domain/entities/FormDraft';
import {
  FormDraftRepository,
  FormDraftUpsertInput,
} from '../../domain/repositories/FormDraftRepository';

export class FormDraftService {
  constructor(private readonly repo: FormDraftRepository) {}

  async upsert(input: FormDraftUpsertInput): Promise<FormDraft> {
    return this.repo.upsert({ ...input, id: input.id ?? uuidv7() });
  }

  async get(userId: string, formType: string): Promise<FormDraft | null> {
    return this.repo.findByUserAndType(userId, formType);
  }

  async delete(userId: string, formType: string): Promise<void> {
    return this.repo.delete(userId, formType);
  }
}
