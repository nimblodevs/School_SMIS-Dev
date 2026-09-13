import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../shared/errors/AppError.js';

export class JobsController {
    static async getById(req, res, next) {
        try {
            const job = await prisma.backgroundJob.findFirst({ where: { id: req.params.jobId, schoolId: req.user.schoolId } });
            if (!job) throw new NotFoundError('Background job not found');
            return res.json({ success: true, data: job });
        } catch (error) {
            next(error);
        }
    }
}
