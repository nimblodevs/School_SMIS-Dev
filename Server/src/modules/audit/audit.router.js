import { Router } from 'express';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';
import { AuditController } from './audit.controller.js';

const router = Router();

router.get('/', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), AuditController.list);

export default router;
