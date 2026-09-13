import { prisma } from '../../config/prisma.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';

export class PayrollService {
    static async executePayrollRun(month, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;

        // Standardized format enforcement YYYY-MM
        if (!/^\d{4}-\d{2}$/.test(month)) {
            throw new BadRequestError('Month must be formatted as YYYY-MM');
        }

        return prisma.$transaction(async (tx) => {
            const existingRun = await tx.payrollRun.findUnique({
                where: { schoolId_month: { schoolId, month } },
            });
            if (existingRun && existingRun.status === 'APPROVED') {
                throw new BadRequestError('Payroll for this month is already approved and locked');
            }

            const payrollRun = await tx.payrollRun.upsert({
                where: { schoolId_month: { schoolId, month } },
                update: { status: 'PROCESSING', processedById: actor.id },
                create: {
                    schoolId,
                    month,
                    status: 'PROCESSING',
                    processedById: actor.id,
                },
            });

            // Fetch active contracts & structures
            const structures = await tx.salaryStructure.findMany({
                where: { schoolId },
                include: { allowanceType: true },
            });
            const payrollDate = new Date(`${month}-01T00:00:00.000Z`);
            const statutoryDeductions = await tx.statutoryDeduction.findMany({
                where: { schoolId, isActive: true },
                include: { rateConfigs: { where: { effectiveFrom: { lte: payrollDate } } } },
            });
            const activeLoans = await tx.employeeSalaryLoan.findMany({
                where: { schoolId, status: { in: ['ACTIVE', 'PARTIALLY_PAID'] } },
                select: { teacherId: true, staffId: true, monthlyDeduction: true },
            });

            let totalGrossSum = 0;
            let totalNetSum = 0;

            for (const struct of structures) {
                const employeeKey = struct.teacherId ? `T:${struct.teacherId}` : `S:${struct.staffId}`;
                const basicPay = Number(struct.baseSalary);
                const allowance = struct.allowanceType ? Number(struct.allowanceType.amount) : 0;
                const grossPay = basicPay + allowance;

                // Custom deductions compute step
                const customDeductions = await tx.customDeduction.aggregate({
                    where: {
                        schoolId,
                        OR: [{ teacherId: struct.teacherId }, { staffId: struct.staffId }],
                        effectiveDate: { lte: payrollDate },
                    },
                    _sum: { amount: true },
                });

                const statutoryTotal = statutoryDeductions.reduce((total, deduction) => {
                    const config = deduction.rateConfigs
                        .filter((candidate) => Number(candidate.minSalary) <= grossPay)
                        .filter((candidate) => candidate.maxSalary === null || Number(candidate.maxSalary) >= grossPay)
                        .sort((left, right) => new Date(right.effectiveFrom) - new Date(left.effectiveFrom))[0];
                    if (!config) return total;
                    return total + (config.fixedAmount !== null ? Number(config.fixedAmount) : grossPay * Number(config.rate));
                }, 0);
                const loanTotal = activeLoans
                    .filter((loan) => (struct.teacherId && loan.teacherId === struct.teacherId) || (struct.staffId && loan.staffId === struct.staffId))
                    .reduce((total, loan) => total + Number(loan.monthlyDeduction), 0);
                const totalDeductions = Number(customDeductions._sum.amount || 0) + statutoryTotal + loanTotal;
                const netPay = grossPay - totalDeductions;

                await tx.payslip.upsert({
                    where: {
                        payrollRunId_employeeKey: {
                            payrollRunId: payrollRun.id,
                            employeeKey,
                        },
                    },
                    update: { basicPay, grossPay, totalDeductions, netPay },
                    create: {
                        schoolId,
                        payrollRunId: payrollRun.id,
                        employeeKey,
                        teacherId: struct.teacherId,
                        staffId: struct.staffId,
                        basicPay,
                        grossPay,
                        totalDeductions,
                        netPay,
                    },
                });

                totalGrossSum += grossPay;
                totalNetSum += netPay;
            }

            const finalRun = await tx.payrollRun.update({
                where: { id: payrollRun.id },
                data: {
                    status: 'DRAFT',
                    totalGross: totalGrossSum,
                    totalNet: totalNetSum,
                    processedAt: new Date(),
                },
            });

            await recordAudit({
                action: 'UPDATE',
                actorId: actor.id,
                schoolId,
                entityType: 'PayrollRun',
                entityId: finalRun.id,
                metadata: { month, totalGrossSum, totalNetSum },
                ipAddress,
                userAgent,
            });

            return finalRun;
        });
    }
}