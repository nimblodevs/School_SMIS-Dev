import { prisma } from '../../config/prisma.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class AuditController {
    static async list(req, res, next) {
        try {
            const page = Number.parseInt(req.query.page ?? '1', 10);
            const pageSize = Number.parseInt(req.query.pageSize ?? '50', 10);

            if (
                !Number.isInteger(page) ||
                page < 1 ||
                !Number.isInteger(pageSize) ||
                pageSize < 1 ||
                pageSize > 100
            ) {
                throw new BadRequestError(
                    'page must be >= 1 and pageSize must be between 1 and 100',
                );
            }

            const where = { schoolId: req.user.schoolId };
            if (req.query.from || req.query.to) {
                const from = req.query.from ? new Date(req.query.from) : null;
                const to = req.query.to ? new Date(req.query.to) : null;
                if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
                    throw new BadRequestError('from and to must be valid dates');
                }
                where.createdAt = {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                };
            }
            if (req.query.action) where.action = req.query.action;
            if (req.query.entityType) where.entityType = req.query.entityType;
            if (req.query.actorId) where.actorId = req.query.actorId;

            const [items, total] = await prisma.$transaction([
                prisma.auditLog.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                prisma.auditLog.count({ where }),
            ]);

            return res.json({
                success: true,
                data: items,
                pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
            });
        } catch (error) {
            return next(error);
        }
    }
}
