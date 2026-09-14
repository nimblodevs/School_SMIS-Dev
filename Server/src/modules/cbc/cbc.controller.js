import { CBCService } from './cbc.service.js';
import { recordAssessmentSchema } from './cbc.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class CBCController {
    static async recordAssessment(req, res, next) {
        try {
            const validation = recordAssessmentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const assessment = await CBCService.recordAssessment(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            return res.status(201).json({
                success: true,
                message: 'Competency assessment saved successfully',
                data: assessment,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getStudentAssessments(req, res, next) {
        try {
            const { studentId, termId } = req.params;
            const data = await CBCService.getLatestStudentAssessments(studentId, termId, req.user);

            return res.status(200).json({
                success: true,
                data,
            });
        } catch (error) {
            next(error);
        }
    }
}
