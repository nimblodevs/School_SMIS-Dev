import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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
import attendanceRoutes from '../modules/attendance/attendance.routes.js';
import parentRoutes from '../modules/parents/parents.routes.js';
import academicsRoutes from '../modules/academics/academics.routes.js';

const router = Router();
const globalLimiter = rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
});

// ---- Public routes ----
router.use('/auth', authRoutes);

// ---- Apply a general abuse limit to all protected module routers below ----
router.use(globalLimiter);

router.use('/users', userRoutes);
router.use('/schools', schoolRoutes);
router.use('/students', studentRoutes);
router.use('/storage', storageRoutes);
router.use('/cbc', cbcRoutes);
router.use('/exams', examRoutes);
router.use('/reports', reportCardRoutes);
router.use('/payroll', payrollRoutes);
router.use('/hr', hrRoutes);
router.use('/jobs', jobRoutes);
router.use('/finance', financeRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/parents', parentRoutes);
router.use('/academics', academicsRoutes);

export default router;
