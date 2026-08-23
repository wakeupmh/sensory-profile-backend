import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  DeleteTranscriptionJobCommand,
  TranscriptionJobStatus,
} from '@aws-sdk/client-transcribe';
import { ServiceUnavailableError } from '../utils/errors/CustomErrors';

/** Português do Brasil — o app é pt-BR e o áudio é falado pelo cuidador. */
const LANGUAGE_CODE = 'pt-BR';

export type TranscriptionStatus = 'in-progress' | 'completed' | 'failed';

export interface TranscriptionJobState {
  status: TranscriptionStatus;
  /** Chave no bucket com o JSON de saída, quando concluído. */
  outputKey?: string;
  failureReason?: string;
}

/**
 * Wrapper fino sobre o AWS Transcribe, no mesmo padrão de lazy-init do
 * S3StorageService/AISummaryService: a falta de AWS_REGION só quebra a
 * requisição que precisa dela, não o boot do servidor.
 *
 * O Transcribe é assíncrono por natureza — não existe "transcreva e me
 * devolva o texto". Inicia-se um job e consulta-se o status depois. Aqui o
 * job escreve o resultado no *nosso* bucket (OutputBucketName), em vez do
 * bucket gerenciado pela AWS: assim o JSON da transcrição fica sujeito às
 * mesmas regras de ciclo de vida, exportação e eliminação (LGPD) que todo o
 * resto, em vez de viver 90 dias num bucket que não controlamos.
 */
export class TranscriptionService {
  private client: TranscribeClient | null = null;

  private getClient(): TranscribeClient {
    if (this.client) return this.client;
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new ServiceUnavailableError(
        'Serviço de transcrição temporariamente indisponível (AWS_REGION não configurada)',
        'transcribe',
      );
    }
    this.client = new TranscribeClient({ region });
    return this.client;
  }

  private getBucket(): string {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new ServiceUnavailableError(
        'Serviço de transcrição temporariamente indisponível (AWS_S3_BUCKET não configurada)',
        'transcribe',
      );
    }
    return bucket;
  }

  async startJob(jobName: string, audioKey: string, outputKey: string): Promise<void> {
    const bucket = this.getBucket();
    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: LANGUAGE_CODE,
      Media: { MediaFileUri: `s3://${bucket}/${audioKey}` },
      OutputBucketName: bucket,
      OutputKey: outputKey,
    });
    try {
      await this.getClient().send(command);
    } catch (e) {
      throw new ServiceUnavailableError(
        'Não foi possível iniciar a transcrição',
        'transcribe',
        e instanceof Error ? e : new Error(String(e)),
      );
    }
  }

  async getJob(jobName: string): Promise<TranscriptionJobState> {
    try {
      const response = await this.getClient().send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }),
      );
      const job = response.TranscriptionJob;
      const status = job?.TranscriptionJobStatus;

      if (status === TranscriptionJobStatus.COMPLETED) {
        return { status: 'completed', outputKey: extractOutputKey(job?.Transcript?.TranscriptFileUri) };
      }
      if (status === TranscriptionJobStatus.FAILED) {
        return { status: 'failed', failureReason: job?.FailureReason ?? 'Motivo não informado' };
      }
      return { status: 'in-progress' };
    } catch (e) {
      throw new ServiceUnavailableError(
        'Não foi possível consultar a transcrição',
        'transcribe',
        e instanceof Error ? e : new Error(String(e)),
      );
    }
  }

  /**
   * Best-effort: nomes de job são únicos por conta e ficam retidos por 90
   * dias, então apagá-los evita colidir ao reprocessar o mesmo relato.
   * Uma falha aqui não deve derrubar a operação que a chamou.
   */
  async deleteJob(jobName: string): Promise<void> {
    try {
      await this.getClient().send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobName }));
    } catch {
      // ignorado de propósito
    }
  }
}

/**
 * O Transcribe devolve a URI completa (https://s3.<region>.amazonaws.com/<bucket>/<key>);
 * o que precisamos é só a key dentro do nosso bucket.
 */
function extractOutputKey(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) return undefined;
  const marker = `/${bucket}/`;
  const index = uri.indexOf(marker);
  return index === -1 ? undefined : uri.slice(index + marker.length);
}
