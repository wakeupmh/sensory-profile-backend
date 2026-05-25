/**
 * Unit tests for the M-CHAT-R scoring strategy.
 *
 * Items: 3001–3020 (20 items)
 * Reverse-scored items (answering 'sim' = fail): 3002, 3005, 3012
 * Normal items (answering 'nao' = fail): all others
 *
 * Risk thresholds:
 *   0–2 fails  → 'baixo'
 *   3–7 fails  → 'medio'
 *   8–20 fails → 'alto'
 */

import { mchatRStrategy } from '../../../../../instruments/mchat-r/scoring';
import { getInstrument } from '../../../../../instruments';

// Side-effect: register mchat-r instrument
import '../../../../../instruments/mchat-r';

const instrument = getInstrument('mchat-r')!;

const ALL_ITEM_IDS = Array.from({ length: 20 }, (_, i) => 3001 + i);
const REVERSE_ITEM_IDS = [3002, 3005, 3012];
const NORMAL_ITEM_IDS = ALL_ITEM_IDS.filter((id) => !REVERSE_ITEM_IDS.includes(id));

/** Build a pass-all responses map (no items fail). */
function allPassMap(): Map<number, string> {
  const map = new Map<number, string>();
  // Normal items: 'sim' = pass
  for (const id of NORMAL_ITEM_IDS) map.set(id, 'sim');
  // Reverse items: 'nao' = pass
  for (const id of REVERSE_ITEM_IDS) map.set(id, 'nao');
  return map;
}

/** Build a fail-all responses map (all 20 items fail). */
function allFailMap(): Map<number, string> {
  const map = new Map<number, string>();
  // Normal items: 'nao' = fail
  for (const id of NORMAL_ITEM_IDS) map.set(id, 'nao');
  // Reverse items: 'sim' = fail
  for (const id of REVERSE_ITEM_IDS) map.set(id, 'sim');
  return map;
}

describe('mchatRStrategy', () => {
  describe('all items pass → failCount=0, risk="baixo"', () => {
    it('failCount is 0', () => {
      const result = mchatRStrategy(allPassMap(), instrument);
      expect((result.scores_json as Record<string, unknown>).failCount).toBe(0);
    });

    it('risk is "baixo"', () => {
      const result = mchatRStrategy(allPassMap(), instrument);
      expect((result.scores_json as Record<string, unknown>).risk).toBe('baixo');
      expect(result.classification).toBe('baixo');
    });

    it('rawTotal is 0', () => {
      const result = mchatRStrategy(allPassMap(), instrument);
      expect(result.rawTotal).toBe(0);
    });

    it('failedItemIds is empty', () => {
      const result = mchatRStrategy(allPassMap(), instrument);
      expect((result.scores_json as Record<string, unknown>).failedItemIds).toEqual([]);
    });
  });

  describe('all 20 items fail → failCount=20, risk="alto"', () => {
    it('failCount is 20', () => {
      const result = mchatRStrategy(allFailMap(), instrument);
      expect((result.scores_json as Record<string, unknown>).failCount).toBe(20);
    });

    it('risk is "alto"', () => {
      const result = mchatRStrategy(allFailMap(), instrument);
      expect((result.scores_json as Record<string, unknown>).risk).toBe('alto');
      expect(result.classification).toBe('alto');
    });

    it('failedItemIds has all 20 item IDs', () => {
      const result = mchatRStrategy(allFailMap(), instrument);
      const failed = (result.scores_json as Record<string, unknown>).failedItemIds as number[];
      expect(failed).toHaveLength(20);
      expect(new Set(failed)).toEqual(new Set(ALL_ITEM_IDS));
    });
  });

  describe('reverse-item scoring rules', () => {
    it('reverse item 3002: "sim" = fail', () => {
      const map = allPassMap();
      map.set(3002, 'sim'); // override to fail
      const result = mchatRStrategy(map, instrument);
      const failed = (result.scores_json as Record<string, unknown>).failedItemIds as number[];
      expect(failed).toContain(3002);
    });

    it('reverse item 3002: "nao" = pass', () => {
      const map = allPassMap();
      // allPassMap already sets 3002='nao' (pass) — verify it's not in failedItemIds
      const result = mchatRStrategy(map, instrument);
      const failed = (result.scores_json as Record<string, unknown>).failedItemIds as number[];
      expect(failed).not.toContain(3002);
    });

    it('reverse item 3005: "sim" = fail', () => {
      const map = allPassMap();
      map.set(3005, 'sim');
      const result = mchatRStrategy(map, instrument);
      const failed = (result.scores_json as Record<string, unknown>).failedItemIds as number[];
      expect(failed).toContain(3005);
    });

    it('reverse item 3012: "sim" = fail', () => {
      const map = allPassMap();
      map.set(3012, 'sim');
      const result = mchatRStrategy(map, instrument);
      const failed = (result.scores_json as Record<string, unknown>).failedItemIds as number[];
      expect(failed).toContain(3012);
    });

    it('normal item 3001: "nao" = fail', () => {
      const map = allPassMap();
      map.set(3001, 'nao');
      const result = mchatRStrategy(map, instrument);
      const failed = (result.scores_json as Record<string, unknown>).failedItemIds as number[];
      expect(failed).toContain(3001);
    });

    it('normal item 3001: "sim" = pass', () => {
      const map = allPassMap();
      // allPassMap already has 3001='sim' (pass)
      const result = mchatRStrategy(map, instrument);
      const failed = (result.scores_json as Record<string, unknown>).failedItemIds as number[];
      expect(failed).not.toContain(3001);
    });
  });

  describe('exactly 4 items fail → risk="medio", failedItemIds has exactly 4 IDs', () => {
    it('failCount is 4 and risk is "medio"', () => {
      const map = allPassMap();
      // Fail 4 normal items
      map.set(3001, 'nao');
      map.set(3003, 'nao');
      map.set(3004, 'nao');
      map.set(3006, 'nao');
      const result = mchatRStrategy(map, instrument);
      const scores = result.scores_json as Record<string, unknown>;
      expect(scores.failCount).toBe(4);
      expect(scores.risk).toBe('medio');
      const failed = scores.failedItemIds as number[];
      expect(failed).toHaveLength(4);
      expect(new Set(failed)).toEqual(new Set([3001, 3003, 3004, 3006]));
    });
  });

  describe('risk threshold boundaries', () => {
    it('2 fails → "baixo"', () => {
      const map = allPassMap();
      map.set(3001, 'nao');
      map.set(3003, 'nao');
      const result = mchatRStrategy(map, instrument);
      expect((result.scores_json as Record<string, unknown>).risk).toBe('baixo');
    });

    it('3 fails → "medio"', () => {
      const map = allPassMap();
      map.set(3001, 'nao');
      map.set(3003, 'nao');
      map.set(3004, 'nao');
      const result = mchatRStrategy(map, instrument);
      expect((result.scores_json as Record<string, unknown>).risk).toBe('medio');
    });

    it('7 fails → "medio"', () => {
      const map = allPassMap();
      [3001, 3003, 3004, 3006, 3007, 3008, 3009].forEach((id) => map.set(id, 'nao'));
      const result = mchatRStrategy(map, instrument);
      expect((result.scores_json as Record<string, unknown>).risk).toBe('medio');
    });

    it('8 fails → "alto"', () => {
      const map = allPassMap();
      [3001, 3003, 3004, 3006, 3007, 3008, 3009, 3010].forEach((id) => map.set(id, 'nao'));
      const result = mchatRStrategy(map, instrument);
      expect((result.scores_json as Record<string, unknown>).risk).toBe('alto');
    });
  });
});
