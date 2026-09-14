import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from './middlewares/authMiddleware.js';
import authRoutes from '../modules/auth/auth.router.js';
import auditRoutes from '../modules/audit/audit.router.js';
import userRoutes from '../modules/users/user.router.js';
import schoolRoutes from '../modules/schools/school.router.js';
import studentRoutes from '../modules/students/students.routes.js';
import storageRoutes from '../modules/storage/storage.routes.js';
import cbcRoutes from '../modules/cbc/cbc.routes.js';
import examRoutes from '../modules/exams/exams.routes.js';
import reportCardRoutes from '../modules/academics/report-card.routes.js';
import payrollRoutes from '../modules/payroll/payroll.routes.js';
import hrRoutes from '../modules/humanresource/hr.routes.js';
import jobRoutes from '../modules/jobs/jobs.routes.js';
import financeRoutes from '../modules/finance/finance.routes.js';
import academicsRoutes from '../modules/academics/academics.routes.js';
import attendanceRoutes from '../modules/attendance/attendance.routes.js';
import parentRoutes from '../modules/parents/parents.routes.js';

const router = Router();
const globalLimiter = rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

// ---- Public routes ----
router.use('/auth', authRoutes);

// ---- Everything below requires authentication ----
router.use(authenticate);
router.use(globalLimiter);

router.use('/users', userRoutes);
router.use('/schools', schoolRoutes);
router.use('/students', studentRoutes);
router.use('/parents', parentRoutes);
router.use('/academics', academicsRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/storage', storageRoutes);
router.use('/cbc', cbcRoutes);
router.use('/exams', examRoutes);
router.use('/reports', reportCardRoutes);
router.use('/payroll', payrollRoutes);
router.use('/hr', hrRoutes);
router.use('/jobs', jobRoutes);
router.use('/finance', financeRoutes);
router.use('/audit-logs', auditRoutes);

export default router;
