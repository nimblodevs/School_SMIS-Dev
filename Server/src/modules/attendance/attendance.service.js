import { prisma, runTransaction } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';

export class AttendanceService {
    static async markClassAttendance({ date, streamId, attendances }, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
            throw new BadRequestError('date must use YYYY-MM-DD format');
        }
        const formattedDate = new Date(`${date}T00:00:00Z`);

        const result = await runTransaction(async (tx) => {
            // Validate stream exists
            const stream = await tx.stream.findFirst({
                where: { id: streamId, schoolId },
            });
            if (!stream) throw new NotFoundError('Stream not found within school');

            const enrollmentIds = [...new Set(attendances.map((record) => record.enrollmentId))];
            const enrollments = await tx.enrollment.findMany({
                where: { id: { in: enrollmentIds }, schoolId, streamId },
                select: { id: true, studentId: true },
            });
            const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));
            for (const record of attendances) {
                const enrollment = enrollmentById.get(record.enrollmentId);
                if (!enrollment || enrollment.studentId !== record.studentId) {
                    throw new BadRequestError('Attendance student and enrollment do not match this stream');
                }
            }

            const operations = attendances.map((record) => {
                return tx.attendance.upsert({
                    where: {
                        studentId_date: {
                            studentId: record.studentId,
                            date: formattedDate,
                        },
                    },
                    update: {
                        status: record.status,
                        markedById: actor.id,
                    },
                    create: {
                        schoolId,
                        studentId: record.studentId,
                        enrollmentId: record.enrollmentId,
                        date: formattedDate,
                        status: record.status,
                        markedById: actor.id,
                    },
                });
            });

            return Promise.all(operations);
        });

        await recordAudit({
            action: 'UPDATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Attendance',
            entityId: streamId,
            metadata: { count: attendances.length, date },
            ipAddress,
            userAgent,
        });

        return result;
    }

    static async getAttendanceRegister({ streamId, date }, schoolId) {
        return prisma.attendance.findMany({
            where: {
                schoolId,
                date: new Date(date),
                enrollment: { streamId },
            },
            include: {
                student: {
                    select: { id: true, admissionNo: true, firstName: true, lastName: true },
                },
            },
        });
    }
}