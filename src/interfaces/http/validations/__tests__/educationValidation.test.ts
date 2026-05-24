/**
 * Unit tests for educationValidation Zod schemas.
 *
 * Tests:
 *  1.  createEducationPlanSchema passes with required fields only
 *  2.  createEducationPlanSchema passes with all optional fields
 *  3.  createEducationPlanSchema rejects missing childId
 *  4.  createEducationPlanSchema rejects missing schoolName
 *  5.  createEducationPlanSchema rejects invalid planType enum
 *  6.  createEducationPlanSchema rejects startDate with invalid format
 *  7.  createEducationPlanSchema rejects invalid UUID for childId
 *  8.  updateEducationPlanSchema accepts empty object (all fields optional)
 *  9.  updateEducationPlanSchema rejects invalid planType enum
 * 10.  updateEducationPlanSchema accepts valid planType update
 * 11.  listEducationPlanFiltersSchema accepts empty object
 * 12.  listEducationPlanFiltersSchema accepts valid childId and planType filters
 * 13.  listEducationPlanFiltersSchema rejects invalid planType
 * 14.  createSchoolCommSchema passes with required fields only
 * 15.  createSchoolCommSchema passes with all optional fields
 * 16.  createSchoolCommSchema rejects missing occurredAt
 * 17.  createSchoolCommSchema rejects missing childId
 * 18.  createSchoolCommSchema rejects invalid commType enum
 * 19.  createSchoolCommSchema rejects invalid UUID for childId
 * 20.  updateSchoolCommSchema accepts empty object (all fields optional)
 * 21.  updateSchoolCommSchema rejects invalid commType enum
 * 22.  updateSchoolCommSchema accepts valid commType update
 * 23.  listSchoolCommFiltersSchema accepts empty object (defaults page=1 limit=20)
 * 24.  listSchoolCommFiltersSchema coerces string page "2" to number 2
 * 25.  listSchoolCommFiltersSchema coerces string limit to number
 * 26.  listSchoolCommFiltersSchema rejects invalid commType
 * 27.  listSchoolCommFiltersSchema accepts valid childId and commType filters
 */

import {
  createEducationPlanSchema,
  updateEducationPlanSchema,
  listEducationPlanFiltersSchema,
  createSchoolCommSchema,
  updateSchoolCommSchema,
  listSchoolCommFiltersSchema,
} from '../educationValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';

const VALID_PLAN_BASE = {
  childId: VALID_CHILD_ID,
  schoolName: 'EMEF São Paulo',
  academicYear: '2024',
  planType: 'pei',
  startDate: '2024-02-01',
} as const;

const VALID_COMM_BASE = {
  childId: VALID_CHILD_ID,
  occurredAt: '2024-06-15T10:00:00Z',
  commType: 'reuniao',
  subject: 'Reunião de acompanhamento',
} as const;

// ---------------------------------------------------------------------------
// createEducationPlanSchema
// ---------------------------------------------------------------------------

