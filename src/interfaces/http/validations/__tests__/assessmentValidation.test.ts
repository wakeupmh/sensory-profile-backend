/**
 * Cross-instrument Zod validation tests for createAssessmentSchema.
 *
 * Covers:
 *  1. SP-2 legacy values accepted
 *  2. SP-2 rejects non-SP-2 values (e.g. '0' from ATEC)
 *  3. ATEC values accepted
 *  4. ATEC rejects SP-2 string values
 *  5. M-CHAT-R yes/no accepted
 *  6. Section comments open (non-SP-2 section keys are allowed)
 *  7. parentAssessmentId UUID validation
 *
 * All tests work directly against the exported Zod schema — no running server needed.
 */

// Register all instruments so getInstrument() returns the right objects
import 'instruments/mchat-r';
import 'instruments/atec';
import 'instruments/mchat-rf-followup';

import { createAssessmentSchema } from '../assessmentValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CHILD = {
  name: 'Maria Silva',
  birthDate: '2015-06-15',
};

/** Build a responses array of `count` items starting at `startId`, all with the given value. */
function makeResponses(
  count: number,
  value: string,
  startId = 1,
): Array<{ itemId: number; response: string }> {
  return Array.from({ length: count }, (_, i) => ({
    itemId: startId + i,
    response: value,
  }));
}

/** Parse the schema and return { success, error }. */
function parse(payload: unknown) {
  return createAssessmentSchema.safeParse(payload);
}

// ---------------------------------------------------------------------------
// 1. SP-2 legacy values accepted
// ---------------------------------------------------------------------------

