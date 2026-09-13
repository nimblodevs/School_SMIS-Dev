import { Router } from 'express';
import { AttendanceController } from './attendance.controller.js';

const router = Router();

router.post('/mark', AttendanceController.markClassAttendance);
router.get('/register', AttendanceController.getAttendanceRegister);

export default router;