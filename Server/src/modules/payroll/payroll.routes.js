import { Router } from 'express';
import { PayrollController } from './payroll.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { requirePermission } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/runs/execute', requirePermission('payroll:process'), PayrollController.executeRun);

export default router;
