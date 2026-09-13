import { BadRequestError } from '../../shared/errors/AppError.js';
import { SchoolService } from './school.service.js';
import { createSchoolSchema, schoolIdSchema, updateSchoolSchema, updateSchoolSettingsSchema } from './school.validation.js';

function pagination(query) {
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize ?? '50', 10)));
    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) throw new BadRequestError('Invalid pagination parameters');
    return { page, pageSize };
}

export class SchoolController {
    static async create(req, res, next) {
        try {
            const validation = createSchoolSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());
            const school = await SchoolService.create(validation.data, req.user, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
            return res.status(201).json({ success: true, data: school });
        } catch (error) {
            next(error);
        }
    }

    static async list(req, res, next) {
        try {
            const { page, pageSize } = pagination(req.query);
            const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : null;
            if (isActive === null) throw new BadRequestError('isActive must be true or false');
            const result = await SchoolService.list({ page, pageSize, search: req.query.search?.trim(), isActive });
            return res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async current(req, res, next) {
        try {
            if (!req.user.schoolId) throw new BadRequestError('The current user is not assigned to a school');
            const school = await SchoolService.getById(req.user.schoolId, req.user);
            return res.json({ success: true, data: school });
        } catch (error) {
            next(error);
        }
    }

    static async getById(req, res, next) {
        try {
            const validation = schoolIdSchema.safeParse(req.params);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());
            const school = await SchoolService.getById(validation.data.schoolId, req.user);
            return res.json({ success: true, data: school });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const params = schoolIdSchema.safeParse(req.params);
            if (!params.success) throw new BadRequestError('Validation error', params.error.format());
            const validation = updateSchoolSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());
            const school = await SchoolService.update(params.data.schoolId, validation.data, req.user, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
            return res.json({ success: true, data: school });
        } catch (error) {
            next(error);
        }
    }

    static async getSettings(req, res, next) {
        try {
            const validation = schoolIdSchema.safeParse(req.params);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());
            const settings = await SchoolService.getSettings(validation.data.schoolId, req.user);
            return res.json({ success: true, data: settings });
        } catch (error) {
            next(error);
        }
    }

    static async updateSettings(req, res, next) {
        try {
            const params = schoolIdSchema.safeParse(req.params);
            if (!params.success) throw new BadRequestError('Validation error', params.error.format());
            const validation = updateSchoolSettingsSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());
            const settings = await SchoolService.updateSettings(params.data.schoolId, validation.data, req.user, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
            return res.json({ success: true, data: settings });
        } catch (error) {
            next(error);
        }
    }
}
