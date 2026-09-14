import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { resolveSchoolId } from '../../shared/ownership.js';

export class JobsController {
    static async getById(req, res, next) {
        try {
            const schoolId = resolveSchoolId(req.user);
            const job = await prisma.backgroundJob.findFirst({
                where: { id: req.params.jobId, schoolId },
            });
            if (!job) throw new NotFoundError('Background job not found');
            const canReadSchoolJobs = ['ADMIN', 'MANAGER'].includes(req.user.role);
            if (!canReadSchoolJobs && job.payload?.actorId !== req.user.id) {
                throw new NotFoundError('Background job not found');
            }
            return res.json({ success: true, data: job });
        } catch (error) {
            next(error);
        }
    }
}
