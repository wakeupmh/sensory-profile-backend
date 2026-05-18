import { v7 as uuidv7 } from 'uuid';
import pool from '../database/connection';
import { Child } from '../../domain/entities/Child';
import { ChildRepository, ChildCreateInput, ChildUpdateInput } from '../../domain/repositories/ChildRepository';

export class PgChildRepository implements ChildRepository {
  async findByUserId(userId: string): Promise<Child[]> {
    const result = await pool.query(
      `SELECT * FROM children WHERE user_id = $1 ORDER BY name`,
      [userId]
    );
    return result.rows.map(this.mapRow);
  }

  async findById(id: string, userId: string): Promise<Child | null> {
    const result = await pool.query(
      `SELECT * FROM children WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async create(input: ChildCreateInput): Promise<Child> {
    const result = await pool.query(
      `INSERT INTO children (id, user_id, name, birth_date, gender, national_identity, other_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.name,
        input.birthDate,
        input.gender ?? null,
        input.nationalIdentity ?? null,
        input.otherInfo ?? null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, userId: string, input: ChildUpdateInput): Promise<Child | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.birthDate !== undefined) { fields.push(`birth_date = $${idx++}`); values.push(input.birthDate); }
    if (input.gender !== undefined) { fields.push(`gender = $${idx++}`); values.push(input.gender); }
    if (input.nationalIdentity !== undefined) { fields.push(`national_identity = $${idx++}`); values.push(input.nationalIdentity); }
    if (input.otherInfo !== undefined) { fields.push(`other_info = $${idx++}`); values.push(input.otherInfo); }

    if (fields.length === 0) return this.findById(id, userId);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, userId);

    const result = await pool.query(
      `UPDATE children SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx++} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const has = await this.hasAssessments(id);
    if (has) return false;
    await pool.query(`DELETE FROM children WHERE id = $1 AND user_id = $2`, [id, userId]);
    return true;
  }

  async hasAssessments(id: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM sensory_assessments WHERE child_id = $1 LIMIT 1`,
      [id]
    );
    return result.rows.length > 0;
  }

  async findOrCreate(userId: string, data: {
    name: string;
    birthDate?: string;
    gender?: string;
    nationalIdentity?: string;
    otherInfo?: string;
  }): Promise<Child> {
    if (data.nationalIdentity) {
      const childId = uuidv7();
      const result = await pool.query(
        `INSERT INTO children (id, name, birth_date, gender, national_identity, user_id, other_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (national_identity, user_id) DO UPDATE SET
           name = EXCLUDED.name,
           birth_date = EXCLUDED.birth_date,
           gender = EXCLUDED.gender,
           other_info = EXCLUDED.other_info,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          childId,
          data.name,
          data.birthDate ?? null,
          data.gender ?? null,
          data.nationalIdentity,
          userId,
          data.otherInfo ?? null,
        ]
      );
      return this.mapRow(result.rows[0]);
    }

    // No nationalIdentity — always insert a new child
    const childId = uuidv7();
    const result = await pool.query(
      `INSERT INTO children (id, name, birth_date, gender, national_identity, user_id, other_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        childId,
        data.name,
        data.birthDate ?? null,
        data.gender ?? null,
        null,
        userId,
        data.otherInfo ?? null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: Record<string, unknown>): Child {
    const birthDate = row.birth_date as Date | string | null;
    const birthDateStr = birthDate
      ? (birthDate instanceof Date ? birthDate.toISOString().split('T')[0] : String(birthDate).split('T')[0])
      : '';

    return new Child({
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      birthDate: birthDateStr,
      gender: (row.gender as string | null) ?? null,
      nationalIdentity: (row.national_identity as string | null) ?? null,
      otherInfo: (row.other_info as string | null) ?? null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    });
  }
}
