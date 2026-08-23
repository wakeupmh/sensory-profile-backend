import { Router } from 'express';
import { transcriptionLimiter } from '../middleware/rateLimiters';
import { authMiddleware } from '../middleware/authMiddleware';
import pool from '../../../infrastructure/database/connection';

import { VoiceNoteController } from '../controllers/VoiceNoteController';
import { VoiceNoteService } from '../../../application/services/VoiceNoteService';
import { S3StorageService } from '../../../infrastructure/storage/S3StorageService';
import { TranscriptionService } from '../../../infrastructure/transcription/TranscriptionService';

const controller = new VoiceNoteController(
  new VoiceNoteService(pool, new S3StorageService(), new TranscriptionService()),
);

const router = Router();

// Sem delegationMiddleware, ao contrário das outras rotas: um ditado não
// pertence a nenhuma criança, então não há escopo de delegação a verificar —
// e resolver a delegação aqui só criaria a chance de gravar o ditado na conta
// errada. O ditado é sempre de quem falou.
router.use(authMiddleware);

router.post('/', controller.create.bind(controller));
router.post('/:id/transcribe', transcriptionLimiter, controller.start.bind(controller));
router.get('/:id', controller.getById.bind(controller));

export default router;
