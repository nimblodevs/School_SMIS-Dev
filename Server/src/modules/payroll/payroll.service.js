import { Prisma } from '@prisma/client';
import { runTransaction } from '../../config/prisma.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { resolveSchoolId } from '../../shared/ownership.js';

const D = (v) => new Prisma.Decimal(v);

export class PayrollService {
    /**
     * Run payroll for a given (year, month).
     * Idempotent: re-running on a DRAFT run replaces payslips.
     * Refuses to re-run on APPROVED or PAID runs.
     */
    static async executePayrollRun({ year, month }, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor);
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            throw new BadRequestError('month must be 1-12');
        }
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            throw new BadRequestError('year out of range');
        }

        const periodStart = new Date(Date.UTC(year, month - 1, 1));
        const periodEnd = new Date(Date.UTC(year, month, 0)); // last day of month
        const period = `${year}-${String(month).padStart(2, '0')}`;

        return runTransaction(async (tx) => {
            const existing = await tx.payrollRun.findUnique({
                where: { schoolId_month: { schoolId, month: period } },
                include: { payslips: true },
            });

            if (existing && ['APPROVED', 'PAID'].includes(existing.status)) {
                throw new BadRequestError(
                    `Payroll for ${period} is ${existing.status} and locked`,
                );
            }

            const run = existing
                ? await tx.payrollRun.update({
                    where: { id: existing.id },
                    data: { status: 'PROCESSING', processedById: actor.id, processedAt: new Date() },
                })
                : await tx.payrollRun.create({
                    data: {
                        schoolId,
                        month: period,
                        status: 'PROCESSING',
                        processedById: actor.id,
                        processedAt: new Date(),
                    },
                });

            // A draft run may be recalculated. Reverse only the loan repayments
            // created by this run before calculating the replacement payslips.
            const repaymentReferencePrefix = `PAYROLL:${run.id}:`;
            const previousRepayments = await tx.loanRepayment.findMany({
                where: {
                    schoolId,
                    paymentMethod: 'PAYROLL_DEDUCTION',
                    reference: { startsWith: repaymentReferencePrefix },
                },
            });
            for (const repayment of previousRepayments) {
                const loan = await tx.employeeSalaryLoan.findFirst({
                    where: { id: repayment.loanId, schoolId },
                    select: { amount: true, balance: true },
                });
                if (!loan) continue;

                const restoredBalance = Prisma.Decimal.min(
                    loan.amount,
                    loan.balance.plus(repayment.amount),
                );
                await tx.employeeSalaryLoan.update({
                    where: { id: repayment.loanId },
                    data: {
                        balance: restoredBalance,
                        status: restoredBalance.eq(loan.amount) ? 'ACTIVE' : 'PARTIALLY_PAID',
                    },
                });
            }
            await tx.loanRepayment.deleteMany({
                where: {
                    schoolId,
                    paymentMethod: 'PAYROLL_DEDUCTION',
                    reference: { startsWith: repaymentReferencePrefix },
                },
            });

            // ---- 1. Fetch employees + their active base salary ----
            const [teachers, staff] = await Promise.all([
                tx.teacher.findMany({
                    where: { schoolId },
                    select: { id: true, employeeKey: true, jobGroupId: true },
                }),
                tx.staff.findMany({
                    where: { schoolId },
                    select: { id: true, employeeKey: true, jobGroupId: true },
                }),
            ]);

            const employees = [
                ...teachers.map((t) => ({ ...t, teacherId: t.id, staffId: null })),
                ...staff.map((s) => ({ ...s, teacherId: null, staffId: s.id })),
            ];

            // ---- 2. Preload reference data ----
            const [salaryStructures, statutory, loans, customDeds] = await Promise.all([
                tx.salaryStructure.findMany({
                    where: {
                        schoolId,
                        effectiveDate: { lte: periodEnd },
                    },
                    orderBy: { effectiveDate: 'desc' },
                    include: { allowanceType: true },
                }),
                tx.statutoryDeduction.findMany({
                    where: { schoolId, isActive: true },
                    include: {
                        rateConfigs: {
                            where: {
                                effectiveFrom: { lte: periodEnd },
                                OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
                            },
                        },
                    },
                }),
                tx.employeeSalaryLoan.findMany({
                    where: { schoolId, status: { in: ['ACTIVE', 'PARTIALLY_PAID'] } },
                }),
                tx.customDeduction.findMany({
                    where: {
                        schoolId,
                        effectiveDate: { lte: periodEnd },
                    },
                }),
            ]);

            // ---- 3. Build per-employee lookup maps ----
            const salaryByEmp = new Map();
            for (const structure of salaryStructures) {
                const key = structure.teacherId
                    ? `T:${structure.teacherId}`
                    : `S:${structure.staffId}`;
                if (!salaryByEmp.has(key)) salaryByEmp.set(key, []);
                salaryByEmp.get(key).push(structure);
            }

            const loanByEmp = new Map();
            for (const l of loans) {
                const key = l.teacherId ? `T:${l.teacherId}` : `S:${l.staffId}`;
                if (!loanByEmp.has(key)) loanByEmp.set(key, []);
                loanByEmp.get(key).push(l);
            }

            const customByEmp = new Map();
            for (const c of customDeds) {
                const key = c.teacherId ? `T:${c.teacherId}` : `S:${c.staffId}`;
                if (!customByEmp.has(key)) customByEmp.set(key, []);
                customByEmp.get(key).push(c);
            }

            // ---- 4. Compute payslips ----
            let totalGross = D(0);
            let totalNet = D(0);
            const payslipRows = [];

            for (const emp of employees) {
                const key = emp.employeeKey; // "T:<id>" or "S:<id>"
                if (!key) continue; // skip employees without an EmployeeNumber row

                const structures = salaryByEmp.get(key) ?? [];
                if (!structures.length) continue; // no salary configured — skip, don't pay zero

                const basicPay = structures[0].baseSalary;
                const latestAllowanceByType = new Map();
                for (const structure of structures) {
                    if (structure.allowanceTypeId && !latestAllowanceByType.has(structure.allowanceTypeId)) {
                        latestAllowanceByType.set(structure.allowanceTypeId, structure.allowanceType);
                    }
                }
                const allowancesTotal = [...latestAllowanceByType.values()].reduce(
                    (sum, allowance) => sum.plus(allowance.amount),
                    D(0),
                );
                const grossPay = basicPay.plus(allowancesTotal);

                // Statutory deductions use progressive rate brackets.
                const statutoryTotal = statutory.reduce((sum, ded) => {
                    return sum.plus(PayrollService._computeStatutory(ded, grossPay, periodEnd));
                }, D(0));

                // Custom
                const customTotal = (customByEmp.get(key) ?? []).reduce(
                    (sum, c) => sum.plus(c.amount),
                    D(0),
                );

                // Loans — cap at outstanding balance
                const empLoans = loanByEmp.get(key) ?? [];
                const loanTotal = empLoans.reduce((sum, l) => {
                    const cap = Prisma.Decimal.min(l.monthlyDeduction, l.balance);
                    return sum.plus(cap);
                }, D(0));

                const deductionsTotal = statutoryTotal.plus(customTotal).plus(loanTotal);
                const netPay = grossPay.minus(deductionsTotal);
                if (netPay.lt(0)) {
                    throw new BadRequestError(
                        `Net pay negative for ${key}: gross=${grossPay}, deductions=${deductionsTotal}`,
                    );
                }

                payslipRows.push({
                    schoolId,
                    payrollRunId: run.id,
                    employeeKey: key,
                    teacherId: emp.teacherId,
                    staffId: emp.staffId,
                    basicPay,
                    grossPay,
                    totalDeductions: deductionsTotal,
                    netPay,
                });

                totalGross = totalGross.plus(grossPay);
                totalNet = totalNet.plus(netPay);
            }

            // ---- 5. Replace payslips for this run ----
            await tx.payslip.deleteMany({ where: { payrollRunId: run.id } });
            await tx.payslip.createMany({ data: payslipRows });

            // ---- 6. Decrement loan balances atomically ----
            for (const emp of employees) {
                const empLoans = loanByEmp.get(emp.employeeKey) ?? [];
                for (const l of empLoans) {
                    const applied = Prisma.Decimal.min(l.monthlyDeduction, l.balance);
                    const newBalance = l.balance.minus(applied);
                    await tx.employeeSalaryLoan.update({
                        where: { id: l.id },
                        data: {
                            balance: newBalance,
                            status: newBalance.eq(0) ? 'COMPLETED' : 'PARTIALLY_PAID',
                        },
                    });
                    await tx.loanRepayment.create({
                        data: {
                            schoolId,
                            loanId: l.id,
                            amount: applied,
                            paymentDate: periodEnd,
                            paymentMethod: 'PAYROLL_DEDUCTION',
                            reference: `${repaymentReferencePrefix}${l.id}`,
                            notes: `Auto-deduction for ${year}-${String(month).padStart(2, '0')}`,
                        },
                    });
                }
            }

            // ---- 7. Return to DRAFT so a separate approval flow can lock the run ----
            const finalRun = await tx.payrollRun.update({
                where: { id: run.id },
                data: {
                    status: 'DRAFT',
                    totalGross,
                    totalNet,
                },
            });

            await recordAudit(
                {
                    action: 'PAYROLL_PROCESSED',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'PayrollRun',
                    entityId: run.id,
                    metadata: { year, month, employeeCount: payslipRows.length },
                    ...ctx,
                },
                tx,
            );

            return finalRun;
        });
    }

    /**
     * Compute a single statutory deduction.
     *
     * Sum each configured salary bracket's percentage and fixed amount.
     */
    static _computeStatutory(deduction, grossPay, periodEnd) {
        // Pick the config valid on periodEnd (latest effectiveFrom <= periodEnd)
        const configs = deduction.rateConfigs
            .filter((c) => new Date(c.effectiveFrom) <= periodEnd)
            .filter((c) => !c.effectiveTo || new Date(c.effectiveTo) >= periodEnd)
            .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));

        let total = D(0);
        const brackets = configs
            .filter((c) => D(c.minSalary).lt(grossPay))
            .sort((a, b) => Number(a.minSalary) - Number(b.minSalary));

        for (const b of brackets) {
            const lower = D(b.minSalary);
            const upper = b.maxSalary ? D(b.maxSalary) : grossPay;
            const slice = Prisma.Decimal.min(grossPay, upper).minus(lower);
            if (slice.gt(0)) {
                total = total.plus(slice.mul(b.rate)).plus(b.fixedAmount ?? 0);
            }
        }
        return total;
    }
}
