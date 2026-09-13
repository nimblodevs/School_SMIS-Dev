import { Router } from 'express';
import { HRController } from './hr.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/leaves/request', HRController.requestLeave);
router.patch('/leaves/:leaveRequestId/approve', HRController.approveLeave);

export default router;