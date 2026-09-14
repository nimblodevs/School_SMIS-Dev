import { Router } from 'express';
import { AcademicsController } from './academics.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate);

// Roles that can administer academics
const WRITE_ROLES = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'];
const READ_ROLES = ['ADMIN', 'MANAGER', 'TEACHER', 'BURSAR', 'SUPER_ADMIN'];

// Academic Years & Terms
router.post('/years', authorizeRoles(...WRITE_ROLES), AcademicsController.createAcademicYear);
router.get('/years', authorizeRoles(...READ_ROLES), AcademicsController.listAcademicYears);
router.post('/terms', authorizeRoles(...WRITE_ROLES), AcademicsController.createTerm);

// Class Levels & Streams
router.post('/classes', authorizeRoles(...WRITE_ROLES), AcademicsController.createClassLevel);
router.get('/classes', authorizeRoles(...READ_ROLES), AcademicsController.listClassLevels);
router.post('/streams', authorizeRoles(...WRITE_ROLES), AcademicsController.createStream);

// Subjects & Allocations
router.post('/subjects', authorizeRoles(...WRITE_ROLES), AcademicsController.createSubject);
router.get('/subjects', authorizeRoles(...READ_ROLES), AcademicsController.listSubjects);
router.post(
    '/teachers/assign-subject',
    authorizeRoles(...WRITE_ROLES),
    AcademicsController.assignTeacherSubject,
);
router.post(
    '/streams/assign-subject',
    authorizeRoles(...WRITE_ROLES),
    AcademicsController.assignClassSubject,
);

export default router;
