/**
 * Integration tests for DailyReportService — the spoken daily report flow.
 *
 * Exercised against a mock pg Pool plus fake S3/Transcribe/AI collaborators;
 * no real database or AWS credentials required.
 *
 * Covers:
 *  1.  createDraft refuses a child the caller doesn't own
 *  2.  createDraft returns a presigned upload URL and reuses the existing
 *      row's id when re-recording the same day
 *  3.  createDraft deletes the previous recording's objects so nothing is
 *      orphaned in the bucket
 *  4.  startTranscription refuses a report with no audio
 *  5.  get() leaves a still-running job alone
 *  6.  get() finishes a completed job: transcript stored, status ready
 *  7.  a failing structuring step still keeps the transcript
 *  8.  a failed job records the reason
 *  9.  a silent recording is reported as failed rather than empty-ready
 * 10.  extractTranscript tolerates junk
 */

import { Pool } from 'pg';
import { DailyReportService, extractTranscript, sanitizeStructured } from 'application/services/DailyReportService';
import { S3StorageService } from 'infrastructure/storage/S3StorageService';
import { TranscriptionService } from 'infrastructure/transcription/TranscriptionService';
import { AISummaryService } from 'application/services/AISummaryService';

const USER = 'user-1';
const CHILD = '11111111-1111-1111-1111-111111111111';
const REPORT = '22222222-2222-2222-2222-222222222222';

type Row = Record<string, unknown>;

function baseRow(overrides: Row = {}): Row {
  return {
    id: REPORT,
    child_id: CHILD,
    report_date: '2026-08-20',
    status: 'draft',
    transcript: null,
    structured: null,
    error: null,
    audio_storage_key: null,
    audio_expires_at: null,
    transcribe_job_name: null,
    transcript_key: null,
    created_at: new Date('2026-08-20T10:00:00Z'),
    updated_at: new Date('2026-08-20T10:00:00Z'),
    ...overrides,
  };
}

interface PoolConfig {
  childOwned?: boolean;
  previousKeys?: Row[];
  selectRow?: Row | null;
  updatedRow?: Row;
}

function makePool(config: PoolConfig = {}) {
  const { childOwned = true, previousKeys = [], selectRow = null, updatedRow } = config;
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM children')) return Promise.resolve({ rows: childOwned ? [{ '?column?': 1 }] : [] });
    if (sql.includes('SELECT audio_storage_key, transcript_key FROM daily_reports')) {
      return Promise.resolve({ rows: previousKeys });
    }
    if (sql.includes('INSERT INTO daily_reports')) return Promise.resolve({ rows: [{ id: REPORT }] });
    if (sql.includes('SELECT * FROM daily_reports WHERE id')) {
      return Promise.resolve({ rows: selectRow ? [selectRow] : [] });
    }
    if (sql.includes('SELECT * FROM daily_reports WHERE user_id')) {
      return Promise.resolve({ rows: selectRow ? [selectRow] : [] });
    }
    if (sql.startsWith('UPDATE daily_reports') || sql.includes('UPDATE daily_reports')) {
      return Promise.resolve({ rows: [updatedRow ?? baseRow()] });
    }
    if (sql.includes('DELETE FROM daily_reports')) return Promise.resolve({ rows: [], rowCount: 1 });
    throw new Error(`Unexpected query: ${sql}`);
  });
  return { pool: { query } as unknown as Pool, calls };
}

function makeCollaborators(overrides: {
  getObjectText?: jest.Mock;
  getJob?: jest.Mock;
  structureDailyReport?: jest.Mock;
  deleteObject?: jest.Mock;
} = {}) {
  const storage = {
    getUploadUrl: jest.fn().mockResolvedValue('https://s3.example/upload'),
    getDownloadUrl: jest.fn().mockResolvedValue('https://s3.example/download'),
    deleteObject: overrides.deleteObject ?? jest.fn().mockResolvedValue(undefined),
    getObjectText: overrides.getObjectText ?? jest.fn(),
  } as unknown as S3StorageService;

  const transcription = {
    startJob: jest.fn().mockResolvedValue(undefined),
    getJob: overrides.getJob ?? jest.fn(),
    deleteJob: jest.fn().mockResolvedValue(undefined),
  } as unknown as TranscriptionService;

  const ai = {
    structureDailyReport: overrides.structureDailyReport ?? jest.fn(),
  } as unknown as AISummaryService;

  return { storage, transcription, ai };
}

const TRANSCRIBE_OUTPUT = JSON.stringify({
  results: { transcripts: [{ transcript: 'Hoje ele dormiu bem e comeu tudo no almoço.' }] },
});

