/**
 * Unit tests for the ATEC scoring strategy.
 *
 * Subscale item ranges:
 *   fala (speech):               items 2001–2014  (14 items, scale 0–3)
 *   sociabilidade:               items 2015–2034  (20 items, scale 0–2)
 *   conscienciaSensorial:        items 2035–2052  (18 items, scale 0–2)
 *   saudeComportamento (health): items 2053–2077  (25 items, scale 0–3)
 *
 * Max scores: speech=42, sociability=40, sensoryCognitive=36, healthBehavior=75 → total max=193
 */

import { atecStrategy } from '../../../../../instruments/atec/scoring';
import { getInstrument } from '../../../../../instruments';

// Side-effect: register instruments
import '../../../../../instruments/atec';

const instrument = getInstrument('atec')!;

function makeAtecMap(overrides?: Map<number, string>, defaultVal = '0'): Map<number, string> {
  const map = new Map<number, string>();
  // All 77 items (2001-2077)
  for (let i = 2001; i <= 2077; i++) {
    map.set(i, defaultVal);
  }
  if (overrides) {
    for (const [k, v] of overrides) {
      map.set(k, v);
    }
  }
  return map;
}

describe('atecStrategy', () => {
  describe('subscale 1 — fala (speech, 0–3 scale)', () => {
    it('all "0" → speech = 0', () => {
      const result = atecStrategy(makeAtecMap(), instrument);
      expect((result.scores_json as Record<string, number>).speech).toBe(0);
    });

    it('all "3" → speech = 14 × 3 = 42 (max)', () => {
      const overrides = new Map<number, string>();
      for (let i = 2001; i <= 2014; i++) overrides.set(i, '3');
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      expect((result.scores_json as Record<string, number>).speech).toBe(42);
    });
  });

  describe('subscale 2 — sociabilidade (0–2 scale)', () => {
    it('all "0" → sociability = 0', () => {
      const result = atecStrategy(makeAtecMap(), instrument);
      expect((result.scores_json as Record<string, number>).sociability).toBe(0);
    });

    it('all "2" → sociability = 20 × 2 = 40 (max)', () => {
      const overrides = new Map<number, string>();
      for (let i = 2015; i <= 2034; i++) overrides.set(i, '2');
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      expect((result.scores_json as Record<string, number>).sociability).toBe(40);
    });

    it('all "1" → sociability = 20 × 1 = 20', () => {
      const overrides = new Map<number, string>();
      for (let i = 2015; i <= 2034; i++) overrides.set(i, '1');
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      expect((result.scores_json as Record<string, number>).sociability).toBe(20);
    });
  });

  describe('subscale 3 — conscienciaSensorial (0–2 scale)', () => {
    it('all "2" → sensoryCognitive = 18 × 2 = 36 (max)', () => {
      const overrides = new Map<number, string>();
      for (let i = 2035; i <= 2052; i++) overrides.set(i, '2');
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      expect((result.scores_json as Record<string, number>).sensoryCognitive).toBe(36);
    });
  });

  describe('subscale 4 — saudeComportamento (health/behavior, 0–3 scale)', () => {
    it('all "3" → healthBehavior = 25 × 3 = 75 (max)', () => {
      const overrides = new Map<number, string>();
      for (let i = 2053; i <= 2077; i++) overrides.set(i, '3');
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      expect((result.scores_json as Record<string, number>).healthBehavior).toBe(75);
    });
  });

  describe('total = sum of all four subscales', () => {
    it('all "0" → total = 0', () => {
      const result = atecStrategy(makeAtecMap(), instrument);
      expect((result.scores_json as Record<string, number>).total).toBe(0);
      expect(result.rawTotal).toBe(0);
    });

    it('max everything → total = 42 + 40 + 36 + 75 = 193', () => {
      const overrides = new Map<number, string>();
      for (let i = 2001; i <= 2014; i++) overrides.set(i, '3');
      for (let i = 2015; i <= 2034; i++) overrides.set(i, '2');
      for (let i = 2035; i <= 2052; i++) overrides.set(i, '2');
      for (let i = 2053; i <= 2077; i++) overrides.set(i, '3');
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      expect((result.scores_json as Record<string, number>).total).toBe(193);
      expect(result.rawTotal).toBe(193);
    });
  });

  describe('mixed responses — hand-calculated expected total', () => {
    it('speech items all "1", sociability items all "1", rest "0" → total = 14 + 20 = 34', () => {
      const overrides = new Map<number, string>();
      for (let i = 2001; i <= 2014; i++) overrides.set(i, '1'); // 14 × 1 = 14
      for (let i = 2015; i <= 2034; i++) overrides.set(i, '1'); // 20 × 1 = 20
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      const scores = result.scores_json as Record<string, number>;
      expect(scores.speech).toBe(14);
      expect(scores.sociability).toBe(20);
      expect(scores.sensoryCognitive).toBe(0);
      expect(scores.healthBehavior).toBe(0);
      expect(scores.total).toBe(34);
      expect(result.rawTotal).toBe(34);
    });

    it('partial fills: 3 speech items "2", 5 sociability items "2", 4 sensory items "1", 2 health items "3"', () => {
      // Expected: speech=6, sociability=10, sensoryCognitive=4, healthBehavior=6 → total=26
      const overrides = new Map<number, string>();
      [2001, 2002, 2003].forEach((id) => overrides.set(id, '2'));
      [2015, 2016, 2017, 2018, 2019].forEach((id) => overrides.set(id, '2'));
      [2035, 2036, 2037, 2038].forEach((id) => overrides.set(id, '1'));
      [2053, 2054].forEach((id) => overrides.set(id, '3'));
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      const scores = result.scores_json as Record<string, number>;
      expect(scores.speech).toBe(6);
      expect(scores.sociability).toBe(10);
      expect(scores.sensoryCognitive).toBe(4);
      expect(scores.healthBehavior).toBe(6);
      expect(scores.total).toBe(26);
    });
  });

  describe('perSection mirrors scores_json subscale values', () => {
    it('perSection keys match fala, sociabilidade, conscienciaSensorial, saudeComportamento', () => {
      const result = atecStrategy(makeAtecMap(), instrument);
      expect(result.perSection).toHaveProperty('fala');
      expect(result.perSection).toHaveProperty('sociabilidade');
      expect(result.perSection).toHaveProperty('conscienciaSensorial');
      expect(result.perSection).toHaveProperty('saudeComportamento');
    });

    it('perSection.fala equals scores_json.speech', () => {
      const overrides = new Map<number, string>();
      for (let i = 2001; i <= 2014; i++) overrides.set(i, '2');
      const result = atecStrategy(makeAtecMap(overrides), instrument);
      expect(result.perSection!['fala']).toBe((result.scores_json as Record<string, number>).speech);
    });
  });
});
