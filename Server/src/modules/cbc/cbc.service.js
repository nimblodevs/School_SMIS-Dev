import { prisma } from '../../config/prisma.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { resolveSchoolId } from '../../shared/ownership.js';

export class CBCService {
    static async recordAssessment(payload, actor, { ipAddress, userAgent } = {}) {
        const schoolId = resolveSchoolId(actor);

        const [enrollment, subStrand, term] = await Promise.all([
            prisma.enrollment.findFirst({
                where: {
                    id: payload.enrollmentId,
                    studentId: payload.studentId,
                    schoolId,
                },
                select: { id: true },
            }),
            prisma.subStrand.findFirst({
                where: { id: payload.subStrandId, schoolId },
                select: { id: true },
            }),
            prisma.term.findFirst({
                where: { id: payload.termId, schoolId },
                select: { id: true },
            }),
        ]);
        if (!enrollment || !subStrand || !term) {
            throw new BadRequestError('Assessment references must belong to this school');
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

    static async getLatestStudentAssessments(studentId, termId, schoolId) {
        if (!schoolId) throw new BadRequestError('A school must be selected');
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