describe('createEducationPlanSchema', () => {
  // 1. Required fields only
  test('passes with required fields only', () => {
    const result = createEducationPlanSchema.safeParse(VALID_PLAN_BASE);
    expect(result.success).toBe(true);
  });

  // 2. All optional fields
  test('passes with all optional fields provided', () => {
    const result = createEducationPlanSchema.safeParse({
      ...VALID_PLAN_BASE,
      reviewDate: '2024-06-01',
      endDate: '2024-12-31',
      goals: 'Melhorar comunicação funcional',
      accommodations: 'Tempo extra nas provas',
      notes: 'Revisão semestral necessária',
    });
    expect(result.success).toBe(true);
  });

  // 3. Missing childId
  test('rejects missing childId', () => {
    const { childId: _removed, ...withoutChildId } = VALID_PLAN_BASE;
    const result = createEducationPlanSchema.safeParse(withoutChildId);
    expect(result.success).toBe(false);
  });

  // 4. Missing schoolName
  test('rejects missing schoolName', () => {
    const { schoolName: _removed, ...withoutSchoolName } = VALID_PLAN_BASE;
    const result = createEducationPlanSchema.safeParse(withoutSchoolName);
    expect(result.success).toBe(false);
  });

  // 5. Invalid planType enum
  test('rejects invalid planType enum', () => {
    const result = createEducationPlanSchema.safeParse({
      ...VALID_PLAN_BASE,
      planType: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });

  // 6. Invalid startDate format
  test('rejects startDate with invalid date format', () => {
    const result = createEducationPlanSchema.safeParse({
      ...VALID_PLAN_BASE,
      startDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  // 7. Invalid UUID for childId
  test('rejects invalid UUID for childId', () => {
    const result = createEducationPlanSchema.safeParse({
      ...VALID_PLAN_BASE,
      childId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  test('passes with null reviewDate and endDate', () => {
    const result = createEducationPlanSchema.safeParse({
      ...VALID_PLAN_BASE,
      reviewDate: null,
      endDate: null,
    });
    expect(result.success).toBe(true);
  });

  test('passes with all valid planType values', () => {
    const types = ['pei', 'pei_simplificado', 'adaptacao_curricular', 'plano_aee', 'outro'];
    for (const planType of types) {
      const result = createEducationPlanSchema.safeParse({ ...VALID_PLAN_BASE, planType });
      expect(result.success).toBe(true);
    }
  });

  test('rejects missing startDate', () => {
    const { startDate: _removed, ...withoutStartDate } = VALID_PLAN_BASE;
    const result = createEducationPlanSchema.safeParse(withoutStartDate);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateEducationPlanSchema
// ---------------------------------------------------------------------------

describe('updateEducationPlanSchema', () => {
  // 8. All optional — empty object passes
  test('accepts empty object (all fields optional)', () => {
    const result = updateEducationPlanSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 9. Invalid planType enum
  test('rejects invalid planType enum', () => {
    const result = updateEducationPlanSchema.safeParse({ planType: 'invalid_type' });
    expect(result.success).toBe(false);
  });

  // 10. Valid planType update
  test('accepts valid planType update', () => {
    const result = updateEducationPlanSchema.safeParse({ planType: 'plano_aee' });
    expect(result.success).toBe(true);
  });

  test('accepts partial update with only schoolName', () => {
    const result = updateEducationPlanSchema.safeParse({ schoolName: 'EMEF Nova' });
    expect(result.success).toBe(true);
  });

  test('accepts update with null endDate', () => {
    const result = updateEducationPlanSchema.safeParse({ endDate: null });
    expect(result.success).toBe(true);
  });

  test('rejects invalid date format for reviewDate', () => {
    const result = updateEducationPlanSchema.safeParse({ reviewDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listEducationPlanFiltersSchema
// ---------------------------------------------------------------------------

describe('listEducationPlanFiltersSchema', () => {
  // 11. Empty passes
  test('accepts empty object (all optional)', () => {
    const result = listEducationPlanFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 12. Valid childId + planType
  test('accepts valid childId and planType filters', () => {
    const result = listEducationPlanFiltersSchema.safeParse({
      childId: VALID_CHILD_ID,
      planType: 'pei',
    });
    expect(result.success).toBe(true);
  });

  // 13. Invalid planType
  test('rejects invalid planType value', () => {
    const result = listEducationPlanFiltersSchema.safeParse({ planType: 'unknown' });
    expect(result.success).toBe(false);
  });

  test('accepts valid academicYear filter', () => {
    const result = listEducationPlanFiltersSchema.safeParse({ academicYear: '2024' });
    expect(result.success).toBe(true);
  });

  test('accepts valid childId uuid', () => {
    const result = listEducationPlanFiltersSchema.safeParse({ childId: VALID_CHILD_ID });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createSchoolCommSchema
// ---------------------------------------------------------------------------

describe('createSchoolCommSchema', () => {
  // 14. Required fields only
  test('passes with required fields only', () => {
    const result = createSchoolCommSchema.safeParse(VALID_COMM_BASE);
    expect(result.success).toBe(true);
  });

  // 15. All optional fields
  test('passes with all optional fields provided', () => {
    const result = createSchoolCommSchema.safeParse({
      ...VALID_COMM_BASE,
      description: 'Discussão sobre adaptações curriculares',
      attendees: 'Professora Ana, Terapeuta Bruno',
      followUpDate: '2024-07-15',
      notes: 'Retornar em 30 dias',
    });
    expect(result.success).toBe(true);
  });

  // 16. Missing occurredAt
  test('rejects missing occurredAt', () => {
    const { occurredAt: _removed, ...withoutOccurredAt } = VALID_COMM_BASE;
    const result = createSchoolCommSchema.safeParse(withoutOccurredAt);
    expect(result.success).toBe(false);
  });

  // 17. Missing childId
  test('rejects missing childId', () => {
    const { childId: _removed, ...withoutChildId } = VALID_COMM_BASE;
    const result = createSchoolCommSchema.safeParse(withoutChildId);
    expect(result.success).toBe(false);
  });

  // 18. Invalid commType enum
  test('rejects invalid commType enum', () => {
    const result = createSchoolCommSchema.safeParse({
      ...VALID_COMM_BASE,
      commType: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });

  // 19. Invalid UUID for childId
  test('rejects invalid UUID for childId', () => {
    const result = createSchoolCommSchema.safeParse({
      ...VALID_COMM_BASE,
      childId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  test('passes with null description and followUpDate', () => {
    const result = createSchoolCommSchema.safeParse({
      ...VALID_COMM_BASE,
      description: null,
      followUpDate: null,
    });
    expect(result.success).toBe(true);
  });

  test('passes with all valid commType values', () => {
    const types = ['reuniao', 'bilhete', 'email', 'telefone', 'incidente', 'relatorio', 'outro'];
    for (const commType of types) {
      const result = createSchoolCommSchema.safeParse({ ...VALID_COMM_BASE, commType });
      expect(result.success).toBe(true);
    }
  });

  test('rejects missing subject', () => {
    const { subject: _removed, ...withoutSubject } = VALID_COMM_BASE;
    const result = createSchoolCommSchema.safeParse(withoutSubject);
    expect(result.success).toBe(false);
  });

  test('rejects invalid followUpDate format', () => {
    const result = createSchoolCommSchema.safeParse({
      ...VALID_COMM_BASE,
      followUpDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateSchoolCommSchema
// ---------------------------------------------------------------------------

describe('updateSchoolCommSchema', () => {
  // 20. All optional — empty object passes
  test('accepts empty object (all fields optional)', () => {
    const result = updateSchoolCommSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 21. Invalid commType enum
  test('rejects invalid commType enum', () => {
    const result = updateSchoolCommSchema.safeParse({ commType: 'invalid_type' });
    expect(result.success).toBe(false);
  });

  // 22. Valid commType update
  test('accepts valid commType update', () => {
    const result = updateSchoolCommSchema.safeParse({ commType: 'email' });
    expect(result.success).toBe(true);
  });

  test('accepts partial update with only subject', () => {
    const result = updateSchoolCommSchema.safeParse({ subject: 'Nova reunião marcada' });
    expect(result.success).toBe(true);
  });

  test('accepts update with null followUpDate', () => {
    const result = updateSchoolCommSchema.safeParse({ followUpDate: null });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listSchoolCommFiltersSchema
// ---------------------------------------------------------------------------

describe('listSchoolCommFiltersSchema', () => {
  // 23. Empty passes, defaults page=1 limit=20
  test('accepts empty object and defaults page to 1 and limit to 20', () => {
    const result = listSchoolCommFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  // 24. Page coercion from string "2"
  test('coerces string page "2" to number 2', () => {
    const result = listSchoolCommFiltersSchema.safeParse({ page: '2' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(2);
  });

  // 25. Limit coercion from string
  test('coerces string limit to number', () => {
    const result = listSchoolCommFiltersSchema.safeParse({ limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });

  // 26. Invalid commType
  test('rejects invalid commType', () => {
    const result = listSchoolCommFiltersSchema.safeParse({ commType: 'bad_type' });
    expect(result.success).toBe(false);
  });

  // 27. Valid childId and commType filters
  test('accepts valid childId and commType filters', () => {
    const result = listSchoolCommFiltersSchema.safeParse({
      childId: VALID_CHILD_ID,
      commType: 'reuniao',
    });
    expect(result.success).toBe(true);
  });

  test('accepts from and to datetime filters', () => {
    const result = listSchoolCommFiltersSchema.safeParse({
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });
});
