import { FinanceService } from './finance.service.js';
import { RefundService } from './refund.service.js';
import {
    applyCreditSchema,
    generateInvoicesSchema,
    recordPaymentSchema,
    refundPaymentSchema,
    reversePaymentSchema,
} from './finance.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { FeeReminderService } from './fee-reminder.service.js';
import {
    bulkReminderSchema,
    reminderBatchIdSchema,
    reminderInvoiceIdSchema,
    singleReminderSchema,
} from './fee-reminder.validation.js';
import { enqueueJob, JOB_TYPES } from '../../shared/background-jobs.js';

async function enqueueReminderBatch(batch, req) {
    try {
        return await enqueueJob({
            type: JOB_TYPES.FEE_REMINDER_BATCH,
            schoolId: req.user.schoolId,
            payload: { batchId: batch.batchId, actorId: req.user.id },
        });
    } catch (error) {
        await FeeReminderService.markBatchQueueFailed(batch.batchId, req.user.schoolId, error);
        throw error;
    }
}

export class FinanceController {
    static async reminderProviders(req, res, next) {
        try {
            return res.json({ success: true, data: FeeReminderService.configuredProviders() });
        } catch (error) {
            next(error);
        }
    }

    static async listOverdueInvoices(req, res, next) {
        try {
            const data = await FeeReminderService.listOverdueInvoices(req.user);
            return res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    static async queueInvoiceReminder(req, res, next) {
        try {
            const params = reminderInvoiceIdSchema.safeParse(req.params);
            const validation = singleReminderSchema.safeParse(req.body);
            if (!params.success || !validation.success) {
                throw new BadRequestError(
                    'Validation error',
                    params.success ? validation.error.format() : params.error.format(),
                );
            }
            const batch = await FeeReminderService.queueSingle(
                { invoiceId: params.data.invoiceId, ...validation.data },
                req.user,
            );
            const job = await enqueueReminderBatch(batch, req);
            return res.status(202).json({
                success: true,
                message: 'Fee reminder queued',
                data: { ...batch, jobId: job.id },
            });
        } catch (error) {
            next(error);
        }
    }

    static async queueBulkReminders(req, res, next) {
        try {
            const validation = bulkReminderSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation error', validation.error.format());
            const batch = await FeeReminderService.queueBulk(validation.data, req.user);
            const job = await enqueueReminderBatch(batch, req);
            return res.status(202).json({
                success: true,
                message: 'Bulk fee reminders queued',
                data: { ...batch, jobId: job.id },
            });
        } catch (error) {
            next(error);
        }
    }

    static async getReminderBatch(req, res, next) {
        try {
            const validation = reminderBatchIdSchema.safeParse(req.params);
            if (!validation.success)
                throw new BadRequestError('Validation error', validation.error.format());
            const data = await FeeReminderService.getBatch(validation.data.batchId, req.user);
            return res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    static async generateTermInvoices(req, res, next) {
        try {
            const validation = generateInvoicesSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const result = await FinanceService.generateTermInvoices(validation.data, req.user);

            return res.status(201).json({
                success: true,
                message: 'Term invoices generated successfully',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    static async recordPayment(req, res, next) {
        try {
            const validation = recordPaymentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const payment = await FinanceService.recordPayment(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            return res.status(201).json({
                success: true,
                message: 'Payment recorded and invoice balance updated',
                data: payment,
            });
        } catch (error) {
            next(error);
        }
    }

    static async reversePayment(req, res, next) {
        try {
            const validation = reversePaymentSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation Error', validation.error.format());
            const result = await RefundService.reversePayment(
                req.params.paymentId,
                validation.data,
                req.user,
                { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
            );
            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async refundPayment(req, res, next) {
        try {
            const validation = refundPaymentSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation Error', validation.error.format());
            const result = await RefundService.refundPayment(
                req.params.paymentId,
                validation.data,
                req.user,
                { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
            );
            return res.status(201).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async applyCredit(req, res, next) {
        try {
            const validation = applyCreditSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation Error', validation.error.format());
            const result = await RefundService.applyCreditToInvoice(validation.data, req.user, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(201).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
}
