/**
 * Unit tests for daily log Zod validation schemas.
 *
 * Covers:
 *  1. createLogSchema — valid logs, invalid logType, missing required fields, notes max length
 *  2. updateLogSchema — partial updates, empty object, invalid logType
 *  3. listFiltersSchema — defaults, string coercion, limit max
 *
 * All tests work directly against the exported Zod schemas — no running server needed.
 */

import {
  createLogSchema,
  updateLogSchema,
  listFiltersSchema,
} from '../dailyLogValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CHILD_ID = '018f4e8a-1234-7abc-8def-0123456789ab';
const VALID_OCCURRED_AT = '2024-06-15T10:30:00.000Z';

function makeCreatePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    childId: VALID_CHILD_ID,
    logType: 'abc',
    occurredAt: VALID_OCCURRED_AT,
    data: { antecedent: 'loud noise', behavior: 'crying', consequence: 'comfort given' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. createLogSchema
// ---------------------------------------------------------------------------

describe('createLogSchema — valid logs', () => {
  test('valid ABC log passes', () => {
    const result = createLogSchema.safeParse(makeCreatePayload());
    expect(result.success).toBe(true);
  });

  test('valid mood log passes', () => {
    const result = createLogSchema.safeParse(
      makeCreatePayload({ logType: 'mood', data: { level: 3 } })
    );
    expect(result.success).toBe(true);
  });

  test('valid sleep log passes', () => {
    const result = createLogSchema.safeParse(
      makeCreatePayload({ logType: 'sleep', data: { quality: 2, wakings: 1 } })
    );
    expect(result.success).toBe(true);
  });

  test('valid food log passes', () => {
    const result = createLogSchema.safeParse(
      makeCreatePayload({ logType: 'food', data: { meal: 'almoco', accepted: ['arroz'] } })
    );
    expect(result.success).toBe(true);
  });

  test('valid toileting log passes', () => {
    const result = createLogSchema.safeParse(
      makeCreatePayload({ logType: 'toileting', data: { type: 'urina', independent: true } })
    );
    expect(result.success).toBe(true);
  });

  test('data defaults to empty object when omitted', () => {
    const payload = makeCreatePayload();
    delete (payload as Record<string, unknown>).data;
    const result = createLogSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual({});
    }
  });

  test('notes is optional — omitting it passes', () => {
    const result = createLogSchema.safeParse(makeCreatePayload());
    expect(result.success).toBe(true);
  });

  test('notes null passes', () => {
    const result = createLogSchema.safeParse(makeCreatePayload({ notes: null }));
    expect(result.success).toBe(true);
  });

  test('notes within 2000 chars passes', () => {
    const result = createLogSchema.safeParse(
      makeCreatePayload({ notes: 'a'.repeat(2000) })
    );
    expect(result.success).toBe(true);
  });
});

describe('createLogSchema — invalid logType', () => {
  test('unknown logType "exercise" is rejected', () => {
    const result = createLogSchema.safeParse(makeCreatePayload({ logType: 'exercise' }));
    expect(result.success).toBe(false);
  });

  test('empty string logType is rejected', () => {
    const result = createLogSchema.safeParse(makeCreatePayload({ logType: '' }));
    expect(result.success).toBe(false);
  });
});

