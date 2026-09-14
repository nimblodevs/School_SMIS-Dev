import { AttendanceService } from './attendance.service.js';
import { markAttendanceSchema, getRegisterQuerySchema } from './attendance.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class AttendanceController {
    static async markClassAttendance(req, res, next) {
        try {
            const validation = markAttendanceSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const result = await AttendanceService.markClassAttendance(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            return res.status(200).json({
                success: true,
                message: 'Attendance recorded successfully',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getAttendanceRegister(req, res, next) {
        try {
            const validation = getRegisterQuerySchema.safeParse(req.query);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const register = await AttendanceService.getAttendanceRegister(
                validation.data,
                req.user.schoolId,
            );

            return res.status(200).json({
                success: true,
                data: register,
            });
        } catch (error) {
            next(error);
        }
    }
}
