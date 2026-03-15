import { Assessment } from '../../domain/entities/Assessment';
import { AssessmentRepository, AssessmentQueryOptions, PaginatedResult } from '../../domain/repositories/AssessmentRepository';
import pool from '../database/connection';
import { v7 as uuidv7 } from 'uuid';

export interface AssessmentWithRelations extends Assessment {
  childName?: string;
  childBirthDate?: Date;
  childGender?: string;
  childOtherInfo?: string;
  childAge?: number;
  examinerName?: string;
  examinerProfession?: string;
  examinerContact?: string;
  caregiverName?: string;
  caregiverRelationship?: string;
  caregiverContact?: string;
}

export class PgAssessmentRepository implements AssessmentRepository {
  async findAll(userId: string, options?: AssessmentQueryOptions): Promise<PaginatedResult<Assessment>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['sa.user_id = $1'];
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (options?.childId) {
      conditions.push(`sa.child_id = $${paramIndex++}`);
      params.push(options.childId);
    }
    if (options?.dateFrom) {
      conditions.push(`sa.assessment_date >= $${paramIndex++}`);
      params.push(options.dateFrom);
    }
    if (options?.dateTo) {
      conditions.push(`sa.assessment_date <= $${paramIndex++}`);
      params.push(options.dateTo);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM sensory_assessments sa WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT
        sa.*,
        c.name as child_name,
        c.birth_date as child_birth_date,
        c.gender as child_gender,
        c.other_info as child_other_info,
        e.name as examiner_name,
        e.profession as examiner_profession,
        e.contact as examiner_contact,
        cg.name as caregiver_name,
        cg.relationship as caregiver_relationship,
        cg.contact as caregiver_contact
      FROM
        sensory_assessments sa
      LEFT JOIN
        children c ON sa.child_id = c.id
      LEFT JOIN
        examiners e ON sa.examiner_id = e.id
      LEFT JOIN
        caregivers cg ON sa.caregiver_id = cg.id
      WHERE
        ${whereClause}
      ORDER BY
        sa.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await pool.query(query, [...params, limit, offset]);

    return {
      data: result.rows.map(row => this.mapRowToAssessment(row)),
      total,
      page,
      limit
    };
  }

  async findById(id: string, userId: string): Promise<Assessment | null> {
    const query = `
      SELECT 
        sa.*,
        c.name as child_name, 
        c.birth_date as child_birth_date,
        c.gender as child_gender,
        c.other_info as child_other_info,
        e.name as examiner_name,
        e.profession as examiner_profession,
        e.contact as examiner_contact,
        cg.name as caregiver_name,
        cg.relationship as caregiver_relationship,
        cg.contact as caregiver_contact
      FROM 
        sensory_assessments sa
      LEFT JOIN 
        children c ON sa.child_id = c.id
      LEFT JOIN 
        examiners e ON sa.examiner_id = e.id
      LEFT JOIN 
        caregivers cg ON sa.caregiver_id = cg.id
      WHERE 
        sa.id = $1 AND sa.user_id = $2
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAssessment(result.rows[0]);
  }

  async save(assessment: Assessment, userId: string): Promise<Assessment> {
    const id = assessment.getId() || uuidv7();
    
    const result = await pool.query(
      `INSERT INTO sensory_assessments (
        id, child_id, examiner_id, caregiver_id, assessment_date,
        auditory_processing_raw_score, visual_processing_raw_score,
        tactile_processing_raw_score, movement_processing_raw_score,
        body_position_processing_raw_score, oral_sensitivity_processing_raw_score,
        behavioral_responses_raw_score,
        social_emotional_responses_raw_score, attention_responses_raw_score,
        user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        id,
        assessment.getChildId(),
        assessment.getExaminerId(),
        assessment.getCaregiverId(),
        assessment.getAssessmentDate(),
        assessment.getAuditoryProcessingRawScore(),
        assessment.getVisualProcessingRawScore(),
        assessment.getTactileProcessingRawScore(),
        assessment.getMovementProcessingRawScore(),
        assessment.getBodyPositionProcessingRawScore(),
        assessment.getOralSensitivityProcessingRawScore(),
        assessment.getBehavioralResponsesRawScore(),
        assessment.getSocialEmotionalResponsesRawScore(),
        assessment.getAttentionResponsesRawScore(),
        userId
      ]
    );

