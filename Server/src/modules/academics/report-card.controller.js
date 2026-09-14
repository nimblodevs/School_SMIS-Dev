import { z } from 'zod';
import { ReportCardService } from './report-card.service.js';
import { enqueueJob, JOB_TYPES } from '../../shared/background-jobs.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

const UuidString = z.string().uuid('Invalid UUID');

const reportQuerySchema = z.object({
    rankBy: z.enum(['STREAM', 'CLASS_LEVEL']).default('STREAM'),
});

function parse(schema, payload) {
    const result = schema.safeParse(payload);
    if (!result.success) {
        const flat = result.error.flatten();
        const details = {};
        for (const [field, messages] of Object.entries(flat.fieldErrors)) {
            if (messages?.length) details[field] = messages[0];
        }
        throw new BadRequestError('Validation failed', details);
    }
    return result.data;
}

export class ReportCardController {
    static async getTermReports(req, res, next) {
        try {
            const termId = parse(UuidString, req.params.termId);
            const studentId = req.params.studentId ? parse(UuidString, req.params.studentId) : null;
            const { rankBy } = parse(reportQuerySchema, req.query);

            const data = await ReportCardService.generateTermReports(termId, req.user, {
                studentId,
                rankBy,
            });
            return res.status(200).json({ success: true, data });
        } catch (err) {
            return next(err);
        }
    }

    static async queueReportCardPdf(req, res, next) {
        try {
            const termId = parse(UuidString, req.params.termId);
            const studentId = parse(UuidString, req.params.studentId);

            // Verify the caller can see this student before enqueueing.
            // generateTermReports throws ForbiddenError if not — call it read-only.
            await ReportCardService.generateTermReports(termId, req.user, {
                studentId,
                rankBy: 'STREAM',
            });

            const job = await enqueueJob({
                type: JOB_TYPES.REPORT_CARD_PDF,
                schoolId: req.user.schoolId,
                payload: { termId, studentId, actorId: req.user.id },
            });

            return res.status(202).json({
                success: true,
                message: 'Report card generation queued',
                data: { jobId: job.id },
            });
        } catch (err) {
            return next(err);
        }
    }
}
