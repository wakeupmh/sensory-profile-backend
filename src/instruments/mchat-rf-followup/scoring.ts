import { ScoringStrategy } from '../types';
import { ScoringError } from '../../infrastructure/utils/errors/CustomErrors';

export const mchatRFFollowupStrategy: ScoringStrategy = (responses, _instrument) => {
  let failCount = 0;
  const perItem: { probeItemId: number; screenItemId: number; result: 'passou' | 'falhou' }[] = [];

  for (const [itemId, response] of responses) {
    if (itemId < 4001 || itemId > 4020) {
      throw new ScoringError(
        `Item inválido para o M-CHAT-R/F: ${itemId}`,
        [String(itemId)],
      );
    }
    let result: 'passou' | 'falhou';
    if (response === 'passou') {
      result = 'passou';
    } else if (response === 'falhou') {
      result = 'falhou';
      failCount++;
    } else {
      throw new ScoringError(
        `Resposta inválida para M-CHAT-R/F item ${itemId}: '${response}'`,
        [String(itemId)],
      );
    }
    // Reverse the offset: probe items are 4001-4020, screen items are 3001-3020
    const screenItemId = itemId - 4000 + 3000;
    perItem.push({ probeItemId: itemId, screenItemId, result });
  }

  // Follow-up risk: 0-1 = baixo, 2+ = alto (no 'medio' in follow-up)
  const finalRisk: 'baixo' | 'alto' = failCount <= 1 ? 'baixo' : 'alto';

  return {
    scores_json: { failCount, finalRisk, perItem },
    rawTotal: failCount,
    classification: finalRisk,
  };
};
