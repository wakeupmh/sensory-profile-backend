/**
 * Guard test for LGPD Art. 18 VI (eliminação) coverage.
 *
 * `AccountErasureService.eraseAccount` deletes from a hand-written list of
 * tables. That list rots: `push_subscriptions` was added to the schema by a
 * PR that merged while the erasure PR was open, and nothing caught that the
 * new table held user data nobody was erasing. `therapists`, `examiners` and
 * `caregivers` were missed the same way on the first pass.
 *
 * So instead of trusting the list, this reads the live schema: every table
 * with a user-identifying column must be classified into exactly one bucket
 * below. Add a user-scoped table and this test fails until you say what
 * should happen to it on erasure — which is the whole point.
 *
 * Requires a real database (same as the other *.int.test.ts files that touch
 * Postgres); CI provides one.
 */

import pool from 'infrastructure/database/connection';

/** Columns that identify a user. Erasure has to account for every table carrying one. */
const USER_COLUMNS = [
  'user_id',
  'owner_user_id',
  'actor_user_id',
  'author_user_id',
  'caregiver_user_id',
  'granted_by_user_id',
  'accepted_user_id',
];

/** Deleted by name in ACCOUNT_SCOPED_DELETES (or explicitly, for the first two). */
const ERASED_DIRECTLY = new Set([
  'sensory_assessments',
  'children',
  'anamneses',
  'professionals',
  'form_drafts',
  'reminder_notifications',
  'caregiver_shares',
  'push_subscriptions',
  'therapists',
  'examiners',
  'caregivers',
  'user_profiles',
  'voice_notes',
]);

/**
 * Removed automatically by `ON DELETE CASCADE` when their parent goes. The
 * parent is noted so the chain is auditable by eye.
 */
const ERASED_BY_CASCADE = new Map([
  ['ai_summaries', 'children'],
  ['access_logs', 'children'],
  ['communication_logs', 'children'],
  ['comorbidities', 'children'],
  ['daily_logs', 'children'],
  ['daily_reports', 'children'],
  ['developmental_milestones', 'children'],
  ['documents', 'children'],
  ['education_plans', 'children'],
  ['goals', 'children'],
  ['medical_appointments', 'children'],
  ['medications', 'children'],
  ['professional_notes', 'children'],
  ['reminders', 'children'],
  ['report_shares', 'children'],
  ['school_communications', 'children'],
  ['sensory_assessments', 'children'],
  ['therapy_sessions', 'children'],
  ['child_shares', 'children'],
  ['goal_progress_entries', 'goals -> children'],
  ['anamnese_shares', 'anamneses / professionals'],
  ['assessment_shares', 'sensory_assessments / professionals'],
]);

/** Deliberately kept, with the reason. Keeps this test from becoming a rubber stamp. */
const INTENTIONALLY_RETAINED = new Map<string, string>([
  // (empty today — every user-scoped table is erased or cascades)
]);

describe('account erasure coverage (LGPD Art. 18 VI)', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('every user-scoped table is classified as erased, cascaded, or deliberately retained', async () => {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT DISTINCT c.table_name, c.column_name
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.column_name = ANY($1)
        ORDER BY c.table_name`,
      [USER_COLUMNS],
    );

    expect(rows.length).toBeGreaterThan(0); // guard against a silently empty schema

    const unclassified = [...new Set(rows.map((r) => r.table_name))].filter(
      (table) =>
        !ERASED_DIRECTLY.has(table) &&
        !ERASED_BY_CASCADE.has(table) &&
        !INTENTIONALLY_RETAINED.has(table),
    );

    expect(unclassified).toEqual([]);
  });

  test('every table listed as erased or retained still exists in the schema', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const existing = new Set(rows.map((r) => r.table_name));

    const stale = [...ERASED_DIRECTLY, ...ERASED_BY_CASCADE.keys(), ...INTENTIONALLY_RETAINED.keys()].filter(
      (table) => !existing.has(table),
    );

    expect(stale).toEqual([]);
  });
});
