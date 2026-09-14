import { Router } from 'express';
import { PayrollController } from './payroll.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate, authorizeRoles('ADMIN'));
router.post('/runs/execute', PayrollController.executeRun);

export default router;
