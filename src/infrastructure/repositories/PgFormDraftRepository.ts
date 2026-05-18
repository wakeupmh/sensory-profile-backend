import pool from '../database/connection';
import { FormDraft } from '../../domain/entities/FormDraft';
import {
  FormDraftRepository,
  FormDraftUpsertInput,
} from '../../domain/repositories/FormDraftRepository';

export class PgFormDraftRepository implements FormDraftRepository {
  async upsert(input: FormDraftUpsertInput): Promise<FormDraft> {
    const result = await pool.query(
      `INSERT INTO form_drafts (id, user_id, form_type, payload, current_step, instrument_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (user_id, form_type) DO UPDATE SET
         payload       = EXCLUDED.payload,
         current_step  = EXCLUDED.current_step,
         instrument_id = EXCLUDED.instrument_id,
         updated_at    = NOW()
       RETURNING *`,
      [
        input.id!,
        input.userId,
        input.formType,
        JSON.stringify(input.payload),
        input.currentStep,
        input.instrumentId ?? null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserAndType(userId: string, formType: string): Promise<FormDraft | null> {
    const result = await pool.query(
      `SELECT * FROM form_drafts WHERE user_id = $1 AND form_type = $2`,
      [userId, formType]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(userId: string, formType: string): Promise<void> {
    await pool.query(
      `DELETE FROM form_drafts WHERE user_id = $1 AND form_type = $2`,
      [userId, formType]
    );
  }

  private mapRow(row: Record<string, unknown>): FormDraft {
    return new FormDraft({
      id: row.id as string,
      userId: row.user_id as string,
      formType: row.form_type as 'sensory_assessment' | 'anamnese',
      payload: row.payload as Record<string, unknown>,
      currentStep: row.current_step as number,
      instrumentId: (row.instrument_id as string | null) ?? null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    });
  }
}
