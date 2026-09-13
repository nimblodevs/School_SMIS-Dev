import { Router } from 'express';
import { PayrollController } from './payroll.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/runs/execute', PayrollController.executeRun);

export default router;