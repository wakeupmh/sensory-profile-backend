import { ScoringStrategy } from '../types';

// Items where answering 'sim' = fail (reverse-scored: items 2, 5, 12 by position)
// Global IDs: 3002, 3005, 3012
const REVERSE_ITEMS = new Set([3002, 3005, 3012]);

export const mchatRStrategy: ScoringStrategy = (responses, _instrument) => {
  const failedItemIds: number[] = [];

  for (const [itemId, response] of responses) {
    const isReverse = REVERSE_ITEMS.has(itemId);
    const fails = isReverse ? response === 'sim' : response === 'nao';
    if (fails) failedItemIds.push(itemId);
  }

  const failCount = failedItemIds.length;
  const risk = failCount <= 2 ? 'baixo' : failCount <= 7 ? 'medio' : 'alto';

  return {
    scores_json: { failCount, failedItemIds, risk },
    rawTotal: failCount,
    classification: risk,
  };
};
