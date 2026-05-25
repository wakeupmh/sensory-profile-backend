/**
 * Integration tests for M-CHAT-R/F linked follow-up validation in AssessmentService.
 *
 * Tests the service-layer guard block in createAssessment that validates
 * parentAssessmentId linkage rules (added in A7). No real database is needed
 * — all repositories and sub-services are mocked.
 *
 * Rules under test:
 *  1. Non-existent parent → NotFoundError
 *  2. Parent has wrong instrument (not mchat-r) → ValidationError
 *  3. Parent is mchat-r but risk !== 'medio' → ValidationError
 *  4. Valid parent but follow-up uses wrong instrument → ValidationError
 *  5. Valid parent + correct follow-up instrument → no error thrown
 */

// Register all instruments before importing AssessmentService so
// getInstrument() returns real objects for non-legacy scoring paths.
import 'instruments/mchat-r';
import 'instruments/atec';
import 'instruments/mchat-rf-followup';

import { AssessmentService } from 'application/services/AssessmentService';
import { Assessment } from 'domain/entities/Assessment';
import {
  NotFoundError,
  ValidationError,
} from 'infrastructure/utils/errors/CustomErrors';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/** Create a minimal Assessment-like mock with the three methods used by AssessmentService. */
function makeParentAssessment(
  instrumentId: string,
  scoresJson: Record<string, unknown> | null,
): Partial<Assessment> {
  return {
    getInstrumentId: jest.fn(() => instrumentId),
    getScoresJson: jest.fn(() => scoresJson),
    getUserId: jest.fn(() => 'user-001'),
    getChildId: jest.fn(() => null),
  };
}

/** A child payload that satisfies AssessmentService (id path avoids DB look-up via pool). */
const CHILD_PAYLOAD = {
  // Providing an id triggers an SQL owner-check via pool — not ideal for unit
  // tests, so we use name+birthDate so the childService path runs instead.
  name: 'Test Child',
  birthDate: '2024-01-01',
};

const VALID_PARENT_ID = '018f4e8a-0000-7000-8000-000000000001';
const ZERO_RAW_SCORES = {
  auditoryProcessing: 0,
  visualProcessing: 0,
  tactileProcessing: 0,
  movementProcessing: 0,
  bodyPositionProcessing: 0,
  oralSensitivityProcessing: 0,
  behavioralResponses: 0,
  socialEmotionalResponses: 0,
  attentionResponses: 0,
};

// ---------------------------------------------------------------------------
// Build the service with full mocks
// ---------------------------------------------------------------------------

function makeService(assessmentRepoOverrides: Partial<{
  findById: jest.Mock;
  save: jest.Mock;
  findAll: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  findByChildId: jest.Mock;
}> = {}) {
  const assessmentRepository = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    findById: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
    update: jest.fn().mockImplementation((a) => Promise.resolve(a)),
    delete: jest.fn().mockResolvedValue(undefined),
    findByChildId: jest.fn().mockResolvedValue([]),
    ...assessmentRepoOverrides,
  };

  const responseRepository = {
    findByAssessmentId: jest.fn().mockResolvedValue([]),
    saveMany: jest.fn().mockResolvedValue(undefined),
    replaceByAssessmentId: jest.fn().mockResolvedValue(undefined),
  };

  const childService = {
    findOrCreateChild: jest.fn().mockResolvedValue('child-uuid-001'),
    getChildById: jest.fn().mockResolvedValue(null),
  };

  const examinerService = {
    createExaminer: jest.fn().mockResolvedValue('examiner-uuid-001'),
  };

  const caregiverService = {
    createCaregiver: jest.fn().mockResolvedValue('caregiver-uuid-001'),
  };

  const sectionCommentService = {
    createSectionComments: jest.fn().mockResolvedValue([]),
    getSectionCommentsByAssessmentId: jest.fn().mockResolvedValue([]),
    deleteSectionCommentsByAssessmentId: jest.fn().mockResolvedValue(undefined),
  };

  return new AssessmentService(
    assessmentRepository as any,
    responseRepository as any,
    childService as any,
    examinerService as any,
    caregiverService as any,
    sectionCommentService as any,
  );
}

