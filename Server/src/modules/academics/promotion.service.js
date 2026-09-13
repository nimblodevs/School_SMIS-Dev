import { prisma, runTransaction } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class PromotionService {
    /**
     * Mass promotes students from sourceStream to targetStream.
     */
    static async promoteStream({ sourceStreamId, targetStreamId, targetAcademicYearId, studentIds }, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

        const result = await runTransaction(async (tx) => {
            const uniqueStudentIds = [...new Set(studentIds)];
            const [sourceStream, targetStream, targetYear, activeEnrollments] = await Promise.all([
                tx.stream.findFirst({ where: { id: sourceStreamId, schoolId }, select: { id: true } }),
                tx.stream.findFirst({ where: { id: targetStreamId, schoolId }, select: { id: true } }),
                tx.academicYear.findFirst({ where: { id: targetAcademicYearId, schoolId }, select: { id: true } }),
                tx.enrollment.findMany({ where: { schoolId, streamId: sourceStreamId, studentId: { in: uniqueStudentIds }, status: 'ACTIVE' }, select: { studentId: true } }),
            ]);
            if (!sourceStream || !targetStream || !targetYear) throw new BadRequestError('Promotion references do not belong to this school');
            if (activeEnrollments.length !== uniqueStudentIds.length) throw new BadRequestError('One or more students are not active in the source stream');

            const existingTarget = await tx.enrollment.findMany({ where: { schoolId, academicYearId: targetAcademicYearId, studentId: { in: uniqueStudentIds } }, select: { studentId: true } });
            if (existingTarget.length) throw new BadRequestError('One or more students already have an enrollment for the target academic year');

            await tx.enrollment.updateMany({
                where: {
                    schoolId,
                    streamId: sourceStreamId,
                    studentId: { in: uniqueStudentIds },
                    status: 'ACTIVE',
                },
                data: { status: 'GRADUATED' },
            });

            // 2. Create new ACTIVE enrollments in the target stream
            const newEnrollments = uniqueStudentIds.map((studentId) => ({
                schoolId,
                studentId,
                streamId: targetStreamId,
                academicYearId: targetAcademicYearId,
                status: 'ACTIVE',
            }));

            await tx.enrollment.createMany({
                data: newEnrollments,
            });

            return { promotedCount: uniqueStudentIds.length };
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