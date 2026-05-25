import { ScoringStrategy, ScoringResult } from '../types';

/**
 * ATEC scoring strategy.
 * Each subscale sums the numeric values of responses for its items.
 * The total is the sum of all four subscale scores.
 * Possible totals: Speech (0-42) + Sociability (0-40) + Sensory/Cognitive (0-36) + Health/Behavior (0-75) = max 193.
 */
export const atecStrategy: ScoringStrategy = (responses, instrument): ScoringResult => {
  // Build a numeric lookup from the instrument's scale options
  const numericMap = new Map<string, number>();
  for (const option of instrument.scale.options) {
    numericMap.set(option.value, option.numeric);
  }

  const perSection: Record<string, number> = {};

  for (const section of instrument.sections) {
    let sectionScore = 0;
    for (const itemId of section.itemIds) {
      const responseValue = responses.get(itemId);
      if (responseValue !== undefined && responseValue !== null) {
        const numeric = numericMap.get(responseValue);
        if (numeric === undefined) {
          throw new Error(`Resposta ATEC inválida "${responseValue}" para item ${itemId}`);
        }
        sectionScore += numeric;
      }
    }
    perSection[section.key] = sectionScore;
  }

  const total =
    (perSection['fala'] ?? 0) +
    (perSection['sociabilidade'] ?? 0) +
    (perSection['conscienciaSensorial'] ?? 0) +
    (perSection['saudeComportamento'] ?? 0);

  return {
    scores_json: {
      speech: perSection['fala'] ?? 0,
      sociability: perSection['sociabilidade'] ?? 0,
      sensoryCognitive: perSection['conscienciaSensorial'] ?? 0,
      healthBehavior: perSection['saudeComportamento'] ?? 0,
      total,
    },
    rawTotal: total,
    perSection,
  };
};
