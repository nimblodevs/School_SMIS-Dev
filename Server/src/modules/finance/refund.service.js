// src/modules/finance/refund.service.js
import { Prisma } from '@prisma/client';
import { runTransaction } from '../../config/prisma.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { nextCreditNoteNo } from '../../shared/sequences.js';

const D = (v) => new Prisma.Decimal(v);
const ZERO = D(0);
const MIN = (a, b) => (a.lt(b) ? a : b);

// ------------------------------------------------------------
// Chart of accounts
// ------------------------------------------------------------
const ACCOUNTS = {
    CASH: '1000-CASH',
    MPESA: '1010-MPESA',
    BANK: '1020-BANK',
    CHEQUES: '1030-CHEQUES',
    CARD: '1040-CARD',
    AR_STUDENT: '1100-AR-STUDENT',
    STUDENT_CREDIT: '2100-STUDENT-CREDIT',
    FEE_REVENUE: '4000-FEE-REVENUE',
};

function accountForMethod(method) {
    switch (method) {
        case 'MPESA':
            return ACCOUNTS.MPESA;
        case 'CASH':
            return ACCOUNTS.CASH;
        case 'BANK_DEPOSIT':
        case 'BANK_TRANSFER':
            return ACCOUNTS.BANK;
        case 'CHEQUE':
            return ACCOUNTS.CHEQUES;
        case 'CARD':
            return ACCOUNTS.CARD;
        default:
            throw new BadRequestError(`Unknown payment method: ${method}`);
    }
}

export class RefundService {
    // ============================================================
    // 1. REVERSE A PAYMENT
    // ============================================================
    /**
     * Reverses a COMPLETED payment in full.
     *
     * Ledger: DEBIT 4000-FEE-REVENUE / CREDIT 2100-STUDENT-CREDIT
     *         (revenue unearned, student now holds a credit liability)
     *
     * Effects:
     *   - All ACTIVE PaymentAllocations → REVERSED
     *   - CreditNote issued for the full payment amount
     *   - Payment.status → REFUNDED
     *   - Every affected invoice status recomputed
     *   - Audit entry written
     *
     * Idempotent on idempotencyKey.
     */
    static async reversePayment(
        paymentId,
        { reason, notes, idempotencyKey } = {},
        actor,
        ctx = {},
    ) {
        const schoolId = actor.schoolId;
        if (!reason) throw new BadRequestError('reason is required');

        return runTransaction(async (tx) => {
            // ---- Idempotency ----
            if (idempotencyKey) {
                const claimed = await RefundService._claimIdempotencyKey(
                    tx,
                    schoolId,
                    'reversePayment',
                    idempotencyKey,
                );
                if (claimed.existing) {
                    const creditNote = await tx.creditNote.findUnique({
                        where: { id: claimed.resultId },
                    });
                    return { creditNote, reversedAllocationCount: 0, idempotent: true };
                }
            }

            // ---- Lock payment ----
            const [payment] = await tx.$queryRaw`
        SELECT id, "schoolId" AS school_id, "studentId" AS student_id, amount, status, method
        FROM payments
        WHERE id = ${paymentId}
        FOR UPDATE
      `;
            if (!payment || payment.school_id !== schoolId) {
                throw new NotFoundError('Payment not found');
            }
            if (payment.status === 'REFUNDED') {
                throw new ConflictError('Payment already reversed');
            }
            if (payment.status !== 'COMPLETED') {
                throw new BadRequestError(`Cannot reverse a payment with status ${payment.status}`);
            }

            const amount = D(payment.amount);
            if (!payment.student_id) {
                throw new BadRequestError('Only student payments can be reversed');
            }

            // ---- Reverse active allocations ----
            const allocations = await tx.paymentAllocation.findMany({
                where: { paymentId, status: 'ACTIVE' },
            });

            const affectedInvoiceIds = new Set();
            for (const alloc of allocations) {
                // Lock the invoice before touching its derived state
                await tx.$queryRaw`
          SELECT id FROM invoices WHERE id = ${alloc.invoiceId} FOR UPDATE
        `;
                await tx.paymentAllocation.update({
                    where: { id: alloc.id },
                    data: {
                        status: 'REVERSED',
                        reversedAt: new Date(),
                        reversedBy: actor.id,
                        reversalReason: reason,
                    },
                });
                affectedInvoiceIds.add(alloc.invoiceId);
            }

            // ---- Issue credit note ----
            const creditNote = await tx.creditNote.create({
                data: {
                    schoolId,
                    studentId: payment.student_id,
                    paymentId,
                    creditNo: await nextCreditNoteNo(tx, schoolId),
                    amount,
                    reason,
                    status: 'ISSUED',
                    notes: notes ?? null,
                    createdById: actor.id,
                },
            });

            // ---- Ledger: unearn revenue, recognize liability ----
            await RefundService._postLedgerPair(tx, {
                schoolId,
                debitAccount: ACCOUNTS.FEE_REVENUE,
                creditAccount: ACCOUNTS.STUDENT_CREDIT,
                amount,
                referenceType: 'CreditNote',
                referenceId: creditNote.id,
                narration: `Reversal of payment ${paymentId}: ${reason}`,
                postedById: actor.id,
            });

            // ---- Mark payment refunded ----
            await tx.payment.update({
                where: { id: paymentId },
                data: { status: 'REFUNDED' },
            });

            // ---- Recompute affected invoices ----
            for (const invoiceId of affectedInvoiceIds) {
                await RefundService._recomputeInvoiceStatus(tx, invoiceId);
            }

            await recordAudit(
                {
                    action: 'PAYMENT_REFUNDED',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'Payment',
                    entityId: paymentId,
                    metadata: {
                        creditNoteId: creditNote.id,
                        creditNoteNo: creditNote.creditNo,
                        amount: amount.toString(),
                        reason,
                        reversedAllocationCount: allocations.length,
                    },
                    ...ctx,
                },
                tx,
            );

            if (idempotencyKey) {
                await RefundService._recordIdempotencyResult(
                    tx,
                    schoolId,
                    'reversePayment',
                    idempotencyKey,
                    creditNote.id,
                );
            }

            return {
                creditNote,
                reversedAllocationCount: allocations.length,
                idempotent: false,
            };
        });
    }

