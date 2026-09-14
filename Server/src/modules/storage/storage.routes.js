import { Router } from 'express';
import { StorageController } from './storage.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate);
router.post(
    '/upload-url',
    authorizeRoles('ADMIN', 'MANAGER', 'TEACHER', 'STAFF', 'BURSAR'),
    StorageController.createUploadUrl,
);
router.post(
    '/register',
    authorizeRoles('ADMIN', 'MANAGER', 'TEACHER', 'STAFF', 'BURSAR'),
    StorageController.registerUpload,
);
router.get('/entity/:entityType/:entityId', StorageController.getEntityFiles);

export default router;
