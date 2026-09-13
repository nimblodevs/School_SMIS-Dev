import { BadRequestError } from '../../shared/errors/AppError.js';
import { UserService } from './user.service.js';
import { createStaffSchema, createTeacherSchema } from './user.validation.js';

export class UserController {
    static async createTeacher(req, res, next) {
        try {
            const validation = createTeacherSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());
            const data = await UserService.provisionEmployee('TEACHER', validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(201).json({ success: true, message: 'Teacher account created and credentials sent', data });
        } catch (error) {
            next(error);
        }
    }

    static async createStaff(req, res, next) {
        try {
            const validation = createStaffSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());
            const data = await UserService.provisionEmployee('STAFF', validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(201).json({ success: true, message: 'Staff account created and credentials sent', data });
        } catch (error) {
            next(error);
        }
    }
}
