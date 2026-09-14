import { runTransaction } from '../../config/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';

export class HRService {
    /**
     * Reset leave balances for a new year. Idempotent.
     * Runs inside a single transaction — all-or-nothing.
     */
    static async resetLeaveBalances(schoolId, year, actor, ctx = {}) {
        if (!Number.isInteger(year)) throw new BadRequestError('year must be an integer');

        return runTransaction(async (tx) => {
            const [leaveTypes, teachers, staff] = await Promise.all([
                tx.leaveType.findMany({ where: { schoolId } }),
                tx.teacher.findMany({
                    where: { schoolId },
                    select: { id: true, employeeKey: true },
                }),
                tx.staff.findMany({ where: { schoolId }, select: { id: true, employeeKey: true } }),
            ]);

            const employees = [
                ...teachers.map((t) => ({
                    employeeKey: t.employeeKey,
                    teacherId: t.id,
                    staffId: null,
                })),
                ...staff.map((s) => ({
                    employeeKey: s.employeeKey,
                    teacherId: null,
                    staffId: s.id,
                })),
            ];

            // Build all upserts as Prisma promises bound to `tx`
            const ops = employees.flatMap((emp) =>
                leaveTypes.map((lt) =>
                    tx.leaveBalance.upsert({
                        where: {
                            leaveTypeId_employeeKey_year: {
                                leaveTypeId: lt.id,
                                employeeKey: emp.employeeKey,
                                year,
                            },
                        },
                        update: {
                            allocatedDays: lt.daysAllowedPerYear,
                            usedDays: 0,
                            teacherId: emp.teacherId,
                            staffId: emp.staffId,
                        },
                        create: {
                            schoolId,
                            leaveTypeId: lt.id,
                            employeeKey: emp.employeeKey,
                            teacherId: emp.teacherId,
                            staffId: emp.staffId,
                            year,
                            allocatedDays: lt.daysAllowedPerYear,
                            usedDays: 0,
                        },
                    }),
                ),
            );

            await Promise.all(ops);

            await recordAudit(
                {
                    action: 'UPDATE',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'LeaveBalance',
                    entityId: `year:${year}`,
                    metadata: { year, employees: employees.length, leaveTypes: leaveTypes.length },
                    ...ctx,
                },
                tx,
            );

            return { employees: employees.length, leaveTypes: leaveTypes.length };
        });
    }

    static async requestLeave(payload, actor, ctx = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new ForbiddenError('User is not associated with a school');
        const start = new Date(payload.startDate);
        const end = new Date(payload.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new BadRequestError('Invalid dates');
        }
        if (end < start) throw new BadRequestError('endDate must be >= startDate');

        if ((payload.teacherId && payload.staffId) || (!payload.teacherId && !payload.staffId)) {
            throw new BadRequestError('Exactly one of teacherId or staffId must be provided');
        }

        return runTransaction(async (tx) => {
            const target = payload.teacherId
                ? await tx.teacher.findFirst({
                      where: { id: payload.teacherId, schoolId },
                      select: { userId: true },
                  })
                : await tx.staff.findFirst({
                      where: { id: payload.staffId, schoolId },
                      select: { userId: true },
                  });
            if (!target) throw new NotFoundError('Employee profile not found in this school');
            if (
                !['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(actor.role) &&
                target.userId !== actor.id
            ) {
                throw new ForbiddenError(
                    'You may only request leave for your own employee profile',
                );
            }

            const request = await tx.leaveRequest.create({
                data: {
                    schoolId,
                    leaveTypeId: payload.leaveTypeId,
                    teacherId: payload.teacherId ?? null,
                    staffId: payload.staffId ?? null,
                    startDate: start,
                    endDate: end,
                    reason: payload.reason ?? null,
                    status: 'PENDING',
                },
            });
            await recordAudit(
                {
                    action: 'CREATE',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'LeaveRequest',
                    entityId: request.id,
                    ...ctx,
                },
                tx,
            );
            return request;
        });
    }

    /**
     * Approve a leave request. Locks the balance row, validates sufficient days,
     * decrements usedDays, and writes an audit event — all in one transaction.
     */
    static async approveLeave(leaveRequestId, actor, ctx = {}) {
        const schoolId = actor.schoolId;

        return runTransaction(async (tx) => {
            const leave = await tx.leaveRequest.findFirst({
                where: { id: leaveRequestId, schoolId },
                include: { leaveType: true },
            });
            if (!leave) throw new NotFoundError('Leave request not found');
            if (leave.status !== 'PENDING') {
                throw new BadRequestError(`Cannot approve a ${leave.status} request`);
            }

            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            if (end < start) throw new BadRequestError('Invalid leave dates');

            // Count working days (Mon-Fri). Adjust to your school calendar.
            const days = HRService._workingDaysBetween(start, end);
            if (days <= 0) throw new BadRequestError('Leave must include at least one working day');

            const employeeKey = leave.teacherId ? `T:${leave.teacherId}` : `S:${leave.staffId}`;
            const year = start.getUTCFullYear();

            // Lock balance row
            const [balance] = await tx.$queryRaw`
        SELECT id, allocated_days, used_days
        FROM leave_balances
        WHERE school_id = ${schoolId}::uuid
          AND leave_type_id = ${leave.leaveTypeId}::uuid
          AND employee_key = ${employeeKey}
          AND year = ${year}
        FOR UPDATE
      `;
            if (!balance) {
                throw new BadRequestError(
                    `No leave balance configured for ${employeeKey} / ${year}. Run resetLeaveBalances first.`,
                );
            }
            const remaining = balance.allocated_days - balance.used_days;
            if (remaining < days) {
                throw new BadRequestError(
                    `Insufficient leave balance: requested ${days}, remaining ${remaining}`,
                );
            }

            const updated = await tx.leaveRequest.update({
                where: { id: leaveRequestId },
                data: {
                    status: 'APPROVED',
                    approvedById: actor.id,
                    approvedAt: new Date(),
                },
            });

            await tx.leaveBalance.update({
                where: { id: balance.id },
                data: { usedDays: { increment: days } },
            });

            await recordAudit(
                {
                    action: 'UPDATE',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'LeaveRequest',
                    entityId: leaveRequestId,
                    metadata: { status: 'APPROVED', daysDeducted: days, employeeKey, year },
                    ...ctx,
                },
                tx,
            );

            return { ...updated, daysDeducted: days };
        });
    }

    /** Count Mon-Fri days between two dates, inclusive. */
    static _workingDaysBetween(start, end) {
        let count = 0;
        const cursor = new Date(
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
        );
        const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
        while (cursor <= last) {
            const dow = cursor.getUTCDay();
            if (dow !== 0 && dow !== 6) count++;
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        return count;
    }
}
