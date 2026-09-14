import { prisma, runTransaction } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { assertOwnership, resolveSchoolId } from '../../shared/ownership.js';

export class ExamsService {
    static async createExam(payload, actor, { ipAddress, userAgent } = {}) {
        const schoolId = resolveSchoolId(actor);
        await assertOwnership(prisma, schoolId, [
            { model: 'term', id: payload.termId, label: 'Term' },
            { model: 'subject', id: payload.subjectId, label: 'Subject' },
        ]);

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
        const schoolId = resolveSchoolId(actor);

        const exam = await prisma.exam.findFirst({
            where: { id: examId, schoolId },
        });
        if (!exam) throw new NotFoundError('Exam not found');

        const enrollmentIds = [...new Set(results.map((result) => result.enrollmentId))];
        const enrollments = await prisma.enrollment.findMany({
            where: { id: { in: enrollmentIds }, schoolId },
            select: { id: true, studentId: true },
        });
        const enrollmentById = new Map(enrollments.map((item) => [item.id, item]));
        if (
            results.some(
                (result) => enrollmentById.get(result.enrollmentId)?.studentId !== result.studentId,
            )
        ) {
            throw new BadRequestError('Every result must reference a matching school enrollment');
        }

        const processed = await runTransaction(async (tx) => {
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
