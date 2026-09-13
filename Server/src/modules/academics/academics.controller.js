import { AcademicsService } from './academics.service.js';
import {
    createAcademicYearSchema,
    createTermSchema,
    createClassLevelSchema,
    createStreamSchema,
    createSubjectSchema,
    assignTeacherSubjectSchema,
    assignClassSubjectSchema,
} from './academics.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class AcademicsController {
    // Academic Years
    static async createAcademicYear(req, res, next) {
        try {
            const validation = createAcademicYearSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());

            const data = await AcademicsService.createAcademicYear(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(201).json({ success: true, message: 'Academic Year created', data });
        } catch (err) {
            next(err);
        }
    }

    static async listAcademicYears(req, res, next) {
        try {
            const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.schoolId : req.user.schoolId;
            const data = await AcademicsService.listAcademicYears(schoolId);
            return res.status(200).json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    // Terms
    static async createTerm(req, res, next) {
        try {
            const validation = createTermSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());

            const data = await AcademicsService.createTerm(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(201).json({ success: true, message: 'Term created successfully', data });
        } catch (err) {
            next(err);
        }
    }

    // Class Levels & Streams
    static async createClassLevel(req, res, next) {
        try {
            const validation = createClassLevelSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());

            const data = await AcademicsService.createClassLevel(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(201).json({ success: true, message: 'Class level created', data });
        } catch (err) {
            next(err);
        }
    }

    static async listClassLevels(req, res, next) {
        try {
            const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.schoolId : req.user.schoolId;
            const data = await AcademicsService.listClassLevels(schoolId);
            return res.status(200).json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    static async createStream(req, res, next) {
        try {
            const validation = createStreamSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());

            const data = await AcademicsService.createStream(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(201).json({ success: true, message: 'Stream created', data });
        } catch (err) {
            next(err);
        }
    }

    // Subjects & Assignments
    static async createSubject(req, res, next) {
        try {
            const validation = createSubjectSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());

            const data = await AcademicsService.createSubject(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(201).json({ success: true, message: 'Subject created', data });
        } catch (err) {
            next(err);
        }
    }

    static async listSubjects(req, res, next) {
        try {
            const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.schoolId : req.user.schoolId;
            const data = await AcademicsService.listSubjects(schoolId);
            return res.status(200).json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    static async assignTeacherSubject(req, res, next) {
        try {
            const validation = assignTeacherSubjectSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());

            const data = await AcademicsService.assignTeacherSubject(validation.data);
            return res.status(200).json({ success: true, message: 'Subject assigned to teacher', data });
        } catch (err) {
            next(err);
        }
    }

    static async assignClassSubject(req, res, next) {
        try {
            const validation = assignClassSubjectSchema.safeParse(req.body);
            if (!validation.success) throw new BadRequestError('Validation error', validation.error.format());

            const data = await AcademicsService.assignClassSubject(validation.data, req.user);
            return res.status(200).json({ success: true, message: 'Subject allocated to stream', data });
        } catch (err) {
            next(err);
        }
    }
}