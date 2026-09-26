import { z } from 'zod';

const providerSchema = z.enum(['GMAIL', 'OUTLOOK']);

export const singleReminderSchema = z.object({
    provider: providerSchema,
    recipientEmail: z.string().trim().email(),
    subject: z.string().trim().max(200).optional(),
    message: z.string().trim().max(5000).optional(),
});

export const bulkReminderSchema = z.object({
    provider: providerSchema,
    subject: z.string().trim().max(200).optional(),
    note: z.string().trim().max(2000).optional(),
});

export const reminderBatchIdSchema = z.object({
    batchId: z.string().uuid(),
});

export const reminderInvoiceIdSchema = z.object({
    invoiceId: z.string().uuid(),
});