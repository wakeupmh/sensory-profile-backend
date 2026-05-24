/**
 * Unit tests for the SP-2 scoring strategy.
 *
 * Item-to-section mapping (84 scoring items; 15 and 86 are excluded):
 *   auditoryProcessing:        items 1–8        (8 items)
 *   visualProcessing:          items 9–14       (6 items, item 15 excluded)
 *   tactileProcessing:         items 16–26      (11 items)
 *   movementProcessing:        items 27–34      (8 items)
 *   bodyPositionProcessing:    items 35–42      (8 items)
 *   oralSensitivityProcessing: items 43–52      (10 items)
 *   behavioralResponses:       items 53–61      (9 items)
 *   socialEmotionalResponses:  items 62–75      (14 items)
 *   attentionResponses:        items 76–85      (10 items, item 86 excluded)
 *
 * "não se aplica" (0) is NOT added to section totals (skipped).
 */

import { sp2Strategy } from '../sp2Strategy';
import { getInstrument } from '../../../../../instruments';

// Trigger side-effect registration of all instruments
import '../../../../../instruments/mchat-r';
import '../../../../../instruments/atec';
import '../../../../../instruments/mchat-rf-followup';

const instrument = getInstrument('crianca-3-14')!;

/** Build a Map<itemId, response> for all 86 items using the given response string. */
function allItemsMap(response: string): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 1; i <= 86; i++) {
    map.set(i, response);
  }
  return map;
}

describe('sp2Strategy', () => {
  describe('all items "quase sempre" (5) — 84 scoring items × 5 = 420', () => {
    it('rawTotal should be 420', () => {
      const result = sp2Strategy(allItemsMap('quase sempre'), instrument);
      expect(result.rawTotal).toBe(420);
    });

    it('scores_json.sectionScores should sum to 420', () => {
      const result = sp2Strategy(allItemsMap('quase sempre'), instrument);
      const sectionScores = result.scores_json.sectionScores as Record<string, number>;
      const sum = Object.values(sectionScores).reduce((a, b) => a + b, 0);
      expect(sum).toBe(420);
    });

    it('individual section scores should match expected counts × 5', () => {
      const result = sp2Strategy(allItemsMap('quase sempre'), instrument);
      const ss = result.scores_json.sectionScores as Record<string, number>;
      expect(ss.auditoryProcessing).toBe(8 * 5);         // 40
      expect(ss.visualProcessing).toBe(6 * 5);           // 30  (item 15 excluded)
      expect(ss.tactileProcessing).toBe(11 * 5);         // 55
      expect(ss.movementProcessing).toBe(8 * 5);         // 40
      expect(ss.bodyPositionProcessing).toBe(8 * 5);     // 40
      expect(ss.oralSensitivityProcessing).toBe(10 * 5); // 50
      expect(ss.behavioralResponses).toBe(9 * 5);        // 45
      expect(ss.socialEmotionalResponses).toBe(14 * 5);  // 70
      expect(ss.attentionResponses).toBe(10 * 5);        // 50  (item 86 excluded)
    });
  });

  describe('all items "quase nunca" (1) — 84 scoring items × 1 = 84', () => {
    it('rawTotal should be 84', () => {
      const result = sp2Strategy(allItemsMap('quase nunca'), instrument);
      expect(result.rawTotal).toBe(84);
    });

    it('individual section scores should match expected counts × 1', () => {
      const result = sp2Strategy(allItemsMap('quase nunca'), instrument);
      const ss = result.scores_json.sectionScores as Record<string, number>;
      expect(ss.auditoryProcessing).toBe(8);
      expect(ss.visualProcessing).toBe(6);
      expect(ss.tactileProcessing).toBe(11);
      expect(ss.movementProcessing).toBe(8);
      expect(ss.bodyPositionProcessing).toBe(8);
      expect(ss.oralSensitivityProcessing).toBe(10);
      expect(ss.behavioralResponses).toBe(9);
      expect(ss.socialEmotionalResponses).toBe(14);
      expect(ss.attentionResponses).toBe(10);
    });
  });

  describe('"não se aplica" (0) is skipped from section totals', () => {
    it('one auditoryProcessing item set to "não se aplica" reduces that section score', () => {
      // Set all to "quase sempre" (5), override item 1 (auditory) with "não se aplica"
      const responses = allItemsMap('quase sempre');
      responses.set(1, 'não se aplica');

      const result = sp2Strategy(responses, instrument);
      const ss = result.scores_json.sectionScores as Record<string, number>;

      // auditoryProcessing: 7 items × 5 = 35 (not 40)
      expect(ss.auditoryProcessing).toBe(35);
      // total: 420 - 5 = 415
      expect(result.rawTotal).toBe(415);
    });

    it('all "não se aplica" → all section scores are 0 and rawTotal is 0', () => {
      const result = sp2Strategy(allItemsMap('não se aplica'), instrument);
      const ss = result.scores_json.sectionScores as Record<string, number>;
      for (const value of Object.values(ss)) {
        expect(value).toBe(0);
      }
      expect(result.rawTotal).toBe(0);
    });
  });

  describe('items 15 and 86 excluded from raw total', () => {
    it('submitting items 15 and 86 as "quase sempre" must not change rawTotal vs not submitting them', () => {
      // Map with all 86 items = "quase nunca"
      const withExcluded = allItemsMap('quase nunca');
      // Override excluded items with max value — should make NO difference
      withExcluded.set(15, 'quase sempre');
      withExcluded.set(86, 'quase sempre');

      const result = sp2Strategy(withExcluded, instrument);
      // Still 84 scoring items × 1 = 84
      expect(result.rawTotal).toBe(84);
    });

    it('items 15 and 86 do not appear in section scores regardless of response', () => {
      const responses = allItemsMap('quase nunca');
      responses.set(15, 'quase sempre');
      responses.set(86, 'quase sempre');

      const result = sp2Strategy(responses, instrument);
      const ss = result.scores_json.sectionScores as Record<string, number>;

      // visualProcessing covers 9–14 (not 15); still 6 items × 1 = 6
      expect(ss.visualProcessing).toBe(6);
      // attentionResponses covers 76–85 (not 86); still 10 items × 1 = 10
      expect(ss.attentionResponses).toBe(10);
    });
  });

  describe('return shape', () => {
    it('scores_json contains sectionScores and quadrantScores keys', () => {
      const result = sp2Strategy(allItemsMap('quase sempre'), instrument);
      expect(result.scores_json).toHaveProperty('sectionScores');
      expect(result.scores_json).toHaveProperty('quadrantScores');
    });

    it('perSection mirrors sectionScores', () => {
      const result = sp2Strategy(allItemsMap('quase sempre'), instrument);
      const ss = result.scores_json.sectionScores as Record<string, number>;
      expect(result.perSection).toEqual(ss);
    });

    it('scores_json.validResponses equals number of mapped responses', () => {
      const result = sp2Strategy(allItemsMap('quase sempre'), instrument);
      expect(result.scores_json.validResponses).toBe(86);
    });
  });
});
