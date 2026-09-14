import { Router } from 'express';
import { ExamsController } from './exams.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeModule } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate);
router.use(authorizeModule('EXAMS'));
router.post('/', ExamsController.createExam);
router.post('/:examId/results', ExamsController.recordResults);

export default router;
