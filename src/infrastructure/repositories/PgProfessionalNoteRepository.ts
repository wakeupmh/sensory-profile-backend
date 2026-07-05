import pool from '../database/connection';
import { ProfessionalNote, ProfessionalNoteProps } from '../../domain/entities/ProfessionalNote';
import {
  ProfessionalNoteRepository,
  ProfessionalNoteCreateInput,
  ProfessionalNoteUpdateInput,
} from '../../domain/repositories/ProfessionalNoteRepository';

export class PgProfessionalNoteRepository implements ProfessionalNoteRepository {
  private mapRow(row: Record<string, unknown>): ProfessionalNote {
    const props = {
      id: row.id as string,
      professionalId: row.professional_id as string,
      authorUserId: row.author_user_id as string,
      childId: row.child_id as string,
      resourceType: (row.resource_type as string | null) ?? null,
      resourceId: (row.resource_id as string | null) ?? null,
      content: row.content as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies ProfessionalNoteProps;
    return new ProfessionalNote(props);
  }

  async save(input: ProfessionalNoteCreateInput): Promise<ProfessionalNote> {
    const result = await pool.query(
      `INSERT INTO professional_notes
         (id, professional_id, author_user_id, child_id, resource_type, resource_id, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.professionalId,
        input.authorUserId,
        input.childId,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.content,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<ProfessionalNote | null> {
    const result = await pool.query(`SELECT * FROM professional_notes WHERE id = $1`, [id]);
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findAllByChild(childId: string): Promise<ProfessionalNote[]> {
    const result = await pool.query(
      `SELECT * FROM professional_notes WHERE child_id = $1 ORDER BY created_at DESC`,
      [childId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findAllByChildAndProfessional(childId: string, professionalId: string): Promise<ProfessionalNote[]> {
    const result = await pool.query(
      `SELECT * FROM professional_notes WHERE child_id = $1 AND professional_id = $2 ORDER BY created_at DESC`,
      [childId, professionalId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(id: string, professionalId: string, input: ProfessionalNoteUpdateInput): Promise<ProfessionalNote | null> {
    const result = await pool.query(
      `UPDATE professional_notes
       SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND professional_id = $3
       RETURNING *`,
      [input.content, id, professionalId],
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async delete(id: string, professionalId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM professional_notes WHERE id = $1 AND professional_id = $2`,
      [id, professionalId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
