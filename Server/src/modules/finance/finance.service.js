import { Prisma } from '@prisma/client';
import { prisma, runTransaction } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { assertOwnership, resolveSchoolId } from '../../shared/ownership.js';

const D = (v) => new Prisma.Decimal(v); // guard against float input

export class FinanceService {
    // ----------------------------------------------------------
    // INVOICING
    // ----------------------------------------------------------

    static async generateTermInvoices({ termId, classLevelId, dueDate }, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor);
        const due = new Date(dueDate);
        if (Number.isNaN(due.getTime())) throw new BadRequestError('Invalid dueDate');
        await assertOwnership(prisma, schoolId, [
            { model: 'term', id: termId, label: 'Term' },
            { model: 'classLevel', id: classLevelId, label: 'Class level' },
        ]);

        // The schema stores one aggregate fee structure per term and class level.
        const feeStructures = await prisma.feeStructure.findMany({
            where: { schoolId, termId, classLevelId },
        });
        if (feeStructures.length === 0) {
            throw new NotFoundError('No active fee structures for this term and class level');
        }

        const enrollments = await prisma.enrollment.findMany({
            where: { schoolId, status: 'ACTIVE', stream: { classLevelId } },
            select: { id: true, studentId: true },
        });

        return runTransaction(async (tx) => {
            const results = [];
            for (const enrollment of enrollments) {
                const invoice = await tx.invoice.upsert({
                    where: {
                        studentId_termId: { studentId: enrollment.studentId, termId },
                    },
                    update: {}, // preserve existing invoice; amendments go through CreditNote
                    create: {
                        schoolId,
                        studentId: enrollment.studentId,
                        enrollmentId: enrollment.id,
                        termId,
                        amountDue: feeStructures.reduce(
                            (total, feeStructure) => total.plus(feeStructure.amount),
                            D(0),
                        ),
                        amountPaid: D(0),
                        status: 'UNPAID',
                        dueDate: due,
                    },
                });
                results.push(invoice);
            }

            await recordAudit(
                {
                    action: 'INVOICE_ISSUED',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'InvoiceBatch',
                    entityId: termId,
                    metadata: { termId, classLevelId, count: results.length },
                    ...ctx,
                },
                tx,
            );

            return { totalGenerated: results.length, invoiceIds: results.map((i) => i.id) };
        });
    }

    // ----------------------------------------------------------
    // PAYMENTS
    // ----------------------------------------------------------

    /**
     * Record a payment. If `allocations` is provided, apply them atomically.
     * If not, mark `requiresAllocation = true` for later.
     *
     * @param {object} payload
     * @param {string} [payload.studentId]
     * @param {number} payload.amount
     * @param {string} payload.method  MPESA | CASH | CHEQUE | BANK_DEPOSIT | BANK_TRANSFER | CARD
     * @param {Array<{invoiceId: string, amount: number}>} [payload.allocations]
     * @param {string} [payload.idempotencyKey]  M-Pesa CheckoutRequestID or receipt
     */
    static async recordPayment(payload, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor);
        const amount = D(payload.amount);
        if (amount.lte(0)) throw new BadRequestError('Amount must be positive');
        await assertOwnership(prisma, schoolId, [
            { model: 'student', id: payload.studentId, label: 'Student', optional: true },
            { model: 'invoice', id: payload.invoiceId, label: 'Invoice', optional: true },
        ]);

        return runTransaction(async (tx) => {
            // Idempotency: M-Pesa retries the same checkoutRequestId
            if (payload.idempotencyKey) {
                const existing = await tx.payment.findFirst({
                    where: {
                        schoolId,
                        OR: [
                            { checkoutRequestId: payload.idempotencyKey },
                            { mpesaReceipt: payload.idempotencyKey },
                        ],
                    },
                });
                if (existing) return existing;
            }

            const payment = await tx.payment.create({
                data: {
                    schoolId,
                    invoiceId: payload.invoiceId ?? null,
                    studentId: payload.studentId ?? null,
                    amount,
                    method: payload.method,
                    status: 'COMPLETED',
                    reference: payload.reference ?? null,
                    recordedById: actor.id,
                    paidAt: new Date(),
                    checkoutRequestId: payload.checkoutRequestId ?? null,
                    mpesaReceipt: payload.mpesaReceipt ?? null,
                    requiresAllocation: !payload.allocations?.length,
                    allocatedAt: payload.allocations?.length ? new Date() : null,
                },
            });

            if (payload.allocations?.length) {
                await FinanceService._applyAllocations(tx, payment, payload.allocations, actor);
            }

            await FinanceService._postLedger(tx, {
                schoolId,
                debitAccount: FinanceService._accountForMethod(payload.method),
                creditAccount: '4000-FEE-REVENUE',
                amount,
                reference: `Payment:${payment.id}`,
                narration: `Fee payment (${payload.method})`,
            });

            await recordAudit(
                {
                    action: 'PAYMENT_RECORDED',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'Payment',
                    entityId: payment.id,
                    metadata: { amount: amount.toString(), method: payload.method },
                    ...ctx,
                },
                tx,
            );

            return payment;
        });
    }

    /**
     * Apply a list of { invoiceId, amount } allocations to a payment.
     * Validates: sum(allocations) <= payment.amount, each invoice belongs to the school,
     * and each allocation does not exceed the invoice's outstanding balance.
     */
    static async _applyAllocations(tx, payment, allocations, actor) {
        const totalAllocated = allocations.reduce((s, a) => s.plus(D(a.amount)), D(0));
        if (totalAllocated.gt(payment.amount)) {
            throw new BadRequestError('Allocations exceed payment amount');
        }

        for (const alloc of allocations) {
            // Lock the invoice row to prevent concurrent allocation races
            const [invoice] = await tx.$queryRaw`
        SELECT id, "schoolId" AS school_id, "studentId" AS student_id, "amountDue" AS amount_due, status
        FROM invoices
        WHERE id = ${alloc.invoiceId} AND "schoolId" = ${payment.schoolId}
        FOR UPDATE
      `;
            if (!invoice || invoice.school_id !== payment.schoolId) {
                throw new NotFoundError(`Invoice ${alloc.invoiceId} not found`);
            }
            if (payment.studentId && invoice.student_id !== payment.studentId) {
                throw new BadRequestError('Payment and invoice must belong to the same student');
            }

            // Compute outstanding from the current schema and active allocations.
            const [balanceRow] = await tx.$queryRaw`
        SELECT
                    (SELECT "amountDue" FROM invoices WHERE id = ${alloc.invoiceId} AND "schoolId" = ${payment.schoolId})
                    - COALESCE((SELECT SUM("amount") FROM credit_note_applications WHERE "invoiceId" = ${alloc.invoiceId} AND "schoolId" = ${payment.schoolId} AND "status" = 'ACTIVE'), 0)
                    - COALESCE((SELECT SUM("amount") FROM payment_allocations WHERE "invoiceId" = ${alloc.invoiceId} AND "schoolId" = ${payment.schoolId} AND "status" = 'ACTIVE'), 0)
          AS outstanding
      `;
            const before = D(balanceRow.outstanding);
            const apply = D(alloc.amount);
            if (apply.gt(before)) {
                throw new BadRequestError(
                    `Allocation ${apply} exceeds outstanding ${before} on invoice ${alloc.invoiceId}`,
                );
            }
            const after = before.minus(apply);

            await tx.paymentAllocation.create({
                data: {
                    schoolId: payment.schoolId,
                    paymentId: payment.id,
                    invoiceId: alloc.invoiceId,
                    amount: apply,
                    invoiceBalanceBefore: before,
                    invoiceBalanceAfter: after,
                    createdById: actor.id,
                },
            });

            const nextStatus = after.lte(0)
                ? 'PAID'
                : after.lt(D(invoice.amount_due))
                    ? 'PARTIALLY_PAID'
                    : 'UNPAID';
            await tx.invoice.update({
                where: { id: alloc.invoiceId },
                data: { amountPaid: D(invoice.amount_due).minus(after), status: nextStatus },
            });
        }

        // Ledger: move from unearned to AR
        // (optional second pair — depends on your accounting policy)
    }

    static _accountForMethod(method) {
        switch (method) {
            case 'MPESA': return '1010-MPESA';
            case 'CASH': return '1000-CASH';
            case 'BANK_DEPOSIT':
            case 'BANK_TRANSFER': return '1020-BANK';
            case 'CHEQUE': return '1030-CHEQUES';
            case 'CARD': return '1040-CARD';
            default: throw new BadRequestError(`Unknown payment method: ${method}`);
        }
    }

    /** Writes a balanced DEBIT/CREDIT pair. */
    static async _postLedger(tx, { schoolId, debitAccount, creditAccount, amount, reference, narration }) {
        const entryDate = new Date();
        await tx.ledgerEntry.createMany({
            data: [
                {
                    schoolId, accountCode: debitAccount,
                    direction: 'DEBIT', amount, reference,
                    narration, entryDate,
                },
                {
                    schoolId, accountCode: creditAccount,
                    direction: 'CREDIT', amount, reference,
                    narration, entryDate,
                },
            ],
        });
    }
}
