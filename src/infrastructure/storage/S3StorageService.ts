import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ServiceUnavailableError } from '../utils/errors/CustomErrors';

const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes to start the PUT
// Exported so callers that report an expiry to the client (e.g. the LGPD
// data export's `expiresAt`) derive it from the real TTL instead of
// restating the number and silently lying the day it's tuned.
export const DOWNLOAD_URL_TTL_SECONDS = 15 * 60; // 15 minutes to view/download

/**
 * Thin wrapper around S3 presigned URLs. The backend never proxies file
 * bytes: it hands the client a presigned PUT URL to upload directly to the
 * bucket, and a presigned GET URL to read it back. Mirrors the lazy-init
 * pattern used by AISummaryService for Bedrock — a missing AWS_REGION or
 * AWS_S3_BUCKET only fails the specific request that needs it, not server
 * boot.
 */
export class S3StorageService {
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (this.client) return this.client;
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new ServiceUnavailableError(
        'Serviço de armazenamento temporariamente indisponível (AWS_REGION não configurada)',
        's3',
      );
    }
    this.client = new S3Client({ region });
    return this.client;
  }

  private getBucket(): string {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new ServiceUnavailableError(
        'Serviço de armazenamento temporariamente indisponível (AWS_S3_BUCKET não configurada)',
        's3',
      );
    }
    return bucket;
  }

  async getUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.getClient(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
    });
    return getSignedUrl(this.getClient(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
    });
    await this.getClient().send(command);
  }

  /**
   * Server-side upload, unlike getUploadUrl's client-side presigned PUT.
   * Used for content the backend itself generates (e.g. a data export
   * JSON file) rather than a file the client is sending.
   */
  async putObject(key: string, body: string | Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await this.getClient().send(command);
  }

  /**
   * Reads an object the backend itself needs to look at — as opposed to
   * getDownloadUrl, which hands the bytes straight to the client. Used for
   * the JSON the Transcribe job writes into our bucket. Only for small,
   * backend-generated objects: it buffers the whole body in memory.
   */
  async getObjectText(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
    });
    const response = await this.getClient().send(command);
    if (!response.Body) throw new Error(`Empty S3 object: ${key}`);
    return response.Body.transformToString();
  }
}
