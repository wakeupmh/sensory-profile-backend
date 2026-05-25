/**
 * Unit tests for the M-CHAT-R/F follow-up scoring strategy.
 *
 * Probe items: 4001–4020
 * Screen items: 3001–3020
 * Mapping: screenItemId = probeItemId - 4000 + 3000
 *
 * Risk thresholds (no 'medio' in follow-up):
 *   0–1 falhou → 'baixo'
 *   2+  falhou → 'alto'
 */

import { mchatRFFollowupStrategy } from '../../../../../instruments/mchat-rf-followup/scoring';
import { getInstrument } from '../../../../../instruments';

// Side-effect: register instruments
import '../../../../../instruments/mchat-r';
import '../../../../../instruments/mchat-rf-followup';

const instrument = getInstrument('mchat-rf-followup')!;

/** Build a Map with n probe items (4001..4001+n-1) all set to 'falhou'. */
function allFailMap(itemCount = 5): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 4001; i < 4001 + itemCount; i++) {
    map.set(i, 'falhou');
  }
  return map;
}

/** Build a Map with n probe items (4001..4001+n-1) all set to 'passou'. */
function allPassMap(itemCount = 5): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 4001; i < 4001 + itemCount; i++) {
    map.set(i, 'passou');
  }
  return map;
}

describe('mchatRFFollowupStrategy', () => {
  describe('all items "falhou"', () => {
    it('failCount equals the number of responses', () => {
      const result = mchatRFFollowupStrategy(allFailMap(5), instrument);
      expect((result.scores_json as Record<string, unknown>).failCount).toBe(5);
      expect(result.rawTotal).toBe(5);
    });

    it('finalRisk is "alto" when all 5 items fail (≥2 failures)', () => {
      const result = mchatRFFollowupStrategy(allFailMap(5), instrument);
      expect((result.scores_json as Record<string, unknown>).finalRisk).toBe('alto');
      expect(result.classification).toBe('alto');
    });

    it('perItem array length matches number of responses', () => {
      const result = mchatRFFollowupStrategy(allFailMap(5), instrument);
      const perItem = (result.scores_json as Record<string, unknown>).perItem as unknown[];
      expect(perItem).toHaveLength(5);
    });
  });

  describe('all items "passou"', () => {
    it('failCount is 0', () => {
      const result = mchatRFFollowupStrategy(allPassMap(5), instrument);
      expect((result.scores_json as Record<string, unknown>).failCount).toBe(0);
    });

    it('finalRisk is "baixo"', () => {
      const result = mchatRFFollowupStrategy(allPassMap(5), instrument);
      expect((result.scores_json as Record<string, unknown>).finalRisk).toBe('baixo');
      expect(result.classification).toBe('baixo');
    });

    it('rawTotal is 0', () => {
      const result = mchatRFFollowupStrategy(allPassMap(5), instrument);
      expect(result.rawTotal).toBe(0);
    });
  });

  describe('boundary: 1 "falhou" → "baixo"', () => {
    it('exactly 1 failure is still "baixo"', () => {
      const map = allPassMap(5);
      map.set(4001, 'falhou'); // override one to fail
      const result = mchatRFFollowupStrategy(map, instrument);
      const scores = result.scores_json as Record<string, unknown>;
      expect(scores.failCount).toBe(1);
      expect(scores.finalRisk).toBe('baixo');
    });
  });

  describe('boundary: 2 "falhou" → "alto"', () => {
    it('exactly 2 failures triggers "alto"', () => {
      const map = allPassMap(5);
      map.set(4001, 'falhou');
      map.set(4002, 'falhou');
      const result = mchatRFFollowupStrategy(map, instrument);
      const scores = result.scores_json as Record<string, unknown>;
      expect(scores.failCount).toBe(2);
      expect(scores.finalRisk).toBe('alto');
    });
  });

  describe('perItem mapping: probeItemId → screenItemId', () => {
    it('probe item 4001 maps to screenItemId 3001', () => {
      const map = new Map<number, string>([[4001, 'falhou']]);
      const result = mchatRFFollowupStrategy(map, instrument);
      const perItem = (result.scores_json as Record<string, unknown>).perItem as Array<{
        probeItemId: number;
        screenItemId: number;
        result: string;
      }>;
      expect(perItem).toHaveLength(1);
      expect(perItem[0].probeItemId).toBe(4001);
      expect(perItem[0].screenItemId).toBe(3001);
      expect(perItem[0].result).toBe('falhou');
    });

    it('probe item 4010 maps to screenItemId 3010', () => {
      const map = new Map<number, string>([[4010, 'passou']]);
      const result = mchatRFFollowupStrategy(map, instrument);
      const perItem = (result.scores_json as Record<string, unknown>).perItem as Array<{
        probeItemId: number;
        screenItemId: number;
        result: string;
      }>;
      expect(perItem[0].probeItemId).toBe(4010);
      expect(perItem[0].screenItemId).toBe(3010);
      expect(perItem[0].result).toBe('passou');
    });

    it('probe item 4020 maps to screenItemId 3020', () => {
      const map = new Map<number, string>([[4020, 'falhou']]);
      const result = mchatRFFollowupStrategy(map, instrument);
      const perItem = (result.scores_json as Record<string, unknown>).perItem as Array<{
        probeItemId: number;
        screenItemId: number;
        result: string;
      }>;
      expect(perItem[0].probeItemId).toBe(4020);
      expect(perItem[0].screenItemId).toBe(3020);
    });

    it('perItem result field is "passou" or "falhou" and reflects the input response', () => {
      const map = new Map<number, string>([
        [4001, 'passou'],
        [4002, 'falhou'],
      ]);
      const result = mchatRFFollowupStrategy(map, instrument);
      const perItem = (result.scores_json as Record<string, unknown>).perItem as Array<{
        probeItemId: number;
        screenItemId: number;
        result: string;
      }>;
      const byProbeId = Object.fromEntries(perItem.map((p) => [p.probeItemId, p]));
      expect(byProbeId[4001].result).toBe('passou');
      expect(byProbeId[4002].result).toBe('falhou');
    });

    it('throws on invalid response values (strict matching)', () => {
      const map = new Map<number, string>([
        [4001, 'passou'],
        [4003, 'qualquercoisa'],
      ]);
      expect(() => mchatRFFollowupStrategy(map, instrument)).toThrow(
        /Resposta inválida para M-CHAT-R\/F item 4003/,
      );
    });

    it('throws on empty string response', () => {
      const map = new Map<number, string>([[4001, '']]);
      expect(() => mchatRFFollowupStrategy(map, instrument)).toThrow(
        /Resposta inválida para M-CHAT-R\/F item 4001/,
      );
    });
  });

  describe('no "medio" risk level exists for follow-up', () => {
    it('risk is never "medio" — always "baixo" or "alto"', () => {
      // Test several failure counts to confirm no 'medio' is produced
      for (let failCount = 0; failCount <= 10; failCount++) {
        const map = new Map<number, string>();
        for (let i = 4001; i <= 4001 + failCount - 1; i++) map.set(i, 'falhou');
        for (let i = 4001 + failCount; i <= 4010; i++) map.set(i, 'passou');
        const result = mchatRFFollowupStrategy(map, instrument);
        const risk = (result.scores_json as Record<string, unknown>).finalRisk;
        expect(['baixo', 'alto']).toContain(risk);
      }
    });
  });
});
