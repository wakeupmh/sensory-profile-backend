/**
 * SP-2 (Perfil Sensorial 2) scoring strategy.
 *
 * Implements ScoringStrategy for the 86-item Portuguese Sensory Profile 2
 * instrument (children 3–14 years). Covers 9 sections and 4 Dunn-model
 * quadrants; items 15 and 86 are excluded from raw totals.
 */

import { ScoringStrategy, ScoringResult, Instrument } from '../../../../instruments/types';
import {
  SectionScores,
  QuadrantScores,
  mapResponseToValue,
  validateItemId,
  isExcludedFromScoring,
} from '../scoringService';

// Re-export helpers so callers that currently import them from scoringService
// can also import from here if desired.
export { mapResponseToValue, validateItemId, isExcludedFromScoring };

// Complete item-to-section mapping for Sensory Profile 2 (86 items total)
const sectionMap: Record<number, keyof SectionScores> = {
  // Processamento AUDITIVO (items 1-8)
  1: 'auditoryProcessing', 2: 'auditoryProcessing', 3: 'auditoryProcessing',
  4: 'auditoryProcessing', 5: 'auditoryProcessing', 6: 'auditoryProcessing',
  7: 'auditoryProcessing', 8: 'auditoryProcessing',

  // Processamento VISUAL (items 9-15) — item 15 excluded from raw score
  9: 'visualProcessing', 10: 'visualProcessing', 11: 'visualProcessing',
  12: 'visualProcessing', 13: 'visualProcessing', 14: 'visualProcessing',

  // Processamento do TATO (items 16-26)
  16: 'tactileProcessing', 17: 'tactileProcessing', 18: 'tactileProcessing',
  19: 'tactileProcessing', 20: 'tactileProcessing', 21: 'tactileProcessing',
  22: 'tactileProcessing', 23: 'tactileProcessing', 24: 'tactileProcessing',
  25: 'tactileProcessing', 26: 'tactileProcessing',

  // Processamento de MOVIMENTOS (items 27-34)
  27: 'movementProcessing', 28: 'movementProcessing', 29: 'movementProcessing',
  30: 'movementProcessing', 31: 'movementProcessing', 32: 'movementProcessing',
  33: 'movementProcessing', 34: 'movementProcessing',

  // Processamento da POSIÇÃO DO CORPO (items 35-42)
  35: 'bodyPositionProcessing', 36: 'bodyPositionProcessing', 37: 'bodyPositionProcessing',
  38: 'bodyPositionProcessing', 39: 'bodyPositionProcessing', 40: 'bodyPositionProcessing',
  41: 'bodyPositionProcessing', 42: 'bodyPositionProcessing',

  // Processamento de SENSIBILIDADE ORAL (items 43-52)
  43: 'oralSensitivityProcessing', 44: 'oralSensitivityProcessing', 45: 'oralSensitivityProcessing',
  46: 'oralSensitivityProcessing', 47: 'oralSensitivityProcessing', 48: 'oralSensitivityProcessing',
  49: 'oralSensitivityProcessing', 50: 'oralSensitivityProcessing', 51: 'oralSensitivityProcessing',
  52: 'oralSensitivityProcessing',

  // CONDUTA associada ao processamento sensorial (items 53-61)
  53: 'behavioralResponses', 54: 'behavioralResponses', 55: 'behavioralResponses',
  56: 'behavioralResponses', 57: 'behavioralResponses', 58: 'behavioralResponses',
  59: 'behavioralResponses', 60: 'behavioralResponses', 61: 'behavioralResponses',

  // Respostas SOCIOEMOCIONAIS (items 62-75)
  62: 'socialEmotionalResponses', 63: 'socialEmotionalResponses', 64: 'socialEmotionalResponses',
  65: 'socialEmotionalResponses', 66: 'socialEmotionalResponses', 67: 'socialEmotionalResponses',
  68: 'socialEmotionalResponses', 69: 'socialEmotionalResponses', 70: 'socialEmotionalResponses',
  71: 'socialEmotionalResponses', 72: 'socialEmotionalResponses', 73: 'socialEmotionalResponses',
  74: 'socialEmotionalResponses', 75: 'socialEmotionalResponses',

  // Respostas de ATENÇÃO (items 76-86) — item 86 excluded from raw score
  76: 'attentionResponses', 77: 'attentionResponses', 78: 'attentionResponses',
  79: 'attentionResponses', 80: 'attentionResponses', 81: 'attentionResponses',
  82: 'attentionResponses', 83: 'attentionResponses', 84: 'attentionResponses',
  85: 'attentionResponses',
};

