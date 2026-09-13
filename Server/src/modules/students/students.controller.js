import { StudentService } from './students.service.js';
import { createStudentSchema, updateStudentSchema, linkParentSchema } from './students.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class StudentController {
    static async create(req, res, next) {
        try {
            const validation = createStudentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            const ipAddress = req.ip || req.headers['x-forwarded-for'];
            const userAgent = req.headers['user-agent'];

            const student = await StudentService.create(validation.data, req.user, { ipAddress, userAgent });
            return res.status(201).json({
                success: true,
                message: 'Student admitted successfully',
                data: student,
            });
        } catch (error) {
            next(error);
        }
    }

    static async list(req, res, next) {
        try {
            const page = req.query.page ? parseInt(req.query.page, 10) : 1;
            const pageSize = req.query.pageSize ? parseInt(req.query.pageSize, 10) : 20;
            const search = req.query.search || null;
            const streamId = req.query.streamId || null;
            const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

            const result = await StudentService.list({
                page,
                pageSize,
                search,
                streamId,
                isActive,
                schoolId: req.user.role === 'SUPER_ADMIN' ? req.query.schoolId : req.user.schoolId,
            });

            return res.status(200).json({
                success: true,
                data: result.students,
                pagination: {
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize,
                    totalPages: result.totalPages,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    static async getById(req, res, next) {
        try {
            const schoolId = req.user.role === 'SUPER_ADMIN' ? null : req.user.schoolId;
            const student = await StudentService.getById(req.params.id, schoolId);
            return res.status(200).json({ success: true, data: student });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const validation = updateStudentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            const ipAddress = req.ip || req.headers['x-forwarded-for'];
            const userAgent = req.headers['user-agent'];

            const student = await StudentService.update(req.params.id, validation.data, req.user, { ipAddress, userAgent });
            return res.status(200).json({
                success: true,
                message: 'Student profile updated successfully',
                data: student,
            });
        } catch (error) {
            next(error);
        }
    }

    static async linkParent(req, res, next) {
        try {
            const validation = linkParentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            const link = await StudentService.linkParent(req.params.id, validation.data.parentId, req.user);
            return res.status(200).json({
                success: true,
                message: 'Parent linked to student successfully',
                data: link,
            });
        } catch (error) {
            next(error);
        }
    }

    static async unlinkParent(req, res, next) {
        try {
            const result = await StudentService.unlinkParent(req.params.id, req.params.parentId, req.user);
            return res.status(200).json({ success: true, message: result.message });
        } catch (error) {
            next(error);
        }
    }
}