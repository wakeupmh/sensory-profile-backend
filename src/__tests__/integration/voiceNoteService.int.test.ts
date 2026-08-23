/**
 * Integration tests for VoiceNoteService — o ditado avulso ("falar em vez de
 * digitar") que alimenta qualquer campo de texto do app.
 *
 * Mock pg Pool + colaboradores falsos; sem banco nem credenciais AWS.
 *
 * Covers:
 *  1.  createDraft devolve URL de upload sob o prefixo próprio do ditado
 *  2.  startTranscription recusa um ditado sem áudio
 *  3.  get() não mexe em job ainda rodando
 *  4.  transcrição pronta salva o texto E descarta o áudio (a diferença
 *      central em relação ao relato do dia)
 *  5.  falha do S3 no descarte não transforma um ditado bom em erro
 *  6.  job falhado também descarta o áudio
 *  7.  gravação muda vira `failed`, não um texto vazio
 *  8.  um ditado de outro usuário é invisível
 */

import { Pool } from 'pg';
import { VoiceNoteService } from 'application/services/VoiceNoteService';
import { S3StorageService } from 'infrastructure/storage/S3StorageService';
import { TranscriptionService } from 'infrastructure/transcription/TranscriptionService';

const USER = 'user-1';
const NOTE = '33333333-3333-3333-3333-333333333333';

type Row = Record<string, unknown>;

function baseRow(overrides: Row = {}): Row {
  return {
    id: NOTE,
    status: 'draft',
    transcript: null,
    error: null,
    audio_storage_key: 'voice-notes/user-1/n1/audio.webm',
    transcribe_job_name: null,
    transcript_key: null,
    created_at: new Date('2026-08-23T10:00:00Z'),
    ...overrides,
  };
}

function makePool(config: { selectRow?: Row | null; updatedRow?: Row } = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('INSERT INTO voice_notes')) return Promise.resolve({ rows: [baseRow()] });
    if (sql.includes('SELECT * FROM voice_notes')) {
      return Promise.resolve({ rows: config.selectRow ? [config.selectRow] : [] });
    }
    if (sql.includes('UPDATE voice_notes')) return Promise.resolve({ rows: [config.updatedRow ?? baseRow()] });
    throw new Error(`Unexpected query: ${sql}`);
  });
  return { pool: { query } as unknown as Pool, calls };
}

function makeCollaborators(
  overrides: { getObjectText?: jest.Mock; getJob?: jest.Mock; deleteObject?: jest.Mock } = {},
) {
  const storage = {
    getUploadUrl: jest.fn().mockResolvedValue('https://s3.example/upload'),
    deleteObject: overrides.deleteObject ?? jest.fn().mockResolvedValue(undefined),
    getObjectText: overrides.getObjectText ?? jest.fn(),
  } as unknown as S3StorageService;

  const transcription = {
    startJob: jest.fn().mockResolvedValue(undefined),
    getJob: overrides.getJob ?? jest.fn(),
    deleteJob: jest.fn().mockResolvedValue(undefined),
  } as unknown as TranscriptionService;

  return { storage, transcription };
}

const OUTPUT = JSON.stringify({ results: { transcripts: [{ transcript: 'Dormiu mal, acordou três vezes.' }] } });

