import { Router } from 'express';
import { ParentController } from './parents.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate);

router.post('/', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), ParentController.create);
router.get('/', ParentController.list);
router.get('/:id', ParentController.getById);
router.patch('/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), ParentController.update);

// Student association management
router.post('/:id/students', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), ParentController.linkStudent);
router.delete('/:id/students/:studentId', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), ParentController.unlinkStudent);

export default router;