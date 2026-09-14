import { Router } from 'express';
import { StudentController } from './students.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeModule, requirePermission } from '../../api/middlewares/roleMiddleware.js';
import { ParentController } from '../parents/parents.controller.js';

import { uploadMiddleware, handleBulkAdmission } from './students.bulk-controller.js';

const router = Router();

router.use(authenticate, authorizeModule('STUDENTS'));

router.post('/', requirePermission('students:create'), StudentController.create);
router.get('/', requirePermission('students:read'), StudentController.list);
router.get('/:id', requirePermission('students:read'), StudentController.getById);
router.patch('/:id', requirePermission('students:update'), StudentController.update);

// Parent linkage management
router.post(
    '/:id/parents',
    requirePermission('students:update'),
    StudentController.linkParent,
);
router.delete(
    '/:id/parents/:parentId',
    requirePermission('students:update'),
    StudentController.unlinkParent,
);
router.patch(
    '/:studentId/parents/:parentId/designations',
    requirePermission('students:update'),
    ParentController.updateDesignation,
);

// Added Bulk operation route to src/modules/students/students.routes.js
router.post(
    '/bulk-import',
    requirePermission('students:create'),
    uploadMiddleware,
    handleBulkAdmission,
);

export default router;
