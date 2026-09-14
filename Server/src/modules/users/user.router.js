import { Router } from 'express';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { requirePermission } from '../../api/middlewares/roleMiddleware.js';
import { UserController } from './user.controller.js';

const router = Router();

router.use(authenticate, requirePermission('users:create'));
router.post('/teachers', UserController.createTeacher);
router.post('/staff', UserController.createStaff);

export default router;
