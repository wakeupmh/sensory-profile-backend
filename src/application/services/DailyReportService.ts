import { Pool } from 'pg';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';
import { NotFoundError, ValidationError } from '../../infrastructure/utils/errors/CustomErrors';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService';
import { TranscriptionService } from '../../infrastructure/transcription/TranscriptionService';
import { AISummaryService } from './AISummaryService';
import { LOG_TYPES } from '../../domain/entities/DailyLog';
import { scopedById } from '../../infrastructure/repositories/queryUtils';
import { currentScope } from '../../infrastructure/database/requestScope';
import logger from '../../infrastructure/utils/logger';

/**
 * A saída do modelo é texto de um terceiro, não um contrato: pode vir com um
 * `logType` que não existe, `suggestedLogs` como objeto em vez de lista, ou
 * campos faltando. Guardar isso cru no JSONB empurra o problema para o
 * front-end, onde um `.map` em não-lista derruba a tela inteira e um
 * `logType` inventado vira um botão "Salvar registro" que sempre falha.
 *
 * `logType` reusa LOG_TYPES do validador de registros diários de propósito:
 * é a lista canônica, e um tipo novo lá passa a ser sugerível aqui sem
 * ninguém precisar lembrar de sincronizar duas cópias.
 */
const suggestedLogSchema = z.object({
  logType: z.enum(LOG_TYPES),
  notes: z.string().max(2000).optional(),
  data: z.record(z.unknown()).optional(),
});

const structuredSchema = z.object({
  summary: z.string().max(5000).optional(),
  highlights: z.array(z.string().max(1000)).optional(),
  concerns: z.array(z.string().max(1000)).optional(),
  suggestedLogs: z.array(z.unknown()).optional(),
});

/**
 * Descarta o que não bate com o formato e mantém o resto. Uma sugestão
 * inválida entre cinco não deve custar as outras quatro nem o resumo — o
 * relato do cuidador continua sendo a parte que importa.
 */
export function sanitizeStructured(parsed: unknown): Record<string, unknown> | null {
  const base = structuredSchema.safeParse(parsed);
  if (!base.success) return null;

  const suggestedLogs = (base.data.suggestedLogs ?? [])
    .map((item) => suggestedLogSchema.safeParse(item))
    .filter((r): r is z.SafeParseSuccess<z.infer<typeof suggestedLogSchema>> => r.success)
    .map((r) => r.data);

  return { ...base.data, suggestedLogs };
}

/** Quanto tempo o áudio original fica guardado antes do job de retenção apagá-lo. */
const AUDIO_RETENTION_DAYS = 30;

/**
 * Depois deste tempo uma reserva de estruturação é considerada abandonada
 * (o processo caiu no meio) e outra consulta pode assumir o trabalho.
 * Folgado o bastante para a chamada mais lenta do Bedrock, curto o bastante
 * para o cuidador não ficar preso olhando "Transcrevendo…".
 */