    // ============================================================
    // 2. REFUND A PAYMENT (cash out)
    // ============================================================
    /**
     * Refunds cash to the payer. Consumes the student's credit balance FIFO.
     *
     * Preconditions:
     *   - Payment.status = COMPLETED
     *   - Student credit balance >= refund amount
     *
     * Ledger: DEBIT 2100-STUDENT-CREDIT / CREDIT <cash account>
     *
     * Synchronous for CASH/BANK/CHEQUE (status → COMPLETED immediately).
     * Asynchronous for MPESA/CARD (status → PROCESSING; webhook completes it).
     *
     * Idempotent on idempotencyKey.
     */
    static async refundPayment(
        paymentId,
        { amount, method, reference, notes, idempotencyKey } = {},
        actor,
        ctx = {},
    ) {
        const schoolId = actor.schoolId;
        const refundAmount = D(amount ?? 0);
        if (refundAmount.lte(0)) throw new BadRequestError('amount must be positive');

        return runTransaction(async (tx) => {
            // ---- Idempotency ----
            if (idempotencyKey) {
                const claimed = await RefundService._claimIdempotencyKey(
                    tx,
                    schoolId,
                    'refundPayment',
                    idempotencyKey,
                );
                if (claimed.existing) {
                    const refund = await tx.paymentRefund.findUnique({
                        where: { id: claimed.resultId },
                    });
                    return { refund, idempotent: true };
                }
            }

            // ---- Lock payment ----
            const [payment] = await tx.$queryRaw`
        SELECT id, "schoolId" AS school_id, "studentId" AS student_id, amount, status, method
        FROM payments
        WHERE id = ${paymentId}
        FOR UPDATE
      `;
            if (!payment || payment.school_id !== schoolId) {
                throw new NotFoundError('Payment not found');
            }
            if (payment.status !== 'COMPLETED') {
                throw new BadRequestError(
                    `Only COMPLETED payments can be refunded (current: ${payment.status})`,
                );
            }

            // ---- Lock student & check credit ----
            const creditBalance = await RefundService._computeCreditBalance(
                tx,
                payment.student_id,
                { lock: true },
            );
            if (creditBalance.lt(refundAmount)) {
                throw new BadRequestError(
                    `Insufficient credit balance: requested ${refundAmount}, available ${creditBalance}`,
                );
            }

            // ---- Create refund record ----
            const refundMethod = method ?? payment.method;
            const refund = await tx.paymentRefund.create({
                data: {
                    schoolId,
                    paymentId,
                    studentId: payment.student_id,
                    amount: refundAmount,
                    method: refundMethod,
                    status: 'PROCESSING',
                    reference: reference ?? null,
                    requestedById: actor.id,
                    requestedAt: new Date(),
                },
            });

            // ---- Consume credit FIFO ----
            await RefundService._consumeCreditFIFO(tx, payment.student_id, refundAmount, {
                invoiceId: null,
                actor,
            });

            // ---- Ledger: settle liability, cash leaves ----
            await RefundService._postLedgerPair(tx, {
                schoolId,
                debitAccount: ACCOUNTS.STUDENT_CREDIT,
                creditAccount: accountForMethod(refundMethod),
                amount: refundAmount,
                referenceType: 'PaymentRefund',
                referenceId: refund.id,
                narration: `Refund to payer for payment ${paymentId}${notes ? `: ${notes}` : ''}`,
                postedById: actor.id,
            });

            // ---- Synchronous completion for cash-like methods ----
            const syncMethods = ['CASH', 'BANK_TRANSFER', 'BANK_DEPOSIT', 'CHEQUE'];
            const finalStatus = syncMethods.includes(refundMethod) ? 'COMPLETED' : 'PROCESSING';
            const now = new Date();

            const updated = await tx.paymentRefund.update({
                where: { id: refund.id },
                data: {
                    status: finalStatus,
                    processedById: actor.id,
                    processedAt: now,
                    completedAt: finalStatus === 'COMPLETED' ? now : null,
                },
            });

            await recordAudit(
                {
                    action: 'PAYMENT_REFUNDED',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'PaymentRefund',
                    entityId: refund.id,
                    metadata: {
                        paymentId,
                        amount: refundAmount.toString(),
                        method: refundMethod,
                        status: finalStatus,
                    },
                    ...ctx,
                },
                tx,
            );

            if (idempotencyKey) {
                await RefundService._recordIdempotencyResult(
                    tx,
                    schoolId,
                    'refundPayment',
                    idempotencyKey,
                    refund.id,
                );
            }

            return { refund: updated, idempotent: false };
        });
    }

