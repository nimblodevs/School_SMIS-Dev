import { Prisma } from '@prisma/client';
import { runTransaction } from '../../config/prisma.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { nextPayslipNo } from '../../shared/sequences.js';

const D = (v) => new Prisma.Decimal(v);

export class PayrollService {
    /**
     * Run payroll for a given (year, month).
     * Idempotent: re-running on a DRAFT run replaces payslips.
     * Refuses to re-run on APPROVED or PAID runs.
     */
    static async executePayrollRun({ year, month }, actor, ctx = {}) {
        const schoolId = actor.schoolId;
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            throw new BadRequestError('month must be 1-12');
        }
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            throw new BadRequestError('year out of range');
        }

        const periodStart = new Date(Date.UTC(year, month - 1, 1));
        const periodEnd = new Date(Date.UTC(year, month, 0)); // last day of month

        return runTransaction(async (tx) => {
            const existing = await tx.payrollRun.findUnique({
                where: { schoolId_year_month: { schoolId, year, month } },
                include: { payslips: true },
            });

            if (existing && ['APPROVED', 'PAID'].includes(existing.status)) {
                throw new BadRequestError(
                    `Payroll for ${year}-${String(month).padStart(2, '0')} is ${existing.status} and locked`,
                );
            }

            const run = existing
                ? await tx.payrollRun.update({
                      where: { id: existing.id },
                      data: {
                          status: 'PROCESSING',
                          processedById: actor.id,
                          processedAt: new Date(),
                      },
                  })
                : await tx.payrollRun.create({
                      data: {
                          schoolId,
                          year,
                          month,
                          periodStart,
                          periodEnd,
                          status: 'PROCESSING',
                          processedById: actor.id,
                          processedAt: new Date(),
                      },
                  });

            await tx.payrollRunEvent.create({
                data: {
                    schoolId,
                    payrollRunId: run.id,
                    fromStatus: existing?.status ?? null,
                    toStatus: 'PROCESSING',
                    actorId: actor.id,
                    notes: 'Payroll run started',
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
            const [baseSalaries, allowances, statutory, loans, customDeds] = await Promise.all([
                tx.baseSalary.findMany({
                    where: {
                        schoolId,
                        effectiveDate: { lte: periodEnd },
                        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
                    },
                    orderBy: { effectiveDate: 'desc' },
                }),
                tx.employeeAllowance.findMany({
                    where: {
                        schoolId,
                        effectiveDate: { lte: periodEnd },
                        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
                    },
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
                        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
                    },
                }),
            ]);

            // ---- 3. Build per-employee lookup maps ----
            const baseByEmp = new Map();
            for (const bs of baseSalaries) {
                const key = bs.teacherId ? `T:${bs.teacherId}` : `S:${bs.staffId}`;
                if (!baseByEmp.has(key)) baseByEmp.set(key, bs); // first = latest due to orderBy desc
            }

            const allowByEmp = new Map();
            for (const a of allowances) {
                const key = a.teacherId ? `T:${a.teacherId}` : `S:${a.staffId}`;
                if (!allowByEmp.has(key)) allowByEmp.set(key, []);
                allowByEmp.get(key).push(a);
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
            let totalDeductions = D(0);
            let totalNet = D(0);
            const payslipRows = [];

            for (const emp of employees) {
                const key = emp.employeeKey; // "T:<id>" or "S:<id>"
                if (!key) continue; // skip employees without an EmployeeNumber row

                const base = baseByEmp.get(key);
                if (!base) continue; // no salary configured — skip, don't pay zero

                const basicPay = base.amount;
                const empAllowances = allowByEmp.get(key) ?? [];
                const allowancesTotal = empAllowances.reduce(
                    (sum, a) => sum.plus(a.amount ?? a.allowanceType.amount),
                    D(0),
                );
                const grossPay = basicPay.plus(allowancesTotal);

                // Statutory (progressive + flat)
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
                    allowancesTotal,
                    grossPay,
                    statutoryTotal,
                    customTotal,
                    loanTotal,
                    totalDeductions: deductionsTotal,
                    netPay,
                    currency: 'KES',
                    payslipNo: await nextPayslipNo(tx, schoolId),
                });

                totalGross = totalGross.plus(grossPay);
                totalDeductions = totalDeductions.plus(deductionsTotal);
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
                            notes: `Auto-deduction for ${year}-${String(month).padStart(2, '0')}`,
                        },
                    });
                }
            }

            // ---- 7. Finalize run ----
            const finalRun = await tx.payrollRun.update({
                where: { id: run.id },
                data: {
                    status: 'PENDING_APPROVAL',
                    totalGross,
                    totalDeductions,
                    totalNet,
                    employeeCount: payslipRows.length,
                },
            });

            await tx.payrollRunEvent.create({
                data: {
                    schoolId,
                    payrollRunId: run.id,
                    fromStatus: 'PROCESSING',
                    toStatus: 'PENDING_APPROVAL',
                    actorId: actor.id,
                    metadata: { totalGross: totalGross.toString(), totalNet: totalNet.toString() },
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
     * For PROGRESSIVE (PAYE): sum over brackets: slice * rate + fixedAmount.
     * For FLAT_RATE (NSSF/SHIF): rate * min(gross, cap) + fixedAmount.
     * For FIXED: fixedAmount.
     */
    static _computeStatutory(deduction, grossPay, periodEnd) {
        // Pick the config valid on periodEnd (latest effectiveFrom <= periodEnd)
        const configs = deduction.rateConfigs
            .filter((c) => new Date(c.effectiveFrom) <= periodEnd)
            .filter((c) => !c.effectiveTo || new Date(c.effectiveTo) >= periodEnd)
            .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));

        // For FLAT_RATE / FIXED, only one config applies
        if (deduction.calculationType !== 'PROGRESSIVE') {
            const cfg = configs.find(
                (c) =>
                    D(c.minSalary).lte(grossPay) && (!c.maxSalary || D(c.maxSalary).gte(grossPay)),
            );
            if (!cfg) return D(0);
            if (deduction.calculationType === 'FIXED') return D(cfg.fixedAmount ?? 0);
            return grossPay.mul(cfg.rate).plus(cfg.fixedAmount ?? 0);
        }

        // PROGRESSIVE: sum across all brackets up to grossPay
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
