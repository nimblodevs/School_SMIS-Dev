import { Router } from 'express';
import { AcademicsController } from './academics.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate);

// Academic Years & Terms
router.post('/years', authorizeRoles('ADMIN', 'SUPER_ADMIN'), AcademicsController.createAcademicYear);
router.get('/years', AcademicsController.listAcademicYears);
router.post('/terms', authorizeRoles('ADMIN', 'SUPER_ADMIN'), AcademicsController.createTerm);

// Class Levels & Streams
router.post('/classes', authorizeRoles('ADMIN', 'SUPER_ADMIN'), AcademicsController.createClassLevel);
router.get('/classes', AcademicsController.listClassLevels);
router.post('/streams', authorizeRoles('ADMIN', 'SUPER_ADMIN'), AcademicsController.createStream);

// Subjects & Allocations
router.post('/subjects', authorizeRoles('ADMIN', 'SUPER_ADMIN'), AcademicsController.createSubject);
router.get('/subjects', AcademicsController.listSubjects);
router.post('/teachers/assign-subject', authorizeRoles('ADMIN', 'SUPER_ADMIN'), AcademicsController.assignTeacherSubject);
router.post('/streams/assign-subject', authorizeRoles('ADMIN', 'SUPER_ADMIN'), AcademicsController.assignClassSubject);

export default router;