// Quadrant mapping based on official Sensory Profile 2 form color coding
// EX = Exploração (orange) = Sensory Seeking
// EV = Esquiva (blue) = Sensory Avoidance
// SN = Sensibilidade (green) = Sensory Sensitivity
// OB = Observação (purple) = Registration Increased
const quadrantMap: Record<number, keyof QuadrantScores> = {
  // EX - Exploração/Sensory Seeking (orange items)
  14: 'sensorySeek', 21: 'sensorySeek', 22: 'sensorySeek', 25: 'sensorySeek',
  27: 'sensorySeek', 28: 'sensorySeek', 30: 'sensorySeek', 31: 'sensorySeek',
  32: 'sensorySeek', 41: 'sensorySeek', 48: 'sensorySeek', 49: 'sensorySeek',
  50: 'sensorySeek', 51: 'sensorySeek', 55: 'sensorySeek', 56: 'sensorySeek',
  60: 'sensorySeek', 82: 'sensorySeek', 83: 'sensorySeek',

  // EV - Esquiva/Sensory Avoidance (blue items)
  1: 'sensoryAvoidance', 2: 'sensoryAvoidance', 5: 'sensoryAvoidance',
  15: 'sensoryAvoidance', 18: 'sensoryAvoidance', 58: 'sensoryAvoidance',
  59: 'sensoryAvoidance', 61: 'sensoryAvoidance', 63: 'sensoryAvoidance',
  64: 'sensoryAvoidance', 65: 'sensoryAvoidance', 66: 'sensoryAvoidance',
  67: 'sensoryAvoidance', 68: 'sensoryAvoidance', 70: 'sensoryAvoidance',
  71: 'sensoryAvoidance', 72: 'sensoryAvoidance', 74: 'sensoryAvoidance',
  75: 'sensoryAvoidance', 81: 'sensoryAvoidance',

  // SN - Sensibilidade/Sensory Sensitivity (green items)
  3: 'sensorySensitivity', 6: 'sensorySensitivity', 9: 'sensorySensitivity',
  13: 'sensorySensitivity', 16: 'sensorySensitivity', 19: 'sensorySensitivity',
  20: 'sensorySensitivity', 44: 'sensorySensitivity', 45: 'sensorySensitivity',
  46: 'sensorySensitivity', 47: 'sensorySensitivity', 52: 'sensorySensitivity',
  69: 'sensorySensitivity', 73: 'sensorySensitivity', 77: 'sensorySensitivity',
  78: 'sensorySensitivity', 84: 'sensorySensitivity',

  // OB - Observação/Registration Increased (purple items)
  8: 'registrationIncreased', 12: 'registrationIncreased', 23: 'registrationIncreased',
  24: 'registrationIncreased', 26: 'registrationIncreased', 33: 'registrationIncreased',
  34: 'registrationIncreased', 35: 'registrationIncreased', 36: 'registrationIncreased',
  37: 'registrationIncreased', 38: 'registrationIncreased', 39: 'registrationIncreased',
  40: 'registrationIncreased', 53: 'registrationIncreased', 54: 'registrationIncreased',
  57: 'registrationIncreased', 62: 'registrationIncreased', 76: 'registrationIncreased',
  79: 'registrationIncreased', 80: 'registrationIncreased', 85: 'registrationIncreased',
  86: 'registrationIncreased',
};

/**
 * SP-2 ScoringStrategy implementation.
 *
 * Accepts responses as a Map<itemId, responseString> (the ScoringStrategy
 * contract) and returns a ScoringResult whose scores_json matches the shape
 * produced by the legacy calculateScores() helper so that no downstream
 * consumers need to change.
 */
export const sp2Strategy: ScoringStrategy = (
  responses: Map<number, string>,
  // instrument arg is part of the contract but SP-2 doesn't need it
  _instrument: Instrument,
): ScoringResult => {
  const sectionScores: SectionScores = {
    auditoryProcessing: 0,
    visualProcessing: 0,
    tactileProcessing: 0,
    movementProcessing: 0,
    bodyPositionProcessing: 0,
    oralSensitivityProcessing: 0,
    behavioralResponses: 0,
    socialEmotionalResponses: 0,
    attentionResponses: 0,
  };

  const quadrantScores: QuadrantScores = {
    registrationIncreased: 0,
    sensorySeek: 0,
    sensorySensitivity: 0,
    sensoryAvoidance: 0,
  };

  const invalidResponses: string[] = [];
  let validCount = 0;

  responses.forEach((responseStr, itemId) => {
    try {
      if (!validateItemId(itemId)) {
        invalidResponses.push(`Invalid item ID: ${itemId}`);
        return;
      }

      const value = mapResponseToValue(responseStr);

      // --- Quadrant scoring (items 15/86 are in quadrantMap even though they
      //     are excluded from section raw-score totals) ---
      const quadrant = quadrantMap[itemId];
      if (quadrant) {
        quadrantScores[quadrant] += value;
      }

      // --- Section / raw scoring ---
      if (!isExcludedFromScoring(itemId)) {
        // Skip "não se aplica" (value === 0) from section totals
        if (value !== 0) {
          const section = sectionMap[itemId];
          if (section) {
            sectionScores[section] += value;
          } else {
            invalidResponses.push(`No section mapping for item ${itemId}`);
          }
        }
      }

      validCount++;
    } catch (error) {
      invalidResponses.push(
        `Item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  });

  const rawTotal = Object.values(sectionScores).reduce((sum, s) => sum + s, 0);

  const perSection: Record<string, number> = { ...sectionScores };

  return {
    scores_json: {
      sectionScores,
      quadrantScores,
      totalItems: responses.size,
      validResponses: validCount,
      invalidResponses,
    },
    rawTotal,
    perSection,
  };
};
