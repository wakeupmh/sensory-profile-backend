import { ScoringStrategy } from '../types';
import { ScoringError } from '../../infrastructure/utils/errors/CustomErrors';

// Items where answering 'sim' = fail (reverse-scored: items 2, 5, 12 by position)
// Global IDs: 3002, 3005, 3012
const REVERSE_ITEMS = new Set([3002, 3005, 3012]);

const FIRST_ITEM_ID = 3001;
const ITEM_COUNT = 20;

export const mchatRStrategy: ScoringStrategy = (responses, _instrument) => {
  const failedItemIds: number[] = [];

  // A triagem só vale com os 20 itens respondidos com sim/nao. Item ausente
  // contaria como "passou" e item desconhecido como "falhou", escondendo ou
  // inventando risco — por isso recusamos (400) em vez de classificar.
  const unknown = [...responses.keys()].filter(
    (id) => id < FIRST_ITEM_ID || id >= FIRST_ITEM_ID + ITEM_COUNT,
  );
  if (unknown.length > 0) {
    throw new ScoringError(
      `Itens inválidos para o M-CHAT-R: ${unknown.join(', ')}`,
      unknown.map(String),
    );
  }
  const missing: number[] = [];
  for (let id = FIRST_ITEM_ID; id < FIRST_ITEM_ID + ITEM_COUNT; id++) {
    if (!responses.has(id)) missing.push(id);
  }
  if (missing.length > 0) {
    throw new ScoringError(
      `O M-CHAT-R exige resposta para os ${ITEM_COUNT} itens. Faltam: ${missing.map((id) => id - 3000).join(', ')}`,
      missing.map(String),
    );
  }
  const badValues = [...responses].filter(([, r]) => r !== 'sim' && r !== 'nao');
  if (badValues.length > 0) {
    throw new ScoringError(
      `Resposta inválida no M-CHAT-R (use sim ou nao) nos itens: ${badValues.map(([id]) => id - 3000).join(', ')}`,
      badValues.map(([id]) => String(id)),
    );
  }

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
