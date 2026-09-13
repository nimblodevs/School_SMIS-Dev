import { Router } from 'express';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';
import { UserController } from './user.controller.js';

const router = Router();

router.use(authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'));
router.post('/teachers', UserController.createTeacher);
router.post('/staff', UserController.createStaff);

export default router;