describe('DailyReportService', () => {
  test('createDraft refuses a child the caller does not own', async () => {
    const { pool } = makePool({ childOwned: false });
    const { storage, transcription, ai } = makeCollaborators();
    const service = new DailyReportService(pool, storage, transcription, ai);

    await expect(service.createDraft(USER, CHILD, '2026-08-20', 'audio/webm')).rejects.toThrow();
  });

  test('createDraft returns an upload URL scoped to the existing report id', async () => {
    const { pool } = makePool({ updatedRow: baseRow({ audio_storage_key: 'k' }) });
    const { storage, transcription, ai } = makeCollaborators();
    const service = new DailyReportService(pool, storage, transcription, ai);

    const { report, uploadUrl } = await service.createDraft(USER, CHILD, '2026-08-20', 'audio/webm');

    expect(uploadUrl).toBe('https://s3.example/upload');
    expect(report.id).toBe(REPORT);
    const [key, contentType] = (storage.getUploadUrl as jest.Mock).mock.calls[0];
    expect(key).toContain(`daily-reports/${USER}/${REPORT}/`);
    expect(contentType).toBe('audio/webm');
  });

  test('createDraft deletes the previous recording so it is not orphaned in the bucket', async () => {
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    const { pool } = makePool({
      previousKeys: [{ audio_storage_key: 'old-audio', transcript_key: 'old-transcript' }],
      updatedRow: baseRow({ audio_storage_key: 'k' }),
    });
    const { storage, transcription, ai } = makeCollaborators({ deleteObject });
    const service = new DailyReportService(pool, storage, transcription, ai);

    await service.createDraft(USER, CHILD, '2026-08-20', 'audio/webm');

    expect(deleteObject).toHaveBeenCalledWith('old-audio');
    expect(deleteObject).toHaveBeenCalledWith('old-transcript');
  });

  test('startTranscription refuses a report with no audio uploaded', async () => {
    const { pool } = makePool({ selectRow: baseRow() });
    const { storage, transcription, ai } = makeCollaborators();
    const service = new DailyReportService(pool, storage, transcription, ai);

    await expect(service.startTranscription(USER, REPORT)).rejects.toThrow(/áudio/i);
    expect(transcription.startJob).not.toHaveBeenCalled();
  });

  test('get() leaves a still-running job alone', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', audio_storage_key: 'k' });
    const { pool } = makePool({ selectRow: row });
    const getJob = jest.fn().mockResolvedValue({ status: 'in-progress' });
    const { storage, transcription, ai } = makeCollaborators({ getJob });
    const service = new DailyReportService(pool, storage, transcription, ai);

    const report = await service.get(USER, REPORT);

    expect(report.status).toBe('transcribing');
    expect(storage.getObjectText).not.toHaveBeenCalled();
  });

  test('get() finishes a completed job: transcript stored and status ready', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', audio_storage_key: 'k' });
    const { pool, calls } = makePool({
      selectRow: row,
      updatedRow: baseRow({ status: 'ready', transcript: 'Hoje ele dormiu bem e comeu tudo no almoço.' }),
    });
    const { storage, transcription, ai } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'completed', outputKey: 'out.json' }),
      getObjectText: jest.fn().mockResolvedValue(TRANSCRIBE_OUTPUT),
      structureDailyReport: jest.fn().mockResolvedValue('```json\n{"summary":"Dia tranquilo"}\n```'),
    });
    const service = new DailyReportService(pool, storage, transcription, ai);

    const report = await service.get(USER, REPORT);

    expect(report.status).toBe('ready');
    const update = calls.find((c) => c.sql.includes("status = 'ready'"));
    expect(update?.params[0]).toBe('Hoje ele dormiu bem e comeu tudo no almoço.');
    // Code fences around the JSON must not cost us the structuring.
    // `suggestedLogs` sai normalizado para lista vazia — o front-end nunca
    // precisa distinguir "sem sugestões" de "campo ausente".
    expect(update?.params[1]).toEqual({ summary: 'Dia tranquilo', suggestedLogs: [] });
  });

  test('a failing structuring step still keeps the transcript', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', audio_storage_key: 'k' });
    const { pool, calls } = makePool({ selectRow: row, updatedRow: baseRow({ status: 'ready' }) });
    const { storage, transcription, ai } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'completed', outputKey: 'out.json' }),
      getObjectText: jest.fn().mockResolvedValue(TRANSCRIBE_OUTPUT),
      structureDailyReport: jest.fn().mockRejectedValue(new Error('bedrock down')),
    });
    const service = new DailyReportService(pool, storage, transcription, ai);

    const report = await service.get(USER, REPORT);

    expect(report.status).toBe('ready');
    const update = calls.find((c) => c.sql.includes("status = 'ready'"));
    expect(update?.params[0]).toBe('Hoje ele dormiu bem e comeu tudo no almoço.');
    expect(update?.params[1]).toBeNull();
  });

  test('a failed job records the reason', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', audio_storage_key: 'k' });
    const { pool, calls } = makePool({ selectRow: row, updatedRow: baseRow({ status: 'failed' }) });
    const { storage, transcription, ai } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'failed', failureReason: 'Unsupported media' }),
    });
    const service = new DailyReportService(pool, storage, transcription, ai);

    const report = await service.get(USER, REPORT);

    expect(report.status).toBe('failed');
    const update = calls.find((c) => c.sql.includes("status = 'failed'"));
    expect(String(update?.params[0])).toContain('Unsupported media');
  });

  test('a silent recording fails instead of producing an empty report', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', audio_storage_key: 'k' });
    const { pool, calls } = makePool({ selectRow: row, updatedRow: baseRow({ status: 'failed' }) });
    const { storage, transcription, ai } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'completed', outputKey: 'out.json' }),
      getObjectText: jest.fn().mockResolvedValue(JSON.stringify({ results: { transcripts: [{ transcript: '  ' }] } })),
    });
    const service = new DailyReportService(pool, storage, transcription, ai);

    const report = await service.get(USER, REPORT);

    expect(report.status).toBe('failed');
    expect(ai.structureDailyReport).not.toHaveBeenCalled();
    expect(calls.some((c) => c.sql.includes("status = 'failed'"))).toBe(true);
  });

  test('extractTranscript tolerates a shape it does not recognize', () => {
    expect(extractTranscript(TRANSCRIBE_OUTPUT)).toBe('Hoje ele dormiu bem e comeu tudo no almoço.');
    expect(extractTranscript('not json at all')).toBe('');
    expect(extractTranscript('{}')).toBe('');
  });
});

