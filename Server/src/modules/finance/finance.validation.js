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
    method: z.enum(['MPESA', 'CASH', 'CHEQUE', 'BANK_DEPOSIT']),
    reference: z.string().optional(),
});