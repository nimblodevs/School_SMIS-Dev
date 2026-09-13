import { Router } from 'express';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { JobsController } from './jobs.controller.js';

const router = Router();

router.use(authenticate);
router.get('/:jobId', JobsController.getById);

export default router;