/** Standard follow-up payload for mchat-rf-followup. */
function followupPayload(overrides: { instrumentId?: string } = {}) {
  return {
    instrumentId: overrides.instrumentId ?? 'mchat-rf-followup',
    child: CHILD_PAYLOAD,
    responses: [{ itemId: 4001, response: 'passou' }],
    rawScores: ZERO_RAW_SCORES,
    sectionComments: [],
    parentAssessmentId: VALID_PARENT_ID,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssessmentService.createAssessment — parentAssessmentId validation', () => {
  const USER_ID = 'user-001';

  // 1. Non-existent parent → NotFoundError
  test('throws NotFoundError when parent assessment does not exist', async () => {
    const service = makeService({
      findById: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  test('NotFoundError message references the parent id', async () => {
    const service = makeService({
      findById: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).rejects.toThrow(VALID_PARENT_ID);
  });

  // 2. Parent has wrong instrument → ValidationError
  test('throws ValidationError when parent instrument is not mchat-r', async () => {
    const parent = makeParentAssessment('atec', { risk: 'medio' });
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).rejects.toThrow(ValidationError);
  });

  test('ValidationError mentions mchat-r requirement when parent is wrong instrument', async () => {
    const parent = makeParentAssessment('atec', { risk: 'medio' });
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).rejects.toThrow(/M-CHAT-R/i);
  });

  // 3. Parent is mchat-r but risk !== 'medio' → ValidationError
  test('throws ValidationError when parent mchat-r has risk "baixo"', async () => {
    const parent = makeParentAssessment('mchat-r', { risk: 'baixo' });
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).rejects.toThrow(ValidationError);
  });

  test('throws ValidationError when parent mchat-r has risk "alto"', async () => {
    const parent = makeParentAssessment('mchat-r', { risk: 'alto' });
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).rejects.toThrow(ValidationError);
  });

  test('throws ValidationError when parent mchat-r has null scores_json', async () => {
    const parent = makeParentAssessment('mchat-r', null);
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).rejects.toThrow(ValidationError);
  });

  test('ValidationError message mentions "médio" / "medio" when risk is wrong', async () => {
    const parent = makeParentAssessment('mchat-r', { risk: 'baixo' });
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).rejects.toThrow(/m[eé]dio/i);
  });

  // 4. Valid parent but wrong follow-up instrument → ValidationError
  test('throws ValidationError when follow-up uses instrument "atec" instead of mchat-rf-followup', async () => {
    const parent = makeParentAssessment('mchat-r', { risk: 'medio' });
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    await expect(
      service.createAssessment(followupPayload({ instrumentId: 'atec' }), USER_ID),
    ).rejects.toThrow(ValidationError);
  });

  test('ValidationError message mentions mchat-rf-followup requirement', async () => {
    const parent = makeParentAssessment('mchat-r', { risk: 'medio' });
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    await expect(
      service.createAssessment(followupPayload({ instrumentId: 'atec' }), USER_ID),
    ).rejects.toThrow(/mchat-rf-followup/i);
  });

  // 5. Valid parent + correct follow-up → no validation error
  test('does NOT throw when parent is mchat-r with medio risk and instrument is mchat-rf-followup', async () => {
    const parent = makeParentAssessment('mchat-r', {
      risk: 'medio',
      failedItemIds: [3001, 3002],
    });
    const service = makeService({
      findById: jest.fn().mockResolvedValue(parent as Assessment),
    });

    // Should resolve without throwing. Any error here would be from downstream
    // (DB save etc.) which are all mocked to succeed.
    await expect(
      service.createAssessment(followupPayload(), USER_ID),
    ).resolves.toBeDefined();
  });
});
