import { Pool } from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { NotFoundError, ValidationError } from '../../infrastructure/utils/errors/CustomErrors';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService';
import { TranscriptionService } from '../../infrastructure/transcription/TranscriptionService';
import { extractTranscript } from './DailyReportService';
import logger from '../../infrastructure/utils/logger';

export type VoiceNoteStatus = 'draft' | 'transcribing' | 'ready' | 'failed';

export interface VoiceNote {
  id: string;
  status: VoiceNoteStatus;
  transcript: string | null;
  error: string | null;
  createdAt: string;
}

interface VoiceNoteRow {
  id: string;
  status: VoiceNoteStatus;
  transcript: string | null;
  error: string | null;
  audio_storage_key: string | null;
  transcribe_job_name: string | null;
  transcript_key: string | null;
  created_at: Date;
}

function toVoiceNote(row: VoiceNoteRow): VoiceNote {
  return {
    id: row.id,
    status: row.status,
    transcript: row.transcript,
    error: row.error,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Ditado avulso — "falar em vez de digitar" em qualquer campo de texto do app.
 *
 * Mesmo maquinário do relato do dia (upload direto ao S3, job assíncrono do
 * Transcribe, polling do cliente), mas com uma diferença deliberada: aqui o
 * áudio é **apagado assim que o texto sai**. No relato do dia a gravação é o
 * registro e o cuidador pode querer reouvi-la; num ditado ela é insumo
 * descartável, e guardá-la seria acumular a voz da pessoa sem motivo.
 *
 * Não estrutura nada por IA: o campo de destino quer texto, não um relatório.
 */
export class VoiceNoteService {
  constructor(
    private readonly pool: Pool,
    private readonly storage: S3StorageService,
    private readonly transcription: TranscriptionService,
  ) {}

  async createDraft(userId: string, mimeType: string): Promise<{ note: VoiceNote; uploadUrl: string }> {
    const id = uuidv7();
    const extension = mimeType.includes('mp4')
      ? 'mp4'
      : mimeType.includes('mpeg') || mimeType.includes('mp3')
        ? 'mp3'
        : mimeType.includes('ogg')
          ? 'ogg'
          : mimeType.includes('wav')
            ? 'wav'
            : mimeType.includes('flac')
              ? 'flac'
              : 'webm';
    const audioKey = `voice-notes/${userId}/${id}/audio.${extension}`;

    const result = await this.pool.query(
      `INSERT INTO voice_notes (id, user_id, status, audio_storage_key, audio_mime_type)
       VALUES ($1, $2, 'draft', $3, $4) RETURNING *`,
      [id, userId, audioKey, mimeType],
    );

    return {
      note: toVoiceNote(result.rows[0] as VoiceNoteRow),
      uploadUrl: await this.storage.getUploadUrl(audioKey, mimeType),
    };
  }

  async startTranscription(userId: string, noteId: string): Promise<VoiceNote> {
    const row = await this.findRow(userId, noteId);
    if (!row.audio_storage_key) throw new ValidationError('Nenhum áudio foi enviado para este ditado');

    const jobName = `voice-note-${row.id}-${Date.now()}`;
    const transcriptKey = `voice-notes/${userId}/${row.id}/transcript-${Date.now()}.json`;
    await this.transcription.startJob(jobName, row.audio_storage_key, transcriptKey);

    const result = await this.pool.query(
      `UPDATE voice_notes SET status = 'transcribing', transcribe_job_name = $1, transcript_key = $2, error = NULL
        WHERE id = $3 AND user_id = $4 RETURNING *`,
      [jobName, transcriptKey, noteId, userId],
    );
    return toVoiceNote(result.rows[0] as VoiceNoteRow);
  }

  /** Consultado em loop pelo cliente enquanto o status for `transcribing`. */
  async get(userId: string, noteId: string): Promise<VoiceNote> {
    const row = await this.findRow(userId, noteId);
    if (row.status !== 'transcribing' || !row.transcribe_job_name) return toVoiceNote(row);
    return this.advance(row);
  }

  private async advance(row: VoiceNoteRow): Promise<VoiceNote> {
    const job = await this.transcription.getJob(row.transcribe_job_name as string);
    if (job.status === 'in-progress') return toVoiceNote(row);
    if (job.status === 'failed') {
      return this.fail(row, `Transcrição falhou: ${job.failureReason ?? 'motivo desconhecido'}`);
    }

    try {
      const key = job.outputKey ?? row.transcript_key;
      if (!key) throw new Error('Transcrição concluída sem arquivo de saída');

      const transcript = extractTranscript(await this.storage.getObjectText(key));
      if (!transcript.trim()) {
        return this.fail(row, 'A gravação não produziu nenhum texto — o áudio pode estar mudo ou muito curto.');
      }

      const result = await this.pool.query(
        `UPDATE voice_notes
            SET status = 'ready', transcript = $1, error = NULL,
                audio_storage_key = NULL, audio_mime_type = NULL, transcript_key = NULL
          WHERE id = $2 RETURNING *`,
        [transcript, row.id],
      );
      // Depois do UPDATE, e best-effort: o texto já está salvo, e uma falha do
      // S3 não deve transformar um ditado bem-sucedido em erro para o usuário.
      // A limpeza de abandonados varre o que sobrar.
      void this.discardAudio(row);
      void this.transcription.deleteJob(row.transcribe_job_name as string);
      return toVoiceNote(result.rows[0] as VoiceNoteRow);
    } catch (e) {
      return this.fail(row, e instanceof Error ? e.message : String(e));
    }
  }

  private async discardAudio(row: VoiceNoteRow): Promise<void> {
    const keys = [row.audio_storage_key, row.transcript_key].filter((k): k is string => k !== null);
    for (const key of keys) {
      try {
        await this.storage.deleteObject(key);
      } catch (e) {
        logger.warn('[VoiceNoteService] failed to discard voice note audio', {
          noteId: row.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  private async fail(row: VoiceNoteRow, message: string): Promise<VoiceNote> {
    const result = await this.pool.query(
      `UPDATE voice_notes SET status = 'failed', error = $1 WHERE id = $2 RETURNING *`,
      [message, row.id],
    );
    // Mesmo no erro o áudio vai embora: sem transcrição ele não serve para
    // nada, e reprocessar é regravar (são segundos de fala, não um relato).
    void this.discardAudio(row);
    return toVoiceNote(result.rows[0] as VoiceNoteRow);
  }

  private async findRow(userId: string, noteId: string): Promise<VoiceNoteRow> {
    const result = await this.pool.query(`SELECT * FROM voice_notes WHERE id = $1 AND user_id = $2`, [noteId, userId]);
    if (result.rows.length === 0) throw new NotFoundError('VoiceNote', noteId);
    return result.rows[0] as VoiceNoteRow;
  }
}
