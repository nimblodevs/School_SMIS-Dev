import { Router } from 'express';
import { ExamsController } from './exams.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/', ExamsController.createExam);
router.post('/:examId/results', ExamsController.recordResults);

export default router;