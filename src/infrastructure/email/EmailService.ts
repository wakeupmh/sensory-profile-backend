import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ServiceUnavailableError } from '../utils/errors/CustomErrors';

/**
 * Thin wrapper around AWS SES. Lazy-init mirrors S3StorageService and
 * AISummaryService's Bedrock client — a missing AWS_REGION or
 * EMAIL_FROM_ADDRESS only fails the specific send, not server boot.
 */
export class EmailService {
  private client: SESv2Client | null = null;

  private getClient(): SESv2Client {
    if (this.client) return this.client;
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new ServiceUnavailableError(
        'Serviço de e-mail temporariamente indisponível (AWS_REGION não configurada)',
        'ses',
      );
    }
    this.client = new SESv2Client({ region });
    return this.client;
  }

  private getFromAddress(): string {
    const from = process.env.EMAIL_FROM_ADDRESS;
    if (!from) {
      throw new ServiceUnavailableError(
        'Serviço de e-mail temporariamente indisponível (EMAIL_FROM_ADDRESS não configurada)',
        'ses',
      );
    }
    return from;
  }

  async sendEmail(to: string, subject: string, textBody: string): Promise<void> {
    const command = new SendEmailCommand({
      FromEmailAddress: this.getFromAddress(),
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Text: { Data: textBody, Charset: 'UTF-8' } },
        },
      },
    });

    try {
      await this.getClient().send(command);
    } catch (e) {
      throw new ServiceUnavailableError(
        'Falha ao enviar e-mail',
        'ses',
        e instanceof Error ? e : new Error(String(e)),
      );
    }
  }
}
