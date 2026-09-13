import { prisma } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';

export class ExamsService {
    static async createExam(payload, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

        const exam = await prisma.exam.create({
            data: {
                schoolId,
                name: payload.name,
                termId: payload.termId,
                subjectId: payload.subjectId,
                examDate: new Date(payload.examDate),
                maxScore: payload.maxScore ?? 100,
            },
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Exam',
            entityId: exam.id,
            metadata: payload,
            ipAddress,
            userAgent,
        });

        return exam;
    }

    static async recordBulkResults(examId, results, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;

        const exam = await prisma.exam.findFirst({
            where: { id: examId, schoolId },
        });
        if (!exam) throw new NotFoundError('Exam not found');

        const processed = await prisma.$transaction(async (tx) => {
            const ops = results.map((res) => {
                if (Number(res.score) > Number(exam.maxScore)) {
                    throw new BadRequestError(`Score ${res.score} exceeds max score of ${exam.maxScore}`);
                }
                return tx.examResult.upsert({
                    where: {
                        examId_studentId: {
                            examId,
                            studentId: res.studentId,
                        },
                    },
                    update: {
                        score: res.score,
                        grade: res.grade,
                        remarks: res.remarks,
                    },
                    create: {
                        schoolId,
                        examId,
                        studentId: res.studentId,
                        enrollmentId: res.enrollmentId,
                        score: res.score,
                        grade: res.grade,
                        remarks: res.remarks,
                    },
                });
            });
            return Promise.all(ops);
        });

        await recordAudit({
            action: 'UPDATE',
            actorId: actor.id,
            schoolId,
            entityType: 'ExamResult',
            entityId: examId,
            metadata: { count: results.length },
            ipAddress,
            userAgent,
        });

        return processed;
    }
}