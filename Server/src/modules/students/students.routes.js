import { Router } from 'express';
import { StudentController } from './students.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeModule, authorizeRoles } from '../../api/middlewares/roleMiddleware.js';
import { ParentController } from '../parents/parents.controller.js';

import { uploadMiddleware, handleBulkAdmission } from './students.bulk-controller.js';

const router = Router();

router.use(authenticate, authorizeModule('STUDENTS'));

router.post('/', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), StudentController.create);
router.get('/', authorizeModule('STUDENTS'), StudentController.list);
router.get('/:id', StudentController.getById);
router.patch('/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), StudentController.update);

// Parent linkage management
router.post(
    '/:id/parents',
    authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'),
    StudentController.linkParent,
);
router.delete(
    '/:id/parents/:parentId',
    authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'),
    StudentController.unlinkParent,
);
router.patch(
    '/:studentId/parents/:parentId/designations',
    authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'),
    ParentController.updateDesignation,
);

// Added Bulk operation route to src/modules/students/students.routes.js
router.post(
    '/bulk-import',
    authorizeRoles('ADMIN', 'SUPER_ADMIN'),
    uploadMiddleware,
    handleBulkAdmission,
);

export default router;
