import { Router } from 'express';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { ReportCardController } from './report-card.controller.js';

const router = Router();

router.use(authenticate);
router.get('/terms/:termId', ReportCardController.getTermReports);
router.get('/terms/:termId/students/:studentId', ReportCardController.getTermReports);
router.post('/terms/:termId/students/:studentId/pdf', ReportCardController.queueReportCardPdf);

export default router;
