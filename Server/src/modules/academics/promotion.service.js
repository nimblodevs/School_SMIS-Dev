import { runTransaction } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { assertOwnership, resolveSchoolId } from '../../shared/ownership.js';

const PROMOTION_BATCH_LIMIT = 500;

export class PromotionService {
    /**
     * Mass promote students from sourceStream to targetStream.
     *
     * @param {object} input
     * @param {string} input.sourceStreamId
     * @param {string} input.targetStreamId
     * @param {string} input.targetAcademicYearId
     * @param {string[]} input.studentIds
     * @param {boolean} [input.dryRun]   preview without writing
     */
    static async promoteStream(input, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor, input.schoolId);
        const {
            sourceStreamId,
            targetStreamId,
            targetAcademicYearId,
            studentIds,
            dryRun = false,
        } = input;

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            throw new BadRequestError('studentIds must be a non-empty array');
        }
        if (studentIds.length > PROMOTION_BATCH_LIMIT) {
            throw new BadRequestError(
                `Cannot promote more than ${PROMOTION_BATCH_LIMIT} students in one batch`,
            );
        }

        const uniqueStudentIds = [...new Set(studentIds)];

        const result = await runTransaction(async (tx) => {
            // ---- 1. Verify every reference belongs to this school ----
            await assertOwnership(tx, schoolId, [
                { model: 'stream', id: sourceStreamId, label: 'Source stream' },
                { model: 'stream', id: targetStreamId, label: 'Target stream' },
                { model: 'academicYear', id: targetAcademicYearId, label: 'Target academic year' },
            ]);

            // ---- 2. All students must be actively enrolled in the source stream ----
            const activeEnrollments = await tx.enrollment.findMany({
                where: {
                    schoolId,
                    streamId: sourceStreamId,
                    studentId: { in: uniqueStudentIds },
                    status: 'ACTIVE',
                },
                select: { id: true, studentId: true },
            });
            if (activeEnrollments.length !== uniqueStudentIds.length) {
                const found = new Set(activeEnrollments.map((e) => e.studentId));
                const missing = uniqueStudentIds.filter((id) => !found.has(id));
                throw new BadRequestError(
                    `${missing.length} student(s) are not actively enrolled in the source stream`,
                );
            }

            // ---- 3. No student can already have an enrollment in the target year ----
            const existingTarget = await tx.enrollment.findMany({
                where: {
                    schoolId,
                    academicYearId: targetAcademicYearId,
                    studentId: { in: uniqueStudentIds },
                },
                select: { studentId: true },
            });
            if (existingTarget.length > 0) {
                throw new BadRequestError(
                    `${existingTarget.length} student(s) already have an enrollment for the target academic year`,
                );
            }

            if (dryRun) {
                return {
                    dryRun: true,
                    wouldPromote: uniqueStudentIds.length,
                    sourceEnrollmentIds: activeEnrollments.map((e) => e.id),
                };
            }

            // ---- 4. Close the source enrollment as COMPLETED (not GRADUATED) ----
            await tx.enrollment.updateMany({
                where: { id: { in: activeEnrollments.map((e) => e.id) } },
                data: { status: 'COMPLETED' },
            });

            // ---- 5. Create new ACTIVE enrollments in the target ----
            const newEnrollments = uniqueStudentIds.map((studentId) => ({
                schoolId,
                studentId,
                streamId: targetStreamId,
                academicYearId: targetAcademicYearId,
                status: 'ACTIVE',
            }));

            await tx.enrollment.createMany({ data: newEnrollments });

            // ---- 6. Audit ----
            await recordAudit(
                {
                    action: 'UPDATE',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'EnrollmentBatch',
                    entityId: `${sourceStreamId}->${targetStreamId}`,
                    metadata: {
                        sourceStreamId,
                        targetStreamId,
                        targetAcademicYearId,
                        promotedCount: uniqueStudentIds.length,
                    },
                    ...ctx,
                },
                tx,
            );

            return {
                dryRun: false,
                promotedCount: uniqueStudentIds.length,
            };
        });

        return result;
    }
}
