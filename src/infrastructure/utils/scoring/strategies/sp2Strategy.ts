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
  sectionMap,
  quadrantMap,
} from '../scoringService';



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