    return this.mapRowToAssessment(result.rows[0]);
  }

  async update(assessment: Assessment, userId: string): Promise<Assessment> {
    const result = await pool.query(
      `UPDATE sensory_assessments SET
        child_id = $1,
        examiner_id = $2,
        caregiver_id = $3,
        assessment_date = $4,
        auditory_processing_raw_score = $5,
        visual_processing_raw_score = $6,
        tactile_processing_raw_score = $7,
        movement_processing_raw_score = $8,
        body_position_processing_raw_score = $9,
        oral_sensitivity_processing_raw_score = $10,
        behavioral_responses_raw_score = $11,
        social_emotional_responses_raw_score = $12,
        attention_responses_raw_score = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14 AND user_id = $15 RETURNING *`,
      [
        assessment.getChildId(),
        assessment.getExaminerId(),
        assessment.getCaregiverId(),
        assessment.getAssessmentDate(),
        assessment.getAuditoryProcessingRawScore(),
        assessment.getVisualProcessingRawScore(),
        assessment.getTactileProcessingRawScore(),
        assessment.getMovementProcessingRawScore(),
        assessment.getBodyPositionProcessingRawScore(),
        assessment.getOralSensitivityProcessingRawScore(),
        assessment.getBehavioralResponsesRawScore(),
        assessment.getSocialEmotionalResponsesRawScore(),
        assessment.getAttentionResponsesRawScore(),
        assessment.getId(),
        userId
      ]
    );

    if (result.rows.length === 0) {
      throw new Error(`Assessment with ID ${assessment.getId()} not found for this user`);
    }

    return this.mapRowToAssessment(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<void> {
    await pool.query('DELETE FROM sensory_assessments WHERE id = $1 AND user_id = $2', [id, userId]);
  }

  async findByChildId(childId: string, userId: string): Promise<Assessment[]> {
    const query = `
      SELECT 
        sa.*,
        c.name as child_name, 
        c.birth_date as child_birth_date,
        c.gender as child_gender,
        c.other_info as child_other_info,
        e.name as examiner_name,
        e.profession as examiner_profession,
        e.contact as examiner_contact,
        cg.name as caregiver_name,
        cg.relationship as caregiver_relationship,
        cg.contact as caregiver_contact
      FROM 
        sensory_assessments sa
      LEFT JOIN 
        children c ON sa.child_id = c.id
      LEFT JOIN 
        examiners e ON sa.examiner_id = e.id
      LEFT JOIN 
        caregivers cg ON sa.caregiver_id = cg.id
      WHERE 
        sa.child_id = $1 AND sa.user_id = $2
      ORDER BY 
        sa.assessment_date DESC
    `;

    const result = await pool.query(query, [childId, userId]);

    return result.rows.map(row => this.mapRowToAssessment(row));
  }

  private mapRowToAssessment(row: Record<string, unknown>): AssessmentWithRelations {
    const assessment = new Assessment(
      row.child_id as string,
      row.examiner_id as string | null,
      row.caregiver_id as string | null,
      row.assessment_date as Date,
      row.auditory_processing_raw_score as number | undefined,
      row.visual_processing_raw_score as number | undefined,
      row.tactile_processing_raw_score as number | undefined,
      row.movement_processing_raw_score as number | undefined,
      row.body_position_processing_raw_score as number | undefined,
      row.oral_sensitivity_processing_raw_score as number | undefined,
      row.behavioral_responses_raw_score as number | undefined,
      row.social_emotional_responses_raw_score as number | undefined,
      row.attention_responses_raw_score as number | undefined,
      row.id as string,
      row.created_at as Date,
      row.updated_at as Date
    ) as AssessmentWithRelations;

    if (row.child_name) {
      assessment.childName = row.child_name as string;
      assessment.childBirthDate = row.child_birth_date as Date;
      assessment.childGender = row.child_gender as string;
      assessment.childOtherInfo = row.child_other_info as string;
      assessment.childAge = this.calculateAge(row.child_birth_date as Date);
    }

    if (row.examiner_name) {
      assessment.examinerName = row.examiner_name as string;
      assessment.examinerProfession = row.examiner_profession as string;
      assessment.examinerContact = row.examiner_contact as string;
    }

    if (row.caregiver_name) {
      assessment.caregiverName = row.caregiver_name as string;
      assessment.caregiverRelationship = row.caregiver_relationship as string;
      assessment.caregiverContact = row.caregiver_contact as string;
    }

    return assessment;
  }

  private calculateAge(birthDate: Date): number {
    if (!birthDate) return 0;
    
    const today = new Date();
    const birth = new Date(birthDate);
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDifference = today.getMonth() - birth.getMonth();
    
    // If birthday hasn't occurred yet this year, subtract one year
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }
}
