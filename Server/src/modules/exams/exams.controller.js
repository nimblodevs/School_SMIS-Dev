import { ExamsService } from './exams.service.js';
import { createExamSchema, recordBulkResultsSchema } from './exams.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class ExamsController {
    static async createExam(req, res, next) {
        try {
            const validation = createExamSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const exam = await ExamsService.createExam(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            return res.status(201).json({
                success: true,
                message: 'Exam schedule created successfully',
                data: exam,
            });
        } catch (error) {
            next(error);
        }
    }

    static async recordResults(req, res, next) {
        try {
            const { examId } = req.params;
            const validation = recordBulkResultsSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const results = await ExamsService.recordBulkResults(
                examId,
                validation.data.results,
                req.user,
                { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
            );

            return res.status(200).json({
                success: true,
                message: 'Exam results recorded successfully',
                data: results,
            });
        } catch (error) {
            next(error);
        }
    }
}