describe('sanitizeStructured — a saída do modelo é dado de terceiro, não contrato', () => {
  test('keeps a well-formed payload as-is', () => {
    const result = sanitizeStructured({
      summary: 'Dia tranquilo',
      highlights: ['comeu bem'],
      concerns: [],
      suggestedLogs: [{ logType: 'sleep', notes: 'dormiu cedo', data: { quality: 2 } }],
    });
    expect(result).toEqual({
      summary: 'Dia tranquilo',
      highlights: ['comeu bem'],
      concerns: [],
      suggestedLogs: [{ logType: 'sleep', notes: 'dormiu cedo', data: { quality: 2 } }],
    });
  });

  test('drops a suggestion with an invented logType but keeps the valid ones', () => {
    // Sem isto, a sugestão inválida virava um badge com texto cru e um botão
    // "Salvar registro" que o backend recusa — um beco sem saída na tela.
    const result = sanitizeStructured({
      summary: 'Dia',
      suggestedLogs: [
        { logType: 'humor_geral' },
        { logType: 'mood', data: { level: 4 } },
      ],
    });
    expect(result?.suggestedLogs).toEqual([{ logType: 'mood', data: { level: 4 } }]);
  });

  test('normalizes suggestedLogs that came back as something other than a list', () => {
    // O caso que derrubaria a tela: `.map` em não-lista.
    const result = sanitizeStructured({ summary: 'Dia', suggestedLogs: { logType: 'mood' } });
    expect(result).toBeNull();
  });

  test('missing suggestedLogs becomes an empty list, not undefined', () => {
    expect(sanitizeStructured({ summary: 'Só o resumo' })).toEqual({
      summary: 'Só o resumo',
      suggestedLogs: [],
    });
  });

  test('rejects a payload that is not an object at all', () => {
    expect(sanitizeStructured('texto solto')).toBeNull();
    expect(sanitizeStructured(null)).toBeNull();
    expect(sanitizeStructured([1, 2, 3])).toBeNull();
  });

  test('a report whose structuring is malformed still keeps the transcript', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', audio_storage_key: 'k' });
    const { pool, calls } = makePool({ selectRow: row, updatedRow: baseRow({ status: 'ready' }) });
    const { storage, transcription, ai } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'completed', outputKey: 'out.json' }),
      getObjectText: jest.fn().mockResolvedValue(TRANSCRIBE_OUTPUT),
      structureDailyReport: jest.fn().mockResolvedValue('{"suggestedLogs": "isso nao e uma lista"}'),
    });
    const service = new DailyReportService(pool, storage, transcription, ai);

    const report = await service.get(USER, REPORT);

    expect(report.status).toBe('ready');
    const update = calls.find((c) => c.sql.includes("status = 'ready'"));
    expect(update?.params[0]).toBe('Hoje ele dormiu bem e comeu tudo no almoço.');
    expect(update?.params[1]).toBeNull();
  });
});
