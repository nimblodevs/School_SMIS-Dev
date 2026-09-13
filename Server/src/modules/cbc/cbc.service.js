import { prisma } from '../../config/prisma.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';

export class CBCService {
    static async recordAssessment(payload, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

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