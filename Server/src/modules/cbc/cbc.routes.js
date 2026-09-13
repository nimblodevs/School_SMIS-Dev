import { Router } from 'express';
import { CBCController } from './cbc.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/assessments', CBCController.recordAssessment);
router.get('/students/:studentId/terms/:termId', CBCController.getStudentAssessments);

export default router;