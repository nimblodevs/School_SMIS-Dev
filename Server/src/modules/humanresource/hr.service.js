import { prisma } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';

export class HRService {
    static async resetLeaveBalances(schoolId, year) {
        const [leaveTypes, teachers, staff] = await Promise.all([
            prisma.leaveType.findMany({ where: { schoolId } }),
            prisma.teacher.findMany({ where: { schoolId }, select: { id: true, employeeKey: true } }),
            prisma.staff.findMany({ where: { schoolId }, select: { id: true, employeeKey: true } }),
        ]);

        const employees = [
            ...teachers.map((employee) => ({ ...employee, teacherId: employee.id, staffId: null })),
            ...staff.map((employee) => ({ ...employee, teacherId: null, staffId: employee.id })),
        ];
        return prisma.$transaction(
            employees.flatMap((employee) => leaveTypes.map((leaveType) => prisma.leaveBalance.upsert({
                where: {
                    leaveTypeId_employeeKey_year: {
                        leaveTypeId: leaveType.id,
                        employeeKey: employee.employeeKey,
                        year,
                    },
                },
                update: { allocatedDays: leaveType.daysAllowedPerYear, usedDays: 0, teacherId: employee.teacherId, staffId: employee.staffId },
                create: { schoolId, leaveTypeId: leaveType.id, employeeKey: employee.employeeKey, teacherId: employee.teacherId, staffId: employee.staffId, year, allocatedDays: leaveType.daysAllowedPerYear, usedDays: 0 },
            }))),
        );
    }

    static async requestLeave(payload, actor) {
        const schoolId = actor.schoolId;

        return prisma.leaveRequest.create({
            data: {
                schoolId,
                leaveTypeId: payload.leaveTypeId,
                teacherId: payload.teacherId,
                staffId: payload.staffId,
                startDate: new Date(payload.startDate),
                endDate: new Date(payload.endDate),
                reason: payload.reason,
                status: 'PENDING',
            },
        });
    }

    static async approveLeave(leaveRequestId, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;

        return prisma.$transaction(async (tx) => {
            const leave = await tx.leaveRequest.findFirst({
                where: { id: leaveRequestId, schoolId },
                include: { leaveType: true },
            });
            if (!leave) throw new NotFoundError('Leave request not found');

            const updated = await tx.leaveRequest.update({
                where: { id: leaveRequestId },
                data: {
                    status: 'APPROVED',
                    approvedById: actor.id,
                    approvedAt: new Date(),
                },
            });

            // Calculate days difference
            const diffTime = Math.abs(new Date(leave.endDate) - new Date(leave.startDate));
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // Decrement balance using the compound key
            const employeeKey = leave.teacherId ? `T:${leave.teacherId}` : `S:${leave.staffId}`;
            const currentYear = new Date(leave.startDate).getFullYear();

            await tx.leaveBalance.updateMany({
                where: {
                    schoolId,
                    leaveTypeId: leave.leaveTypeId,
                    employeeKey,
                    year: currentYear,
                },
                data: {
                    usedDays: { increment: days },
                },
            });

            await recordAudit({
                action: 'UPDATE',
                actorId: actor.id,
                schoolId,
                entityType: 'LeaveRequest',
                entityId: leaveRequestId,
                metadata: { status: 'APPROVED', daysDeducted: days },
                ipAddress,
                userAgent,
            });

            return updated;
        });
    }
}