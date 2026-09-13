import { AcademicsService } from './academics.service.js';
import {
    createAcademicYearSchema,
    createTermSchema,
    createClassLevelSchema,
    createStreamSchema,
    createSubjectSchema,
    assignTeacherSubjectSchema,
    assignClassSubjectSchema,
    listQuerySchema,
} from './academics.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

function parse(schema, payload) {
    const result = schema.safeParse(payload);
    if (!result.success) {
        // Flatten to { field: message } so we don't leak Zod internals.
        const flat = result.error.flatten();
        const details = {};
        for (const [field, messages] of Object.entries(flat.fieldErrors)) {
            if (messages && messages.length) details[field] = messages[0];
        }
        for (const message of flat.formErrors) {
            details._form = message;
        }
        throw new BadRequestError('Validation failed', details);
    }
    return result.data;
}

const ctxOf = (req) => ({
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
});

export class AcademicsController {
    // ---------------------------------------------------------------------
    // Academic Years
    // ---------------------------------------------------------------------

    static async createAcademicYear(req, res, next) {
        try {
            const input = parse(createAcademicYearSchema, req.body);
            const data = await AcademicsService.createAcademicYear(input, req.user, ctxOf(req));
            return res.status(201).json({ success: true, message: 'Academic year created', data });
        } catch (err) {
            return next(err);
        }
    }

    static async listAcademicYears(req, res, next) {
        try {
            const query = parse(listQuerySchema, req.query);
            const data = await AcademicsService.listAcademicYears(req.user, query);
            return res.status(200).json({ success: true, data });
        } catch (err) {
            return next(err);
        }
    }

    // ---------------------------------------------------------------------
    // Terms
    // ---------------------------------------------------------------------

    static async createTerm(req, res, next) {
        try {
            const input = parse(createTermSchema, req.body);
            const data = await AcademicsService.createTerm(input, req.user, ctxOf(req));
            return res.status(201).json({ success: true, message: 'Term created', data });
        } catch (err) {
            return next(err);
        }
    }

    // ---------------------------------------------------------------------
    // Class Levels
    // ---------------------------------------------------------------------

    static async createClassLevel(req, res, next) {
        try {
            const input = parse(createClassLevelSchema, req.body);
            const data = await AcademicsService.createClassLevel(input, req.user, ctxOf(req));
            return res.status(201).json({ success: true, message: 'Class level created', data });
        } catch (err) {
            return next(err);
        }
    }

    static async listClassLevels(req, res, next) {
        try {
            const query = parse(listQuerySchema, req.query);
            const data = await AcademicsService.listClassLevels(req.user, query);
            return res.status(200).json({ success: true, data });
        } catch (err) {
            return next(err);
        }
    }

    // ---------------------------------------------------------------------
    // Streams
    // ---------------------------------------------------------------------

    static async createStream(req, res, next) {
        try {
            const input = parse(createStreamSchema, req.body);
            const data = await AcademicsService.createStream(input, req.user, ctxOf(req));
            return res.status(201).json({ success: true, message: 'Stream created', data });
        } catch (err) {
            return next(err);
        }
    }

    // ---------------------------------------------------------------------
    // Subjects
    // ---------------------------------------------------------------------

    static async createSubject(req, res, next) {
        try {
            const input = parse(createSubjectSchema, req.body);
            const data = await AcademicsService.createSubject(input, req.user, ctxOf(req));
            return res.status(201).json({ success: true, message: 'Subject created', data });
        } catch (err) {
            return next(err);
        }
    }

    static async listSubjects(req, res, next) {
        try {
            const query = parse(listQuerySchema, req.query);
            const data = await AcademicsService.listSubjects(req.user, query);
            return res.status(200).json({ success: true, data });
        } catch (err) {
            return next(err);
        }
    }

    // ---------------------------------------------------------------------
    // Assignments
    // ---------------------------------------------------------------------

    static async assignTeacherSubject(req, res, next) {
        try {
            const input = parse(assignTeacherSubjectSchema, req.body);
            const data = await AcademicsService.assignTeacherSubject(input, req.user, ctxOf(req));
            return res.status(201).json({ success: true, message: 'Subject assigned to teacher', data });
        } catch (err) {
            return next(err);
        }
    }

    static async assignClassSubject(req, res, next) {
        try {
            const input = parse(assignClassSubjectSchema, req.body);
            const data = await AcademicsService.assignClassSubject(input, req.user, ctxOf(req));
            return res.status(201).json({ success: true, message: 'Subject allocated to stream', data });
        } catch (err) {
            return next(err);
        }
    }
}