/** As deleções do áudio são disparadas sem await (`void`); deixa a microtask rodar. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('VoiceNoteService', () => {
  test('createDraft returns an upload URL under the voice-note prefix', async () => {
    const { pool } = makePool();
    const { storage, transcription } = makeCollaborators();
    const service = new VoiceNoteService(pool, storage, transcription);

    const { uploadUrl } = await service.createDraft(USER, 'audio/webm');

    expect(uploadUrl).toBe('https://s3.example/upload');
    const [key] = (storage.getUploadUrl as jest.Mock).mock.calls[0];
    // Prefixo próprio: permite uma política de bucket distinta da do relato do dia.
    expect(key).toMatch(new RegExp(`^voice-notes/${USER}/`));
  });

  test('startTranscription refuses a note with no audio', async () => {
    const { pool } = makePool({ selectRow: baseRow({ audio_storage_key: null }) });
    const { storage, transcription } = makeCollaborators();
    const service = new VoiceNoteService(pool, storage, transcription);

    await expect(service.startTranscription(USER, NOTE)).rejects.toThrow(/áudio/i);
    expect(transcription.startJob).not.toHaveBeenCalled();
  });

  test('get() leaves a still-running job alone', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1' });
    const { pool } = makePool({ selectRow: row });
    const { storage, transcription } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'in-progress' }),
    });
    const service = new VoiceNoteService(pool, storage, transcription);

    expect((await service.get(USER, NOTE)).status).toBe('transcribing');
    expect(storage.getObjectText).not.toHaveBeenCalled();
  });

  test('a finished transcription saves the text and discards the audio', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', transcript_key: 'out.json' });
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    const { pool, calls } = makePool({
      selectRow: row,
      updatedRow: baseRow({ status: 'ready', transcript: 'Dormiu mal, acordou três vezes.', audio_storage_key: null }),
    });
    const { storage, transcription } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'completed', outputKey: 'out.json' }),
      getObjectText: jest.fn().mockResolvedValue(OUTPUT),
      deleteObject,
    });
    const service = new VoiceNoteService(pool, storage, transcription);

    const note = await service.get(USER, NOTE);
    await flush();

    expect(note.status).toBe('ready');
    expect(note.transcript).toBe('Dormiu mal, acordou três vezes.');
    // O áudio de um ditado é insumo descartável, não registro: some com o texto.
    expect(deleteObject).toHaveBeenCalledWith('voice-notes/user-1/n1/audio.webm');
    const update = calls.find((c) => c.sql.includes("status = 'ready'"));
    expect(update?.sql).toContain('audio_storage_key = NULL');
  });

  test('a failed discard does not turn a good dictation into an error', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', transcript_key: 'out.json' });
    const { pool } = makePool({
      selectRow: row,
      updatedRow: baseRow({ status: 'ready', transcript: 'Dormiu mal, acordou três vezes.' }),
    });
    const { storage, transcription } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'completed', outputKey: 'out.json' }),
      getObjectText: jest.fn().mockResolvedValue(OUTPUT),
      deleteObject: jest.fn().mockRejectedValue(new Error('S3 down')),
    });
    const service = new VoiceNoteService(pool, storage, transcription);

    const note = await service.get(USER, NOTE);
    await flush();

    expect(note.status).toBe('ready');
    expect(note.transcript).toBe('Dormiu mal, acordou três vezes.');
  });

  test('a failed job discards the audio too', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1' });
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    const { pool } = makePool({ selectRow: row, updatedRow: baseRow({ status: 'failed' }) });
    const { storage, transcription } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'failed', failureReason: 'Unsupported media' }),
      deleteObject,
    });
    const service = new VoiceNoteService(pool, storage, transcription);

    const note = await service.get(USER, NOTE);
    await flush();

    expect(note.status).toBe('failed');
    // Sem transcrição o áudio não serve para nada: regravar é questão de segundos.
    expect(deleteObject).toHaveBeenCalled();
  });

  test('a silent recording fails instead of returning empty text', async () => {
    const row = baseRow({ status: 'transcribing', transcribe_job_name: 'job-1', transcript_key: 'out.json' });
    const { pool, calls } = makePool({ selectRow: row, updatedRow: baseRow({ status: 'failed' }) });
    const { storage, transcription } = makeCollaborators({
      getJob: jest.fn().mockResolvedValue({ status: 'completed', outputKey: 'out.json' }),
      getObjectText: jest.fn().mockResolvedValue(JSON.stringify({ results: { transcripts: [{ transcript: ' ' }] } })),
    });
    const service = new VoiceNoteService(pool, storage, transcription);

    expect((await service.get(USER, NOTE)).status).toBe('failed');
    expect(calls.some((c) => c.sql.includes("status = 'failed'"))).toBe(true);
  });

  test("another user's dictation is invisible", async () => {
    const { pool, calls } = makePool({ selectRow: null });
    const { storage, transcription } = makeCollaborators();
    const service = new VoiceNoteService(pool, storage, transcription);

    await expect(service.get(USER, NOTE)).rejects.toThrow();
    // O escopo é do usuário, não só do id.
    expect(calls[0].params).toEqual([NOTE, USER]);
  });
});
