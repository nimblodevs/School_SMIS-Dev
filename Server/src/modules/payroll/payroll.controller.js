import { executePayrollSchema } from './payroll.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { enqueueJob, JOB_TYPES } from '../../shared/background-jobs.js';

export class PayrollController {
    static async executeRun(req, res, next) {
        try {
            const validation = executePayrollSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const job = await enqueueJob({
                type: JOB_TYPES.PAYROLL_RUN,
                schoolId: req.user.schoolId,
                payload: { month: validation.data.month, actorId: req.user.id },
            });

            return res.status(202).json({
                success: true,
                message: 'Payroll execution queued',
                data: { jobId: job.id },
            });
        } catch (error) {
            next(error);
        }
    }
}