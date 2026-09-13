import { z } from 'zod';

export const generateInvoicesSchema = z.object({
    termId: z.string().uuid(),
    classLevelId: z.string().uuid(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const recordPaymentSchema = z.object({
    invoiceId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
    amount: z.number().positive(),
    method: z.enum(['MPESA', 'CASH', 'CHEQUE', 'BANK_DEPOSIT', 'BANK_TRANSFER', 'CARD']),
    reference: z.string().optional(),
    idempotencyKey: z.string().trim().min(1).max(200).optional(),
    allocations: z.array(z.object({
        invoiceId: z.string().uuid(),
        amount: z.number().positive(),
    })).max(100).optional(),
    checkoutRequestId: z.string().trim().max(200).optional(),
    mpesaReceipt: z.string().trim().max(200).optional(),
});

export const reversePaymentSchema = z.object({
    reason: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export const refundPaymentSchema = z.object({
    amount: z.number().positive(),
    method: z.enum(['MPESA', 'CASH', 'CHEQUE', 'BANK_DEPOSIT', 'BANK_TRANSFER', 'CARD']).optional(),
    reference: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export const applyCreditSchema = z.object({
    studentId: z.string().uuid(),
    invoiceId: z.string().uuid(),
    amount: z.number().positive(),
    idempotencyKey: z.string().trim().min(1).max(200).optional(),
});