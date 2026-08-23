import { z } from 'zod';
import { audioMimeSchema } from './dailyReportValidation';

export const createVoiceNoteSchema = z.object({
  mimeType: audioMimeSchema,
});
