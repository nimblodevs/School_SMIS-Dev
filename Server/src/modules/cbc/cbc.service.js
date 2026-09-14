import { prisma } from '../../config/prisma.js';
import { BadRequestError, ForbiddenError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { userHasModuleAccess } from '../../api/middlewares/roleMiddleware.js';

export class CBCService {
    static async recordAssessment(payload, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

        const [enrollment, subStrand, term] = await Promise.all([
            prisma.enrollment.findFirst({
                where: { id: payload.enrollmentId, studentId: payload.studentId, schoolId },
                select: { academicYearId: true },
            }),
            prisma.subStrand.findFirst({
                where: { id: payload.subStrandId, schoolId },
                select: { id: true },
            }),
            prisma.term.findFirst({
                where: { id: payload.termId, schoolId },
                select: { academicYearId: true },
            }),
        ]);
        if (
            !enrollment ||
            !subStrand ||
            !term ||
            enrollment.academicYearId !== term.academicYearId
        ) {
            throw new BadRequestError(
                'Assessment references must belong to the same student, school, and academic year',
            );
        }

        // Appends an assessment history record without clobbering past assessments
        const assessment = await prisma.competencyAssessment.create({
            data: {
                schoolId,
                studentId: payload.studentId,
                enrollmentId: payload.enrollmentId,
                subStrandId: payload.subStrandId,
                termId: payload.termId,
                level: payload.level,
                remarks: payload.remarks,
                assessedById: actor.id,
                assessedAt: payload.assessedAt ? new Date(payload.assessedAt) : new Date(),
            },
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'CompetencyAssessment',
            entityId: assessment.id,
            metadata: payload,
            ipAddress,
            userAgent,
        });

        return assessment;
    }

    static async getLatestStudentAssessments(studentId, termId, actor) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new ForbiddenError('User is not associated with a school');

        if (actor.role === 'PARENT') {
            const linked = await prisma.parent.findFirst({
                where: { userId: actor.id, schoolId, students: { some: { studentId } } },
                select: { id: true },
            });
            if (!linked) throw new ForbiddenError('You do not have access to this student');
        } else if (actor.role === 'STUDENT') {
            const student = await prisma.student.findFirst({
                where: { id: studentId, userId: actor.id, schoolId },
                select: { id: true },
            });
            if (!student) throw new ForbiddenError('You do not have access to this student');
        } else if (!userHasModuleAccess(actor, 'CBC')) {
            throw new ForbiddenError('Access denied to the CBC module');
        }

        // Fetches top distinct assessments per subStrand for a term
        return prisma.competencyAssessment.findMany({
            where: { schoolId, studentId, termId },
            orderBy: { assessedAt: 'desc' },
            distinct: ['subStrandId'],
            include: {
                subStrand: {
                    include: {
                        strand: {
                            include: { learningArea: true },
                        },
                    },
                },
            },
        });
    }
}
