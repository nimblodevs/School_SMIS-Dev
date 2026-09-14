import { Router } from 'express';
import { StorageController } from './storage.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate, authorizeRoles('ADMIN', 'MANAGER'));
router.post('/upload-url', StorageController.createUploadUrl);
router.post('/register', StorageController.registerUpload);
router.get('/entity/:entityType/:entityId', StorageController.getEntityFiles);

export default router;