const STRUCTURING_CLAIM_TIMEOUT = '5 minutes';

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
  /** `sub` de quem gravou este relato, quando difere do dono. NULL = dono. */
  authorUserId: string | null;
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
  author_user_id: string | null;
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
    authorUserId: row.author_user_id ?? null,
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

    // Autoria: derivada do escopo do jeito que BaseDomainService.create faz,
    // repetido aqui porque este serviço nunca passou por ele (monta o SQL à
    // mão). O ON CONFLICT também grava author_user_id — regravar o relato do
    // mesmo dia zera áudio/transcrição/estruturação por inteiro (ver
    // comentário acima), então é uma autoria nova, não uma edição do que já
    // existia.
    const { actingUserId } = currentScope();
    const authorUserId = actingUserId && actingUserId !== userId ? actingUserId : null;

    // O upsert vem antes de calcular a chave do áudio, porque a chave precisa
    // conter o id da linha — e num ON CONFLICT o id que vale é o da linha que
    // já existia, não o que acabamos de gerar.
    const upserted = await this.pool.query(
      `INSERT INTO daily_reports (id, user_id, author_user_id, child_id, report_date, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       ON CONFLICT (child_id, report_date) DO UPDATE SET
         status = 'draft',
         author_user_id = $3,
         audio_storage_key = NULL,
         audio_mime_type = NULL,
         audio_expires_at = NULL,
         transcript = NULL,
         structured = NULL,
         error = NULL,
         transcribe_job_name = NULL,
         transcript_key = NULL
       RETURNING id`,
      [uuidv7(), userId, authorUserId, childId, reportDate],
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

    const scope = scopedById('daily_reports', reportId, userId, 3);
    const result = await this.pool.query(
      `UPDATE daily_reports
          SET status = 'transcribing', transcribe_job_name = $1, transcript_key = $2, error = NULL,
              structuring_started_at = NULL
        WHERE ${scope.where}
        RETURNING *`,
      [jobName, transcriptKey, ...scope.params],
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

    // Reserva ANTES de qualquer trabalho caro. O cliente consulta a cada 4s e
    // a estruturação leva 2-5s, então sem isto a consulta seguinte entrava
    // aqui de novo e invocava o Bedrock uma segunda vez — cobrada, no caminho
    // normal, não numa corrida rara.
    const claim = await this.pool.query(
      `UPDATE daily_reports SET structuring_started_at = NOW()
        WHERE id = $1 AND status = 'transcribing'
          AND (structuring_started_at IS NULL
               OR structuring_started_at < NOW() - INTERVAL '${STRUCTURING_CLAIM_TIMEOUT}')
        RETURNING *`,
      [row.id],
    );
    if (claim.rowCount === 0) return toDailyReport(row);

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
        `UPDATE daily_reports SET status = 'ready', transcript = $1, structured = $2, error = NULL,
                structuring_started_at = NULL
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
      `UPDATE daily_reports SET status = 'failed', error = $1, structuring_started_at = NULL
        WHERE id = $2 RETURNING *`,
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

    const sanitized = sanitizeStructured(JSON.parse(raw.slice(start, end + 1)));
    if (!sanitized) throw new Error('Resposta da IA não tinha o formato esperado');
    return sanitized;
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

  /**
   * A fala é transcrita por máquina: nomes, remédios e termos clínicos são o
   * que mais erra. A transcrição é o registro durável (alimenta a exportação
   * LGPD e os resumos da IA), então precisa ser corrigível sem descartar a
   * gravação inteira.
   *
   * Só um relato `ready` tem transcrição para editar — `draft`/`transcribing`
   * ainda não têm texto, e `failed` idem.
   *
   * `structured` foi gerado a partir do texto ANTIGO: resumo, destaques e os
   * registros sugeridos citam frases da transcrição anterior. Deixá-lo como
   * estava depois da edição seria pior que apagá-lo — o cuidador leria uma
   * sugestão de registro que já não corresponde ao que ele escreveu. Por
   * isso a estruturação é refeita aqui, de forma síncrona (a chamada ao
   * Bedrock já é essa mesma leva de 2-5s do fluxo original — não há job
   * assíncrono para uma correção de texto). Se a IA falhar, o relato erra
   * para o lado seguro: guarda a transcrição corrigida e zera `structured`
   * (nunca deixa a versão desatualizada), do mesmo jeito que `advance` faz
   * quando a estruturação inicial falha.
   */
  async updateTranscript(userId: string, reportId: string, transcript: string): Promise<DailyReport> {
    const row = await this.findRow(userId, reportId);
    if (row.status !== 'ready') {
      throw new ValidationError('Só é possível editar a transcrição de um relato pronto');
    }

    let structured: Record<string, unknown> | null = null;
    try {
      structured = await this.structure(transcript, toDateString(row.report_date));
    } catch (e) {
      logger.warn('[DailyReportService] re-structuring failed after transcript edit, clearing stale structured data', {
        reportId: row.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const scope = scopedById('daily_reports', reportId, userId, 3);
    const result = await this.pool.query(
      `UPDATE daily_reports SET transcript = $1, structured = $2
        WHERE ${scope.where}
        RETURNING *`,
      [transcript, structured, ...scope.params],
    );
    return toDailyReport(result.rows[0] as DailyReportRow);
  }

  async delete(userId: string, reportId: string): Promise<void> {
    const row = await this.findRow(userId, reportId);
    const scope = scopedById('daily_reports', reportId, userId);
    await this.pool.query(`DELETE FROM daily_reports WHERE ${scope.where}`, scope.params);
    if (row.audio_storage_key) await this.storage.deleteObject(row.audio_storage_key).catch(() => undefined);
    if (row.transcript_key) await this.storage.deleteObject(row.transcript_key).catch(() => undefined);
  }

  private async findRow(userId: string, reportId: string): Promise<DailyReportRow> {
    const scope = scopedById('daily_reports', reportId, userId);
    const result = await this.pool.query(`SELECT * FROM daily_reports WHERE ${scope.where}`, scope.params);
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
