import { Router } from 'express';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';
import { SchoolController } from './school.controller.js';

const router = Router();

router.use(authenticate);
router.get('/current', SchoolController.current);
router.get(
    '/:schoolId/settings',
    authorizeRoles('ADMIN', 'SUPER_ADMIN'),
    SchoolController.getSettings,
);
router.patch(
    '/:schoolId/settings',
    authorizeRoles('ADMIN', 'SUPER_ADMIN'),
    SchoolController.updateSettings,
);
router.get('/', authorizeRoles('SUPER_ADMIN'), SchoolController.list);
router.post('/', authorizeRoles('SUPER_ADMIN'), SchoolController.create);
router.get('/:schoolId', authorizeRoles('ADMIN', 'SUPER_ADMIN'), SchoolController.getById);
router.patch('/:schoolId', authorizeRoles('ADMIN', 'SUPER_ADMIN'), SchoolController.update);

export default router;
