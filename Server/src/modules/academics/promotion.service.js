import { prisma } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class PromotionService {
    /**
     * Mass promotes students from sourceStream to targetStream.
     */
    static async promoteStream({ sourceStreamId, targetStreamId, targetAcademicYearId, studentIds }, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

        const result = await prisma.$transaction(async (tx) => {
            // 1. Mark existing active enrollments as COMPLETED
            await tx.enrollment.updateMany({
                where: {
                    schoolId,
                    streamId: sourceStreamId,
                    studentId: { in: studentIds },
                    status: 'ACTIVE',
                },
                data: { status: 'COMPLETED' },
            });

            // 2. Create new ACTIVE enrollments in the target stream
            const newEnrollments = studentIds.map((studentId) => ({
                schoolId,
                studentId,
                streamId: targetStreamId,
                academicYearId: targetAcademicYearId,
                status: 'ACTIVE',
            }));

            await tx.enrollment.createMany({
                data: newEnrollments,
            });

            return { promotedCount: studentIds.length };
        });

        await recordAudit({
            action: 'UPDATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Enrollment',
            entityId: sourceStreamId,
            metadata: { targetStreamId, count: result.promotedCount },
            ipAddress,
            userAgent,
        });

        return result;
    }
}