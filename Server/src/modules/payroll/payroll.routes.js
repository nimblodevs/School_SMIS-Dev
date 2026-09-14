import { Router } from 'express';
import { PayrollController } from './payroll.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeModule } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate);
router.use(authorizeModule('PAYROLL'));
router.post('/runs/execute', PayrollController.executeRun);

export default router;
