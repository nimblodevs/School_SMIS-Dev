import { ReportCardService } from './report-card.service.js';
import { enqueueJob, JOB_TYPES } from '../../shared/background-jobs.js';

export class ReportCardController {
    static async getTermReports(req, res, next) {
        try {
            const data = await ReportCardService.generateTermReports(
                req.params.termId,
                req.user,
                req.params.studentId || null,
            );
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    static async queueReportCardPdf(req, res, next) {
        try {
            const job = await enqueueJob({
                type: JOB_TYPES.REPORT_CARD_PDF,
                schoolId: req.user.schoolId,
                payload: { termId: req.params.termId, studentId: req.params.studentId, actorId: req.user.id },
            });
            return res.status(202).json({ success: true, message: 'Report card generation queued', data: { jobId: job.id } });
        } catch (error) {
            next(error);
        }
    }
}
