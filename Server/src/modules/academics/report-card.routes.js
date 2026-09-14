import { Router } from 'express';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { ReportCardController } from './report-card.controller.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const pdfLimiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    keyGenerator: (req) => req.user.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
});

router.use(authenticate);

// Any authenticated user, but the service enforces role-based scoping:
//   ADMIN/MANAGER/TEACHER/BURSAR → all students in school
//   PARENT                       → only their children
//   STUDENT                      → only themselves
router.get('/terms/:termId', ReportCardController.getTermReports);
router.get('/terms/:termId/students/:studentId', ReportCardController.getTermReports);
router.post(
    '/terms/:termId/students/:studentId/pdf',
    pdfLimiter,
    ReportCardController.queueReportCardPdf,
);

export default router;
