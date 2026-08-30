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
 * Classified by (table, column) PAIR, not by table name. A table-level
 * classification hides exactly the bug this file exists to catch: it was
 * possible to write "`professionals` is erased" and have that be true for
 * `owner_user_id` (a real `DELETE`) while `accepted_user_id` on the SAME
 * table was only ever neutralised (`UPDATE ... SET accepted_user_id =
 * NULL`) — a different mechanism, with a different meaning, silently folded
 * into one Set entry. The care-team work makes this concrete: a table can
 * cascade away correctly for its OWNER column while its AUTHOR column (the
 * professional who wrote a row on someone else's child) is reachable by
 * neither the delete nor the cascade, because the professional owns none of
 * the rows their `sub` is stamped on. Two columns, two different erasure
 * stories, one table — pairs are the only granularity that can say so.
 *
 * Requires a real database (same as the other *.int.test.ts files that touch
 * Postgres); CI provides one.
 */

import pool from 'infrastructure/database/connection';
import { AUTHOR_ATTRIBUTED_TABLES } from 'application/services/AccountErasureService';

/** Columns that identify a user. Erasure has to account for every table carrying one. */
const USER_COLUMNS = [
  'user_id',
  'owner_user_id',
  'actor_user_id',
  'author_user_id',
  'caregiver_user_id',
  'granted_by_user_id',
  'accepted_user_id',
  'member_user_id',
];

/** Deleted by name — either in ACCOUNT_SCOPED_DELETES, or explicitly inside eraseAccount's transaction. */
const ERASED_DIRECTLY = new Set([
  'children.user_id',
  'sensory_assessments.user_id',
  'anamneses.user_id',
  'professionals.owner_user_id',
  'form_drafts.user_id',
  'reminder_notifications.user_id',
  'caregiver_shares.caregiver_user_id',
  'push_subscriptions.user_id',
  'therapists.user_id',
  'examiners.user_id',
  'caregivers.user_id',
  'voice_notes.user_id',
  'user_profiles.user_id',
]);

/**
 * Removed automatically by `ON DELETE CASCADE` when their parent goes. The
 * parent is noted so the chain is auditable by eye.
 *
 * Only valid when the column's value is ALWAYS the same person as whoever
 * owns the ancestor being erased — `caregiver_shares.owner_user_id` and
 * `care_team_members.granted_by_user_id` both hold, by construction, "the
 * child's owner" and nothing else. A column that can hold someone ELSE'S
 * `sub` (an author, an actor, a member) cannot be classified here even on a
 * table that cascades fine for its owner column — see NEUTRALISED_ON_ERASURE
 * and INTENTIONALLY_RETAINED below for those.
 */
const ERASED_BY_CASCADE = new Map([
  ['ai_summaries.user_id', 'children'],
  ['anamnese_shares.granted_by_user_id', 'anamneses / professionals'],
  ['assessment_shares.granted_by_user_id', 'sensory_assessments / professionals'],
  ['caregiver_shares.owner_user_id', 'children'],
  ['care_team_members.granted_by_user_id', 'children'],
  ['child_shares.granted_by_user_id', 'children'],
  ['communication_logs.user_id', 'children'],
  ['comorbidities.user_id', 'children'],
  ['daily_logs.user_id', 'children'],
  ['daily_reports.user_id', 'children'],
  ['developmental_milestones.user_id', 'children'],
  ['documents.user_id', 'children'],
  ['education_plans.user_id', 'children'],
  ['goals.user_id', 'children'],
  ['goal_progress_entries.user_id', 'goals -> children'],
  ['medical_appointments.user_id', 'children'],
  ['medications.user_id', 'children'],
  ['reminders.user_id', 'children'],
  ['report_shares.user_id', 'children'],
  ['school_communications.user_id', 'children'],
  ['therapy_sessions.user_id', 'children'],
]);

/**
 * The row is NOT deleted — it belongs to someone else who has every right to
 * keep it — but the column is set to NULL so it stops naming the person who
 * asked to be erased. This is the bucket the care-team gap lives in: a
 * professional's `author_user_id` on a family's daily log, or their
 * `member_user_id` on a care-team grant, are exactly this shape — a `sub`
 * recorded on a row that isn't theirs.
 *
 * Driven off `AUTHOR_ATTRIBUTED_TABLES` (the same constant
 * `AccountErasureService` loops over to build the `UPDATE ... SET
 * author_user_id = NULL` pass) so this list and the service's actual
 * behaviour cannot drift apart the way the old table-level list did.
 */
const NEUTRALISED_ON_ERASURE = new Map<string, string>([
  [
    'professionals.accepted_user_id',
    'the row belongs to whoever invited this person (owner_user_id); UPDATE professionals SET accepted_user_id = NULL WHERE accepted_user_id = $1 in eraseAccount',
  ],
  [
    'care_team_members.member_user_id',
    "the row belongs to the child's responsável, who granted the access; eraseAccount nulls member_user_id and marks revoked_at for this member (guarded — the table's existence is checked via information_schema at runtime)",
  ],
  ...AUTHOR_ATTRIBUTED_TABLES.map(
    (table) =>
      [
        `${table}.author_user_id`,
        `optional author (migration 036) — a professional writing under a care-team grant does not own this row; eraseAccount nulls author_user_id for every table in AUTHOR_ATTRIBUTED_TABLES`,
      ] as const,
  ),
]);

/**
 * Deliberately NOT erased or neutralised, with the reason. Keeps this test
 * from becoming a rubber stamp — a pair only belongs here when leaving it
 * alone was a decision, not an oversight.
 *
 * Both entries below are the SAME LGPD gap the care-team work fixes for
 * `author_user_id` (a non-owner's `sub` surviving on someone else's row
 * after they erase their account), on two tables this phase doesn't own:
 *
 *  - `access_logs.actor_user_id` is stamped for every read/write, including
 *    a professional's access to a child they don't own (see
 *    `delegationMiddleware.ts` / `AccessLogService`). When the OWNER erases,
 *    the cascade from `children` takes every access_logs row for their
 *    children regardless of actor — that direction is fine. When the
 *    PROFESSIONAL erases, none of that fires, because they own no such
 *    child, and nothing here nulls their `actor_user_id` on someone else's
 *    audit trail.
 *  - `professional_notes.author_user_id` has the identical shape, but the
 *    column is NOT NULL (migration 024) and IS the note — there is no
 *    "neutralise" for a note whose entire content is "what this professional
 *    wrote", only "delete the note" or "relax the constraint", and deciding
 *    between those isn't something this phase should do as a side effect of
 *    a guard test.
 *
 * Both predate care-team phase 1 (they're the older `professionals` /
 * `child_shares` sharing feature) and are out of this phase's scope — but a
 * real gap classified honestly here is worth more than one classified away
 * by a cascade that doesn't actually reach it. Follow-up, not silence.
 */
const INTENTIONALLY_RETAINED = new Map<string, string>([
  [
    'access_logs.actor_user_id',
    'known gap, pre-existing (professionals/child_shares sharing, not care-team phase 1): a professional erasing their account does not clear actor_user_id on audit rows for children they do not own. Same shape as the author_user_id fix in this PR; not fixed here — see comment above.',
  ],
  [
    'professional_notes.author_user_id',
    'known gap, pre-existing: NOT NULL (migration 024) and the note IS the authorship, so it cannot be neutralised like the optional author_user_id columns (migration 036) without either deleting the note or relaxing the constraint — a decision out of scope for this phase. See comment above.',
  ],
]);

describe('account erasure coverage (LGPD Art. 18 VI)', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('every (table, column) user-identifying pair is classified as erased, cascaded, neutralised, or deliberately retained', async () => {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT DISTINCT c.table_name, c.column_name
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.column_name = ANY($1)
        ORDER BY c.table_name, c.column_name`,
      [USER_COLUMNS],
    );

    expect(rows.length).toBeGreaterThan(0); // guard against a silently empty schema

    const pairs = [...new Set(rows.map((r) => `${r.table_name}.${r.column_name}`))];
    const unclassified = pairs.filter(
      (pair) =>
        !ERASED_DIRECTLY.has(pair) &&
        !ERASED_BY_CASCADE.has(pair) &&
        !NEUTRALISED_ON_ERASURE.has(pair) &&
        !INTENTIONALLY_RETAINED.has(pair),
    );

    expect(unclassified).toEqual([]);
  });

  test('every pair listed as erased, neutralised, or retained still exists in the schema', async () => {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'`,
    );
    const existing = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));

    const allClassified = [
      ...ERASED_DIRECTLY,
      ...ERASED_BY_CASCADE.keys(),
      ...NEUTRALISED_ON_ERASURE.keys(),
      ...INTENTIONALLY_RETAINED.keys(),
    ];
    const stale = allClassified.filter((pair) => !existing.has(pair));

    expect(stale).toEqual([]);
  });
});
