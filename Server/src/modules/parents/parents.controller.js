import { ParentService } from './parents.service.js';
import { ParentDesignationService } from './designation.service.js';
import {
    createParentSchema,
    updateParentSchema,
    linkStudentSchema,
    updateParentDesignationSchema,
} from './parents.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class ParentController {
    static async create(req, res, next) {
        try {
            const validation = createParentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            const ipAddress = req.ip || req.headers['x-forwarded-for'];
            const userAgent = req.headers['user-agent'];

            const parent = await ParentService.create(validation.data, req.user, {
                ipAddress,
                userAgent,
            });
            return res.status(201).json({
                success: true,
                message: 'Parent registered successfully',
                data: parent,
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

            const result = await ParentService.list({
                page,
                pageSize,
                search,
                schoolId: req.user.schoolId,
            });

            return res.status(200).json({
                success: true,
                data: result.parents,
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
            const parent = await ParentService.getById(req.params.id, req.user.schoolId);
            return res.status(200).json({ success: true, data: parent });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const validation = updateParentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            const ipAddress = req.ip || req.headers['x-forwarded-for'];
            const userAgent = req.headers['user-agent'];

            const parent = await ParentService.update(req.params.id, validation.data, req.user, {
                ipAddress,
                userAgent,
            });
            return res.status(200).json({
                success: true,
                message: 'Parent profile updated successfully',
                data: parent,
            });
        } catch (error) {
            next(error);
        }
    }

    static async linkStudent(req, res, next) {
        try {
            const validation = linkStudentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            const link = await ParentService.linkStudent(
                req.params.id,
                validation.data.studentId,
                req.user,
            );
            return res.status(200).json({
                success: true,
                message: 'Student linked to parent successfully',
                data: link,
            });
        } catch (error) {
            next(error);
        }
    }

    static async unlinkStudent(req, res, next) {
        try {
            const result = await ParentService.unlinkStudent(
                req.params.id,
                req.params.studentId,
                req.user,
            );
            return res.status(200).json({ success: true, message: result.message });
        } catch (error) {
            next(error);
        }
    }

    static async updateDesignation(req, res, next) {
        try {
            const validation = updateParentDesignationSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            const ipAddress = req.ip || req.headers['x-forwarded-for'];
            const userAgent = req.headers['user-agent'];
            const updated = await ParentDesignationService.updateDesignation(
                req.params.studentId,
                req.params.parentId,
                validation.data,
                req.user,
                { ipAddress, userAgent },
            );

            return res.status(200).json({
                success: true,
                message: 'Parent designations updated successfully',
                data: updated,
            });
        } catch (error) {
            next(error);
        }
    }
}
