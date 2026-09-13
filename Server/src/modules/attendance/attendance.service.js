import { prisma } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';

export class AttendanceService {
    static async markClassAttendance({ date, streamId, attendances }, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

        const formattedDate = new Date(date);

        const result = await prisma.$transaction(async (tx) => {
            // Validate stream exists
            const stream = await tx.stream.findFirst({
                where: { id: streamId, schoolId },
            });
            if (!stream) throw new NotFoundError('Stream not found within school');

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