import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { delegationMiddleware } from './childRoutes';
import pool from '../../../infrastructure/database/connection';

import { DocumentController } from '../controllers/DocumentController';
import { DocumentService } from '../../../application/services/DocumentService';
import { PgDocumentRepository } from '../../../infrastructure/repositories/PgDocumentRepository';
import { S3StorageService } from '../../../infrastructure/storage/S3StorageService';

const documentRepository = new PgDocumentRepository();
const storageService = new S3StorageService();
const documentService = new DocumentService(documentRepository, storageService, pool);
const documentController = new DocumentController(documentService);

const router = Router();

router.use(authMiddleware);
router.use(delegationMiddleware);

router.get('/', documentController.list.bind(documentController));
router.post('/upload-url', documentController.requestUpload.bind(documentController));
router.get('/:id', documentController.getById.bind(documentController));
router.get('/:id/download-url', documentController.getDownloadUrl.bind(documentController));
router.patch('/:id', documentController.update.bind(documentController));
router.delete('/:id', documentController.remove.bind(documentController));

export default router;
