/**
 * Unit tests for searchQuerySchema.
 *
 *  1. a valid query passes
 *  2. missing q fails
 *  3. empty string fails
 *  4. a single character fails (below the 2-char minimum)
 *  5. surrounding whitespace is trimmed
 *  6. a query over 200 characters fails
 */

import { searchQuerySchema } from '../searchValidation';

describe('searchQuerySchema', () => {
  test('a valid query passes', () => {
    const result = searchQuerySchema.safeParse({ q: 'febre' });
    expect(result.success).toBe(true);
  });

  test('missing q fails', () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('empty string fails', () => {
    const result = searchQuerySchema.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });

  test('a single character fails (below the 2-char minimum)', () => {
    const result = searchQuerySchema.safeParse({ q: 'a' });
    expect(result.success).toBe(false);
  });

  test('surrounding whitespace is trimmed', () => {
    const result = searchQuerySchema.safeParse({ q: '  febre  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.q).toBe('febre');
  });

  test('a query over 200 characters fails', () => {
    const result = searchQuerySchema.safeParse({ q: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });
});
