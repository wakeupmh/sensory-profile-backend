import { z } from 'zod';

/**
 * Formats the AWS Transcribe accepts *and* that a browser's MediaRecorder
 * actually produces: Chrome/Firefox emit `audio/webm`, Safari `audio/mp4`.
 * The rest are here so a caller uploading an existing recording isn't blocked
 * on a technicality.
 */
const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
] as const;

// MediaRecorder reports `audio/webm;codecs=opus`. The codec parameter is
// irrelevant to us and to Transcribe, so it's dropped before the allowlist
// check rather than being enumerated in it.
export const audioMimeSchema = z
  .string()
  .max(150)
  .transform((val) => val.split(';')[0].trim().toLowerCase())
  .refine((val) => (ALLOWED_AUDIO_TYPES as readonly string[]).includes(val), {
    message: 'Formato de áudio não suportado',
  });

export const createDailyReportSchema = z.object({
  childId: z.string().uuid(),
  // Plain date, not a timestamp: the report is "o dia 12", not an instant.
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  mimeType: audioMimeSchema,
});

export const listDailyReportsSchema = z.object({
  childId: z.string().uuid(),
  limit: z.coerce.number().int().positive().max(100).default(30),
});

/**
 * A transcrição é o registro durável — alimenta a exportação LGPD e os
 * resumos da IA — então uma correção (nome ou termo mal-entendido pelo
 * Transcribe) precisa continuar sendo texto de verdade, não apagar o relato
 * inteiro. `trim()` evita salvar uma edição que é só espaço em branco.
 */
export const updateDailyReportSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(1, 'A transcrição não pode ficar vazia')
    .max(20000, 'Transcrição muito longa'),
});