describe('createLogSchema — missing required fields', () => {
  test('missing childId is rejected', () => {
    const payload = makeCreatePayload();
    delete (payload as Record<string, unknown>).childId;
    const result = createLogSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('malformed childId (not a UUID) is rejected', () => {
    const result = createLogSchema.safeParse(makeCreatePayload({ childId: 'not-a-uuid' }));
    expect(result.success).toBe(false);
  });

  test('missing occurredAt is rejected', () => {
    const payload = makeCreatePayload();
    delete (payload as Record<string, unknown>).occurredAt;
    const result = createLogSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('malformed occurredAt (not ISO datetime) is rejected', () => {
    const result = createLogSchema.safeParse(makeCreatePayload({ occurredAt: '15/06/2024' }));
    expect(result.success).toBe(false);
  });

  test('missing logType is rejected', () => {
    const payload = makeCreatePayload();
    delete (payload as Record<string, unknown>).logType;
    const result = createLogSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('createLogSchema — notes max length', () => {
  test('notes over 2000 chars is rejected', () => {
    const result = createLogSchema.safeParse(
      makeCreatePayload({ notes: 'a'.repeat(2001) })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/2000/);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. updateLogSchema
// ---------------------------------------------------------------------------

describe('updateLogSchema — partial updates', () => {
  test('updating only notes passes', () => {
    const result = updateLogSchema.safeParse({ notes: 'Updated note.' });
    expect(result.success).toBe(true);
  });

  test('updating only logType passes', () => {
    const result = updateLogSchema.safeParse({ logType: 'sleep' });
    expect(result.success).toBe(true);
  });

  test('updating only occurredAt passes', () => {
    const result = updateLogSchema.safeParse({ occurredAt: VALID_OCCURRED_AT });
    expect(result.success).toBe(true);
  });

  test('updating only data passes', () => {
    const result = updateLogSchema.safeParse({ data: { level: 4 } });
    expect(result.success).toBe(true);
  });
});

describe('updateLogSchema — empty object is valid (all fields optional)', () => {
  test('empty object passes', () => {
    const result = updateLogSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('updateLogSchema — invalid logType rejected', () => {
  test('unknown logType "meditation" is rejected', () => {
    const result = updateLogSchema.safeParse({ logType: 'meditation' });
    expect(result.success).toBe(false);
  });
});

describe('updateLogSchema — childId is not accepted (omitted via .omit)', () => {
  test('childId field is stripped / not part of schema', () => {
    // The field should either be stripped or cause no validation error since it's unknown;
    // the key constraint is that providing childId does not corrupt data.
    // With Zod default (strip unknown), this passes but childId is removed.
    const result = updateLogSchema.safeParse({ notes: 'ok', childId: VALID_CHILD_ID });
    // Should still succeed — unknown keys are stripped by default
    expect(result.success).toBe(true);
    if (result.success) {
      expect('childId' in result.data).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. listFiltersSchema
// ---------------------------------------------------------------------------

describe('listFiltersSchema — defaults', () => {
  test('empty object yields page=1 and limit=20', () => {
    const result = listFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });
});

describe('listFiltersSchema — coercion', () => {
  test('page coerced from string "3" to number 3', () => {
    const result = listFiltersSchema.safeParse({ page: '3' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
    }
  });

  test('limit coerced from string "50" to number 50', () => {
    const result = listFiltersSchema.safeParse({ limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });
});

describe('listFiltersSchema — limit max=100', () => {
  test('limit 100 passes', () => {
    const result = listFiltersSchema.safeParse({ limit: 100 });
    expect(result.success).toBe(true);
  });

  test('limit 101 is rejected', () => {
    const result = listFiltersSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});

describe('listFiltersSchema — optional filters', () => {
  test('valid childId UUID filter passes', () => {
    const result = listFiltersSchema.safeParse({ childId: VALID_CHILD_ID });
    expect(result.success).toBe(true);
  });

  test('malformed childId UUID is rejected', () => {
    const result = listFiltersSchema.safeParse({ childId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('valid logType filter passes', () => {
    const result = listFiltersSchema.safeParse({ logType: 'mood' });
    expect(result.success).toBe(true);
  });

  test('invalid logType filter is rejected', () => {
    const result = listFiltersSchema.safeParse({ logType: 'unknown' });
    expect(result.success).toBe(false);
  });

  test('valid from/to ISO datetime strings pass', () => {
    const result = listFiltersSchema.safeParse({
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('malformed from date string is rejected', () => {
    const result = listFiltersSchema.safeParse({ from: '01/01/2024' });
    expect(result.success).toBe(false);
  });

  test('page must be positive — zero is rejected', () => {
    const result = listFiltersSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  test('limit must be positive — zero is rejected', () => {
    const result = listFiltersSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });
});
