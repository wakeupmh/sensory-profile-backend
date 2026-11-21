import { v7 as uuidv7 } from 'uuid';
import { PoolClient } from 'pg';

export interface SectionComment {
  section: string;
  comments: string;
}

export class SectionCommentService {
  async deleteByAssessmentId(assessmentId: string, client: PoolClient, userId: string): Promise<void> {
    await client.query(
      `DELETE FROM section_comments sc
       WHERE sc.assessment_id = $1
         AND EXISTS (SELECT 1 FROM sensory_assessments sa WHERE sa.id = sc.assessment_id AND sa.user_id = $2)`,
      [assessmentId, userId]
    );
  }

  // The caller owns the transaction (BEGIN/COMMIT/ROLLBACK) on `client`.
  async saveSectionComments(assessmentId: string, comments: SectionComment[], client: PoolClient): Promise<void> {
    if (!comments || comments.length === 0) return;

    const values: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;
    for (const comment of comments) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
      params.push(uuidv7(), assessmentId, comment.section, comment.comments);
      idx += 4;
    }

    await client.query(
      `INSERT INTO section_comments (id, assessment_id, section_name, comments) VALUES ${values.join(', ')}`,
      params
    );
  }
}