    // ============================================================
    // 3. APPLY CREDIT TO AN INVOICE
    // ============================================================
    /**
     * Consumes a student's credit balance against an outstanding invoice.
     * This is how a reversed payment gets re-applied to the correct invoice.
     *
     * Ledger: DEBIT 2100-STUDENT-CREDIT / CREDIT 1100-AR-STUDENT
     *
     * Idempotent on idempotencyKey.
     */
    static async applyCreditToInvoice(
        { studentId, invoiceId, amount, idempotencyKey },
        actor,
        ctx = {},
    ) {
        const schoolId = actor.schoolId;
        const applyAmount = D(amount);
        if (applyAmount.lte(0)) throw new BadRequestError('amount must be positive');

        return runTransaction(async (tx) => {
            // ---- Idempotency ----
            if (idempotencyKey) {
                const claimed = await RefundService._claimIdempotencyKey(
                    tx,
                    schoolId,
                    'applyCreditToInvoice',
                    idempotencyKey,
                );
                if (claimed.existing) {
                    return { applied: applyAmount, invoiceId, idempotent: true };
                }
            }

            // ---- Lock invoice ----
            const [invoice] = await tx.$queryRaw`
        SELECT id, "schoolId" AS school_id, "studentId" AS student_id, status
        FROM invoices
        WHERE id = ${invoiceId}
        FOR UPDATE
      `;
            if (!invoice || invoice.school_id !== schoolId) {
                throw new NotFoundError('Invoice not found');
            }
            if (invoice.student_id !== studentId) {
                throw new BadRequestError('Invoice does not belong to this student');
            }
            if (['CANCELLED', 'WRITTEN_OFF', 'DRAFT'].includes(invoice.status)) {
                throw new BadRequestError(`Cannot apply credit to a ${invoice.status} invoice`);
            }

            // ---- Lock student & check credit ----
            const creditBalance = await RefundService._computeCreditBalance(tx, studentId, {
                lock: true,
            });
            if (creditBalance.lt(applyAmount)) {
                throw new BadRequestError(
                    `Insufficient credit: requested ${applyAmount}, available ${creditBalance}`,
                );
            }

            // ---- Check invoice outstanding ----
            const outstanding = await RefundService._computeInvoiceOutstanding(tx, invoiceId);
            if (applyAmount.gt(outstanding)) {
                throw new BadRequestError(
                    `Apply amount ${applyAmount} exceeds invoice outstanding ${outstanding}`,
                );
            }

            // ---- Consume credit FIFO ----
            await RefundService._consumeCreditFIFO(tx, studentId, applyAmount, {
                invoiceId,
                actor,
            });

            // ---- Ledger: liability settled, AR reduced ----
            await RefundService._postLedgerPair(tx, {
                schoolId,
                debitAccount: ACCOUNTS.STUDENT_CREDIT,
                creditAccount: ACCOUNTS.AR_STUDENT,
                amount: applyAmount,
                referenceType: 'Invoice',
                referenceId: invoiceId,
                narration: `Applied student credit to invoice ${invoiceId}`,
                postedById: actor.id,
            });

            // ---- Recompute invoice status ----
            await RefundService._recomputeInvoiceStatus(tx, invoiceId);

            await recordAudit(
                {
                    action: 'PAYMENT_ALLOCATED',
                    actorId: actor.id,
                    schoolId,
                    entityType: 'Invoice',
                    entityId: invoiceId,
                    metadata: {
                        studentId,
                        amount: applyAmount.toString(),
                        source: 'CREDIT_NOTE',
                    },
                    ...ctx,
                },
                tx,
            );

            if (idempotencyKey) {
                await RefundService._recordIdempotencyResult(
                    tx,
                    schoolId,
                    'applyCreditToInvoice',
                    idempotencyKey,
                    invoiceId,
                );
            }

            return { applied: applyAmount, invoiceId, idempotent: false };
        });
    }

