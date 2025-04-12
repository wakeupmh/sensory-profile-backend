import { Assessment } from '../../domain/entities/Assessment';
import { AssessmentRepository } from '../../domain/repositories/AssessmentRepository';
import pool from '../database/connection';
import { v7 as uuidv7 } from 'uuid';

export class PgAssessmentRepository implements AssessmentRepository {
  async findAll(userId: string): Promise<Assessment[]> {
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
        sa.user_id = $1 
      ORDER BY 
        sa.created_at DESC
    `;

    const result = await pool.query(query, [userId]);

    return result.rows.map(row => this.mapRowToAssessment(row));
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
        social_emotional_responses_raw_score, attention_responses_raw_score,
        user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
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
        social_emotional_responses_raw_score = $11,
        attention_responses_raw_score = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 AND user_id = $14 RETURNING *`,
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

  private mapRowToAssessment(row: any): Assessment {
    const assessment = new Assessment(
      row.child_id,
      row.examiner_id,
      row.caregiver_id,
      row.assessment_date,
      row.auditory_processing_raw_score,
      row.visual_processing_raw_score,
      row.tactile_processing_raw_score,
      row.movement_processing_raw_score,
      row.body_position_processing_raw_score,
      row.oral_sensitivity_processing_raw_score,
      row.social_emotional_responses_raw_score,
      row.attention_responses_raw_score,
      row.id,
      row.created_at,
      row.updated_at
    );
    
    // Add additional properties for the frontend
    if (row.child_name) {
      (assessment as any).childName = row.child_name;
      (assessment as any).childBirthDate = row.child_birth_date;
      (assessment as any).childGender = row.child_gender;
      (assessment as any).childOtherInfo = row.child_other_info;
      (assessment as any).childAge = this.calculateAge(row.child_birth_date);
    }
    
    if (row.examiner_name) {
      (assessment as any).examinerName = row.examiner_name;
      (assessment as any).examinerProfession = row.examiner_profession;
      (assessment as any).examinerContact = row.examiner_contact;
    }
    
    if (row.caregiver_name) {
      (assessment as any).caregiverName = row.caregiver_name;
      (assessment as any).caregiverRelationship = row.caregiver_relationship;
      (assessment as any).caregiverContact = row.caregiver_contact;
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
