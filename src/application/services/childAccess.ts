import type { Pool, PoolClient } from 'pg';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

/**
 * A criança é desta conta? Senão, 404 — o mesmo "não existe" de um id que
 * nunca existiu, para não confirmar a quem pergunta que a criança é de outro.
 *
 * Sob delegação, `userId` já é o do dono e o middleware recusou um `childId`
 * fora da criança delegada; aqui não se repete essa checagem.
 */
export async function assertChildOwned(
  db: Pick<Pool | PoolClient, 'query'>,
  childId: string,
  userId: string,
): Promise<void> {
  const { rows } = await db.query(`SELECT 1 FROM children WHERE id = $1 AND user_id = $2`, [childId, userId]);
  if (rows.length === 0) throw new NotFoundError('Criança', childId);
}
