import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../shared/errors/AppError.js';

export class JobsController {
    static async getById(req, res, next) {
        try {
            const canViewAllSchoolJobs = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
            const job = await prisma.backgroundJob.findFirst({
                where: {
                    id: req.params.jobId,
                    schoolId: req.user.schoolId,
                    ...(!canViewAllSchoolJobs
                        ? { payload: { path: ['actorId'], equals: req.user.id } }
                        : {}),
                },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    attempts: true,
                    maxAttempts: true,
                    completedAt: true,
                    error: true,
                    result: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            if (!job) throw new NotFoundError('Background job not found');
            return res.json({ success: true, data: job });
        } catch (error) {
            next(error);
        }
    }
}
