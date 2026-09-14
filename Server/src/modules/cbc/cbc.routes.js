import { Router } from 'express';
import { CBCController } from './cbc.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeModule } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate, authorizeModule('CBC'));
router.post('/assessments', CBCController.recordAssessment);
router.get('/students/:studentId/terms/:termId', CBCController.getStudentAssessments);

export default router;