describe('SP-2 (crianca-3-14) — legacy values', () => {
  const SP2_VALUES = [
    'quase sempre',
    'frequentemente',
    'metade do tempo',
    'ocasionalmente',
    'quase nunca',
    'não se aplica',
  ];

  test.each(SP2_VALUES)('response "%s" passes validation', (value) => {
    const result = parse({
      instrumentId: 'crianca-3-14',
      child: VALID_CHILD,
      responses: makeResponses(1, value),
    });
    expect(result.success).toBe(true);
  });

  test('a full set of SP-2 responses passes', () => {
    const result = parse({
      instrumentId: 'crianca-3-14',
      child: VALID_CHILD,
      responses: makeResponses(86, 'frequentemente'),
    });
    expect(result.success).toBe(true);
  });

  test('default instrumentId (no instrumentId field) uses SP-2 validation path', () => {
    // When instrumentId is omitted the schema defaults to 'crianca-3-14'
    const result = parse({
      child: VALID_CHILD,
      responses: makeResponses(1, 'quase sempre'),
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. SP-2 rejects ATEC-style numeric string values
// ---------------------------------------------------------------------------

describe('SP-2 (crianca-3-14) — rejects non-SP-2 values', () => {
  const ATEC_VALUES = ['0', '1', '2', '3'];

  test.each(ATEC_VALUES)('ATEC value "%s" is rejected on SP-2 instrument', (value) => {
    const result = parse({
      instrumentId: 'crianca-3-14',
      child: VALID_CHILD,
      responses: makeResponses(1, value),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/quase sempre|frequentemente|metade do tempo/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. ATEC values accepted
// ---------------------------------------------------------------------------

describe('ATEC — numeric string values accepted', () => {
  const ATEC_VALUES = ['0', '1', '2', '3'];

  test.each(ATEC_VALUES)('response "%s" passes for ATEC instrument', (value) => {
    const result = parse({
      instrumentId: 'atec',
      child: VALID_CHILD,
      responses: makeResponses(1, value, 2001),
    });
    expect(result.success).toBe(true);
  });

  test('mixed 0-3 responses all pass for ATEC', () => {
    const responses = [
      { itemId: 2001, response: '0' },
      { itemId: 2002, response: '1' },
      { itemId: 2003, response: '2' },
      { itemId: 2004, response: '3' },
    ];
    const result = parse({
      instrumentId: 'atec',
      child: VALID_CHILD,
      responses,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3b. ATEC subscale allowedValues enforcement
// ---------------------------------------------------------------------------

describe('ATEC — subscale allowedValues enforcement', () => {
  test('Sociability item (2015) with value "3" is rejected (subscale allows only 0-2)', () => {
    const result = parse({
      instrumentId: 'atec',
      child: VALID_CHILD,
      responses: [{ itemId: 2015, response: '3' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/sociabilidade/i);
      expect(messages).toMatch(/Invalid response value/i);
    }
  });

  test('Sensory/Cognitive Awareness item (2035) with value "3" is rejected', () => {
    const result = parse({
      instrumentId: 'atec',
      child: VALID_CHILD,
      responses: [{ itemId: 2035, response: '3' }],
    });
    expect(result.success).toBe(false);
  });

  test('Sociability item with value "2" still passes', () => {
    const result = parse({
      instrumentId: 'atec',
      child: VALID_CHILD,
      responses: [{ itemId: 2015, response: '2' }],
    });
    expect(result.success).toBe(true);
  });

  test('Speech item (2001) with value "3" still passes (no allowedValues restriction)', () => {
    const result = parse({
      instrumentId: 'atec',
      child: VALID_CHILD,
      responses: [{ itemId: 2001, response: '3' }],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. ATEC rejects SP-2 string values
// ---------------------------------------------------------------------------

describe('ATEC — rejects SP-2 string values', () => {
  const SP2_STRINGS = [
    'quase sempre',
    'frequentemente',
    'metade do tempo',
    'ocasionalmente',
    'quase nunca',
    'não se aplica',
  ];

  test.each(SP2_STRINGS)('SP-2 value "%s" is rejected on ATEC instrument', (value) => {
    const result = parse({
      instrumentId: 'atec',
      child: VALID_CHILD,
      responses: makeResponses(1, value, 2001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/Invalid response value/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. M-CHAT-R yes/no accepted
// ---------------------------------------------------------------------------

describe('M-CHAT-R — sim/nao values accepted', () => {
  test('all "sim" responses pass', () => {
    const result = parse({
      instrumentId: 'mchat-r',
      child: VALID_CHILD,
      responses: makeResponses(20, 'sim', 3001),
    });
    expect(result.success).toBe(true);
  });

  test('all "nao" responses pass', () => {
    const result = parse({
      instrumentId: 'mchat-r',
      child: VALID_CHILD,
      responses: makeResponses(20, 'nao', 3001),
    });
    expect(result.success).toBe(true);
  });

  test('mixed sim/nao responses pass', () => {
    const responses = Array.from({ length: 20 }, (_, i) => ({
      itemId: 3001 + i,
      response: i % 2 === 0 ? 'sim' : 'nao',
    }));
    const result = parse({
      instrumentId: 'mchat-r',
      child: VALID_CHILD,
      responses,
    });
    expect(result.success).toBe(true);
  });

  test('"quase sempre" is rejected on M-CHAT-R', () => {
    const result = parse({
      instrumentId: 'mchat-r',
      child: VALID_CHILD,
      responses: makeResponses(1, 'quase sempre', 3001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5b. M-CHAT-R/F follow-up — strict passou/falhou
// ---------------------------------------------------------------------------

describe('M-CHAT-R/F (mchat-rf-followup) — strict passou/falhou', () => {
  test('"passou" passes', () => {
    const result = parse({
      instrumentId: 'mchat-rf-followup',
      child: VALID_CHILD,
      responses: makeResponses(1, 'passou', 4001),
    });
    expect(result.success).toBe(true);
  });

  test('"falhou" passes', () => {
    const result = parse({
      instrumentId: 'mchat-rf-followup',
      child: VALID_CHILD,
      responses: makeResponses(1, 'falhou', 4001),
    });
    expect(result.success).toBe(true);
  });

  test('typo "passu" is rejected', () => {
    const result = parse({
      instrumentId: 'mchat-rf-followup',
      child: VALID_CHILD,
      responses: makeResponses(1, 'passu', 4001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/Invalid response value/i);
    }
  });

  test('"sim" (M-CHAT-R value) is rejected on follow-up', () => {
    const result = parse({
      instrumentId: 'mchat-rf-followup',
      child: VALID_CHILD,
      responses: makeResponses(1, 'sim', 4001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Section comments — open section keys (non-SP-2 sections allowed)
// ---------------------------------------------------------------------------

describe('sectionComments — open section key accepted for non-SP-2 instruments', () => {
  test('ATEC section key "fala" is accepted', () => {
    const result = parse({
      instrumentId: 'atec',
      child: VALID_CHILD,
      responses: makeResponses(1, '1', 2001),
      sectionComments: [{ section: 'fala', comments: 'Some comment here.' }],
    });
    expect(result.success).toBe(true);
  });

  test('arbitrary section key is accepted (Zod layer is open)', () => {
    const result = parse({
      instrumentId: 'mchat-r',
      child: VALID_CHILD,
      responses: makeResponses(1, 'sim', 3001),
      sectionComments: [{ section: 'triagem', comments: 'Comment.' }],
    });
    expect(result.success).toBe(true);
  });

  test('empty section key is rejected', () => {
    const result = parse({
      instrumentId: 'mchat-r',
      child: VALID_CHILD,
      responses: makeResponses(1, 'sim', 3001),
      sectionComments: [{ section: '', comments: 'Comment.' }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. parentAssessmentId — UUID validation
// ---------------------------------------------------------------------------

describe('parentAssessmentId — UUID validation', () => {
  const VALID_UUID = '018f4e8a-1234-7abc-8def-0123456789ab';

  test('valid UUID is accepted', () => {
    const result = parse({
      instrumentId: 'mchat-rf-followup',
      child: VALID_CHILD,
      responses: makeResponses(1, 'passou', 4001),
      parentAssessmentId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  test('malformed UUID is rejected', () => {
    const result = parse({
      instrumentId: 'mchat-rf-followup',
      child: VALID_CHILD,
      responses: makeResponses(1, 'passou', 4001),
      parentAssessmentId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/UUID/i);
    }
  });

  test('parentAssessmentId is optional — omitting it passes', () => {
    const result = parse({
      instrumentId: 'mchat-rf-followup',
      child: VALID_CHILD,
      responses: makeResponses(1, 'passou', 4001),
    });
    expect(result.success).toBe(true);
  });

  test('empty string parentAssessmentId is rejected', () => {
    const result = parse({
      instrumentId: 'mchat-rf-followup',
      child: VALID_CHILD,
      responses: makeResponses(1, 'passou', 4001),
      parentAssessmentId: '',
    });
    expect(result.success).toBe(false);
  });
});
