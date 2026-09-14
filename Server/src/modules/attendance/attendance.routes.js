import { Router } from 'express';
import { AttendanceController } from './attendance.controller.js';
import { authorizeModule } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authorizeModule('ATTENDANCE'));
router.post('/mark', AttendanceController.markClassAttendance);
router.get('/register', AttendanceController.getAttendanceRegister);

export default router;
