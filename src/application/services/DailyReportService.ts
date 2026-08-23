import { Pool } from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { NotFoundError, ValidationError } from '../../infrastructure/utils/errors/CustomErrors';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService';
import { TranscriptionService } from '../../infrastructure/transcription/TranscriptionService';
import { AISummaryService } from './AISummaryService';
import logger from '../../infrastructure/utils/logger';

/** Quanto tempo o áudio original fica guardado antes do job de retenção apagá-lo. */
const AUDIO_RETENTION_DAYS = 30;

export type DailyReportStatus = 'draft' | 'transcribing' | 'ready' | 'failed';

export interface DailyReport {
  id: string;
  childId: string;
  reportDate: string;
  status: DailyReportStatus;
  transcript: string | null;
  structured: Record<string, unknown> | null;
  error: string | null;
  hasAudio: boolean;
  audioExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DailyReportRow {
  id: string;
  child_id: string;
  report_date: Date | string;
  status: DailyReportStatus;
  transcript: string | null;
  structured: Record<string, unknown> | null;
  error: string | null;
  audio_storage_key: string | null;
  audio_expires_at: Date | null;
  transcribe_job_name: string | null;
  transcript_key: string | null;
  created_at: Date;
  updated_at: Date;
}

function toDateString(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function toDailyReport(row: DailyReportRow): DailyReport {
  return {
    id: row.id,
    childId: row.child_id,
    reportDate: toDateString(row.report_date),
    status: row.status,
    transcript: row.transcript,
    structured: row.structured,
    error: row.error,
    hasAudio: row.audio_storage_key !== null,
    audioExpiresAt: row.audio_expires_at ? row.audio_expires_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * "Conta como foi o dia" — o cuidador grava um áudio, ele é transcrito e
 * vira um relatório do dia com registros estruturados sugeridos.
 *
 * O fluxo é assíncrono porque o Transcribe é assíncrono, e é dirigido por
 * polling do cliente em vez de webhook/EventBridge: são poucos jobs por dia
 * por usuário, e uma fila real seria infraestrutura nova para resolver um
 * problema que ainda não existe.
 *
 *   1. `createDraft`  — cria a linha e devolve uma URL pré-assinada de upload
 *   2. `startTranscription` — cliente terminou o upload; dispara o job
 *   3. `refresh`      — chamado a cada consulta do cliente enquanto está
 *                       `transcribing`: se o job acabou, busca o texto,
 *                       estrutura via IA e finaliza
 */
export class DailyReportService {
  constructor(
    private readonly pool: Pool,
    private readonly storage: S3StorageService,
    private readonly transcription: TranscriptionService,
    private readonly ai: AISummaryService,
  ) {}

  private async assertChildOwned(userId: string, childId: string): Promise<void> {
    const result = await this.pool.query(`SELECT 1 FROM children WHERE id = $1 AND user_id = $2`, [childId, userId]);
    if (result.rows.length === 0) throw new NotFoundError('Child', childId);
  }

  async createDraft(
    userId: string,
    childId: string,
    reportDate: string,
    mimeType: string,
  ): Promise<{ report: DailyReport; uploadUrl: string }> {
    await this.assertChildOwned(userId, childId);

    // Regravar o relato do mesmo dia substitui o anterior em vez de criar um
    // segundo: é "o relato do dia 12", não "mais um relato". As chaves do
    // relato anterior são lidas antes de o upsert as zerar — depois disso
    // ninguém mais saberia que aqueles objetos existem no bucket.
    const previous = await this.pool.query(
      `SELECT audio_storage_key, transcript_key FROM daily_reports WHERE child_id = $1 AND report_date = $2`,
      [childId, reportDate],
    );
    const previousKeys: string[] = previous.rows.flatMap((r) =>
      [r.audio_storage_key as string | null, r.transcript_key as string | null].filter(
        (k): k is string => k !== null,
      ),
    );

    // O upsert vem antes de calcular a chave do áudio, porque a chave precisa
    // conter o id da linha — e num ON CONFLICT o id que vale é o da linha que
    // já existia, não o que acabamos de gerar.
    const upserted = await this.pool.query(
      `INSERT INTO daily_reports (id, user_id, child_id, report_date, status)
       VALUES ($1, $2, $3, $4, 'draft')
       ON CONFLICT (child_id, report_date) DO UPDATE SET
         status = 'draft',
         audio_storage_key = NULL,
         audio_mime_type = NULL,
         audio_expires_at = NULL,
         transcript = NULL,
         structured = NULL,
         error = NULL,
         transcribe_job_name = NULL,
         transcript_key = NULL
       RETURNING id`,
      [uuidv7(), userId, childId, reportDate],
    );
    const { id } = upserted.rows[0] as { id: string };

    const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : mimeType.includes('flac') ? 'flac' : 'webm';
    // O sufixo de tempo evita reaproveitar uma chave que o Transcribe possa
    // ter em cache de um job anterior deste mesmo relato.
    const audioKey = `daily-reports/${userId}/${id}/audio-${Date.now()}.${extension}`;
    const expiresAt = new Date(Date.now() + AUDIO_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.pool.query(
      `UPDATE daily_reports SET audio_storage_key = $1, audio_mime_type = $2, audio_expires_at = $3
        WHERE id = $4 RETURNING *`,
      [audioKey, mimeType, expiresAt, id],
    );

    // A linha já não referencia os objetos antigos; deixá-los no bucket seria
    // órfão permanente, invisível para o job de retenção (que acha os
    // arquivos pela linha). Best-effort: falhar aqui não deve impedir a nova
    // gravação.
    for (const stale of previousKeys) {
      await this.storage.deleteObject(stale).catch(() => undefined);
    }

    const uploadUrl = await this.storage.getUploadUrl(audioKey, mimeType);
    return { report: toDailyReport(result.rows[0] as DailyReportRow), uploadUrl };
  }

  async startTranscription(userId: string, reportId: string): Promise<DailyReport> {
    const row = await this.findRow(userId, reportId);
    if (!row.audio_storage_key) {
      throw new ValidationError('Nenhum áudio foi enviado para este relato');
    }

    // Nome do job precisa ser único na conta e casar com [0-9a-zA-Z._-].
    // O id do relato já é único; o sufixo de tempo permite reprocessar o
    // mesmo relato sem colidir com o job anterior (que a AWS retém 90 dias).
    const jobName = `daily-report-${row.id}-${Date.now()}`;
    const transcriptKey = `daily-reports/${userId}/${row.id}/transcript-${Date.now()}.json`;

    await this.transcription.startJob(jobName, row.audio_storage_key, transcriptKey);

    const result = await this.pool.query(
      `UPDATE daily_reports
          SET status = 'transcribing', transcribe_job_name = $1, transcript_key = $2, error = NULL
        WHERE id = $3 AND user_id = $4
        RETURNING *`,
      [jobName, transcriptKey, reportId, userId],
    );
    return toDailyReport(result.rows[0] as DailyReportRow);
  }

  /**
   * Devolve o relato, avançando o estado se o job de transcrição já terminou.
   * É o que o cliente chama em loop enquanto o status for `transcribing`.
   */
  async get(userId: string, reportId: string): Promise<DailyReport> {
    const row = await this.findRow(userId, reportId);
    if (row.status !== 'transcribing' || !row.transcribe_job_name) return toDailyReport(row);
    return this.advance(row);
  }

  private async advance(row: DailyReportRow): Promise<DailyReport> {
    const job = await this.transcription.getJob(row.transcribe_job_name as string);
    if (job.status === 'in-progress') return toDailyReport(row);

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

      // A estruturação é o que transforma um desabafo corrido em algo que o
      // resto do app entende. Se a IA falhar, o relato ainda é útil: guarda-se
      // a transcrição e segue como `ready` sem `structured`, em vez de perder
      // o que o cuidador falou por causa de um serviço indisponível.
      let structured: Record<string, unknown> | null = null;
      try {
        structured = await this.structure(transcript, toDateString(row.report_date));
      } catch (e) {
        logger.warn('[DailyReportService] structuring failed, keeping raw transcript', {
          reportId: row.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      const result = await this.pool.query(
        `UPDATE daily_reports SET status = 'ready', transcript = $1, structured = $2, error = NULL
          WHERE id = $3 RETURNING *`,
        [transcript, structured, row.id],
      );
      void this.transcription.deleteJob(row.transcribe_job_name as string);
      return toDailyReport(result.rows[0] as DailyReportRow);
    } catch (e) {
      return this.fail(row, e instanceof Error ? e.message : String(e));
    }
  }

  private async fail(row: DailyReportRow, message: string): Promise<DailyReport> {
    const result = await this.pool.query(
      `UPDATE daily_reports SET status = 'failed', error = $1 WHERE id = $2 RETURNING *`,
      [message, row.id],
    );
    return toDailyReport(result.rows[0] as DailyReportRow);
  }

  private async structure(transcript: string, reportDate: string): Promise<Record<string, unknown>> {
    const raw = await this.ai.structureDailyReport(transcript, reportDate);
    // O prompt pede JSON puro, mas modelos ocasionalmente embrulham em ```json.
    // Recortar entre a primeira `{` e a última `}` custa uma linha e evita
    // descartar uma estruturação boa por causa de três crases.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('Resposta da IA não continha JSON');
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  }

  async list(userId: string, childId: string, limit = 30): Promise<DailyReport[]> {
    await this.assertChildOwned(userId, childId);
    const result = await this.pool.query(
      `SELECT * FROM daily_reports WHERE user_id = $1 AND child_id = $2
        ORDER BY report_date DESC LIMIT $3`,
      [userId, childId, limit],
    );
    return result.rows.map((r) => toDailyReport(r as DailyReportRow));
  }

  /** URL curta para o cuidador reouvir o próprio relato, enquanto o áudio existir. */
  async getAudioUrl(userId: string, reportId: string): Promise<string> {
    const row = await this.findRow(userId, reportId);
    if (!row.audio_storage_key) throw new NotFoundError('Audio', reportId);
    return this.storage.getDownloadUrl(row.audio_storage_key);
  }

  async delete(userId: string, reportId: string): Promise<void> {
    const row = await this.findRow(userId, reportId);
    await this.pool.query(`DELETE FROM daily_reports WHERE id = $1 AND user_id = $2`, [reportId, userId]);
    if (row.audio_storage_key) await this.storage.deleteObject(row.audio_storage_key).catch(() => undefined);
    if (row.transcript_key) await this.storage.deleteObject(row.transcript_key).catch(() => undefined);
  }

  private async findRow(userId: string, reportId: string): Promise<DailyReportRow> {
    const result = await this.pool.query(`SELECT * FROM daily_reports WHERE id = $1 AND user_id = $2`, [
      reportId,
      userId,
    ]);
    if (result.rows.length === 0) throw new NotFoundError('DailyReport', reportId);
    return result.rows[0] as DailyReportRow;
  }
}

/**
 * O JSON do Transcribe é `{ results: { transcripts: [{ transcript }] } }`.
 * Tolerante de propósito: um formato inesperado vira string vazia (que o
 * chamador trata como "sem texto") em vez de derrubar o relato inteiro.
 */
export function extractTranscript(json: string): string {
  try {
    const parsed = JSON.parse(json) as { results?: { transcripts?: Array<{ transcript?: string }> } };
    return parsed.results?.transcripts?.map((t) => t.transcript ?? '').join(' ').trim() ?? '';
  } catch {
    return '';
  }
}