    // ============================================================
    // INTERNAL HELPERS
    // ============================================================

    /**
     * Recomputes an invoice's status from derived data.
     * Caller MUST already hold a lock on the invoice row.
     */
    static async _recomputeInvoiceStatus(tx, invoiceId) {
        const [row] = await tx.$queryRaw`
      SELECT
                i."status" AS current_status,
                i."dueDate" AS due_date,
                i."amountDue" AS total_due,
                COALESCE((SELECT SUM("amount") FROM credit_note_applications
                                    WHERE "invoiceId" = i.id AND "status" = 'ACTIVE'), 0) AS total_credited,
                COALESCE((SELECT SUM("amount") FROM payment_allocations
                                    WHERE "invoiceId" = i.id AND "status" = 'ACTIVE'), 0) AS total_paid
      FROM invoices i
            WHERE i.id = ${invoiceId}
    `;
        if (!row) return;
        if (['DRAFT', 'CANCELLED', 'WRITTEN_OFF'].includes(row.current_status)) return;

        const totalDue = D(row.total_due);
        const netDue = totalDue.minus(D(row.total_credited));
        const totalPaid = D(row.total_paid);

        let nextStatus;
        if (netDue.lte(0)) nextStatus = 'PAID';
        else if (totalPaid.gte(netDue)) nextStatus = 'PAID';
        else if (totalPaid.gt(0)) nextStatus = 'PARTIALLY_PAID';
        else if (new Date(row.due_date) < new Date()) nextStatus = 'OVERDUE';
        else nextStatus = 'ISSUED';

        await tx.invoice.update({
            where: { id: invoiceId },
            data: {
                status: nextStatus,
                amountPaid: totalPaid,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Computes invoice outstanding (net of lines, waivers, credits, active payments).
     */
    static async _computeInvoiceOutstanding(tx, invoiceId) {
        const [row] = await tx.$queryRaw`
      SELECT
        (SELECT "amountDue" FROM invoices WHERE id = ${invoiceId})
        - COALESCE((SELECT SUM("amount") FROM credit_note_applications
                WHERE "invoiceId" = ${invoiceId} AND "status" = 'ACTIVE'), 0)
        - COALESCE((SELECT SUM("amount") FROM payment_allocations
                WHERE "invoiceId" = ${invoiceId} AND "status" = 'ACTIVE'), 0)
        AS outstanding
    `;
        return D(row.outstanding);
    }

    /**
     * Student's total credit balance:
     *   SUM(credit_notes.amount where status in ISSUED, PARTIALLY_APPLIED)
     *   - SUM(credit_note_applications.amount where status = ACTIVE)
     * Credit-note applications are the single source of truth for consumed credit,
     * including refunds, which are represented by applications without an invoice.
     *
     * Pass `{ lock: true }` to serialize concurrent credit consumption
     * (locks the student row).
     */
    static async _computeCreditBalance(tx, studentId, { lock = false } = {}) {
        if (lock) {
            await tx.$queryRaw`
        SELECT id FROM students WHERE id = ${studentId} FOR UPDATE
      `;
        }

        const [row] = await tx.$queryRaw`
      SELECT
        COALESCE((SELECT SUM(amount) FROM credit_notes
                  WHERE "studentId" = ${studentId}
                    AND status IN ('ISSUED','PARTIALLY_APPLIED')), 0)
                - COALESCE((SELECT SUM("amount") FROM credit_note_applications
                                        WHERE "creditNoteId" IN (
                                                SELECT id FROM credit_notes WHERE "studentId" = ${studentId}
                                        )
                                        AND "status" = 'ACTIVE'), 0)
        AS balance
    `;
        return D(row.balance);
    }

    /**
     * Consume credit FIFO across the student's open credit notes.
     * Writes CreditNoteApplication rows and updates CreditNote.status.
     *
     * Caller MUST already hold the student lock (via _computeCreditBalance with lock: true).
     */
    static async _consumeCreditFIFO(tx, studentId, amount, { invoiceId, actor }) {
        let remaining = D(amount);

        const notes = await tx.creditNote.findMany({
            where: {
                studentId,
                status: { in: ['ISSUED', 'PARTIALLY_APPLIED'] },
            },
            orderBy: { createdAt: 'asc' },
        });

        for (const note of notes) {
            if (remaining.lte(0)) break;

            // How much of this note is still available?
            const [consumedRow] = await tx.$queryRaw`
        SELECT COALESCE(SUM(amount), 0) AS consumed
        FROM credit_note_applications
        WHERE "creditNoteId" = ${note.id}
          AND status = 'ACTIVE'
      `;
            const consumed = D(consumedRow.consumed);
            const available = D(note.amount).minus(consumed);
            if (available.lte(0)) continue;

            const take = MIN(available, remaining);

            // Snapshot invoice balance if applying to an invoice
            let before = ZERO;
            let after = ZERO;
            if (invoiceId) {
                before = await RefundService._computeInvoiceOutstanding(tx, invoiceId);
                after = before.minus(take);
            }

            await tx.creditNoteApplication.create({
                data: {
                    schoolId: note.schoolId,
                    creditNoteId: note.id,
                    invoiceId: invoiceId ?? null,
                    amount: take,
                    invoiceBalanceBefore: before,
                    invoiceBalanceAfter: after,
                    status: 'ACTIVE',
                    createdById: actor.id,
                },
            });

            remaining = remaining.minus(take);

            const newConsumed = consumed.plus(take);
            const fullyConsumed = newConsumed.gte(D(note.amount));
            await tx.creditNote.update({
                where: { id: note.id },
                data: {
                    status: fullyConsumed ? 'APPLIED' : 'PARTIALLY_APPLIED',
                    updatedAt: new Date(),
                },
            });
        }

        if (remaining.gt(0)) {
            throw new BadRequestError(
                `Credit balance inconsistent: ${remaining} could not be allocated`,
            );
        }
    }

    /**
     * Writes a balanced DEBIT/CREDIT pair to the ledger.
     */
    static async _postLedgerPair(
        tx,
        { schoolId, debitAccount, creditAccount, amount, referenceType, referenceId, narration },
    ) {
        const entryDate = new Date();
        await tx.ledgerEntry.createMany({
            data: [
                {
                    schoolId,
                    accountCode: debitAccount,
                    direction: 'DEBIT',
                    amount,
                    reference: `${referenceType}:${referenceId}`,
                    narration,
                    entryDate,
                },
                {
                    schoolId,
                    accountCode: creditAccount,
                    direction: 'CREDIT',
                    amount,
                    reference: `${referenceType}:${referenceId}`,
                    narration,
                    entryDate,
                },
            ],
        });
    }

    /**
     * Idempotency via unique index. Returns:
     *   { existing: true,  resultId }  if already claimed
     *   { existing: false, claimId }   if claimed fresh
     *
     * Uses INSERT ... ON CONFLICT DO NOTHING, then SELECT to fetch whichever
     * row won the race. The unique index (schoolId, scope, key) makes this atomic.
     */
    static async _claimIdempotencyKey(tx, schoolId, scope, key) {
        // Attempt to claim
        await tx.$executeRaw`
    INSERT INTO idempotency_keys ("id", "schoolId", "scope", "key", "resultId", "createdAt")
    VALUES (gen_random_uuid(), ${schoolId}, ${scope}, ${key}, '', NOW())
    ON CONFLICT ("schoolId", "scope", "key") DO NOTHING
    `;

        const [row] = await tx.$queryRaw`
    SELECT id, "resultId" AS result_id FROM idempotency_keys
    WHERE "schoolId" = ${schoolId} AND scope = ${scope} AND key = ${key}
      FOR UPDATE
    `;

        if (row.result_id) {
            return { existing: true, resultId: row.result_id };
        }
        return { existing: false, claimId: row.id };
    }

    /**
     * Updates the idempotency row with the actual result. Must be called
     * inside the same transaction that produced the result.
     */
    static async _recordIdempotencyResult(tx, schoolId, scope, key, resultId) {
        await tx.$executeRaw`
      UPDATE idempotency_keys
    SET "resultId" = ${resultId}
    WHERE "schoolId" = ${schoolId} AND scope = ${scope} AND key = ${key}
    `;
    }
}
