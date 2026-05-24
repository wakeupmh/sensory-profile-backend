import { ScoringStrategy } from '../types';

export const mchatRFFollowupStrategy: ScoringStrategy = (responses, _instrument) => {
  let failCount = 0;
  const perItem: { probeItemId: number; screenItemId: number; result: 'passou' | 'falhou' }[] = [];

  for (const [itemId, response] of responses) {
    const result = response === 'passou' ? 'passou' : 'falhou';
    if (result === 'falhou') failCount++;
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
