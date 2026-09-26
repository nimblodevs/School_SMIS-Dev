import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { HRService } from '../modules/humanresource/hr.service.js';
import { PayrollService } from '../modules/payroll/payroll.service.js';
import { DocumentService } from '../modules/storage/document.service.js';
import { StorageService } from '../modules/storage/storage.service.js';
import { FeeReminderService } from '../modules/finance/fee-reminder.service.js';
import { sendPayslipEmail } from './email.js';
import { z } from 'zod';

export const JOB_TYPES = {
    REPORT_CARD_PDF: 'REPORT_CARD_PDF',
    PAYROLL_RUN: 'PAYROLL_RUN',
    PAYSLIP_PDF: 'PAYSLIP_PDF',
    FILE_PROCESSING: 'FILE_PROCESSING',
    LEAVE_BALANCE_RESET: 'LEAVE_BALANCE_RESET',
    FEE_REMINDER_BATCH: 'FEE_REMINDER_BATCH',
};

const jobPayloadSchemas = {
    [JOB_TYPES.REPORT_CARD_PDF]: z.object({
        termId: z.string().uuid(),
        studentId: z.string().uuid(),
        actorId: z.string().uuid(),
    }),
    [JOB_TYPES.PAYROLL_RUN]: z.object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        actorId: z.string().uuid(),
    }),
    [JOB_TYPES.PAYSLIP_PDF]: z.object({ payslipId: z.string().uuid() }),
    [JOB_TYPES.FILE_PROCESSING]: z.object({
        fileUploadId: z.string().uuid(),
        actorId: z.string().uuid(),
    }),
    [JOB_TYPES.LEAVE_BALANCE_RESET]: z.object({ year: z.number().int().min(2000).max(2100) }),
    [JOB_TYPES.FEE_REMINDER_BATCH]: z.object({
        batchId: z.string().uuid(),
        actorId: z.string().uuid(),
    }),
};

export function validateJobPayload(type, payload) {
    const schema = jobPayloadSchemas[type];
    if (!schema) throw new Error(`Unsupported background job type: ${type}`);
    return schema.parse(payload);
}

export function normalizePersistedJobPayload(type, payload) {
    if (
        type === JOB_TYPES.PAYROLL_RUN &&
        typeof payload?.month === 'string' &&
        /^\d{4}-\d{2}$/.test(payload.month) &&
        payload.year === undefined
    ) {
        const [year, month] = payload.month.split('-').map(Number);
        return { year, month, actorId: payload.actorId };
    }
    return payload;
}

export async function enqueueJob({
    type,
    schoolId = null,
    payload = {},
    availableAt = new Date(),
    maxAttempts = 3,
}) {
    const validatedPayload = validateJobPayload(type, payload);
    return prisma.backgroundJob.create({
        data: {
            id: randomUUID(),
            type,
            schoolId,
            payload: validatedPayload,
            availableAt,
            maxAttempts,
        },
    });
}

async function claimNextJob() {
    const candidate = await prisma.backgroundJob.findFirst({
        where: { status: 'QUEUED', availableAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;

    const claimed = await prisma.backgroundJob.updateMany({
        where: { id: candidate.id, status: 'QUEUED' },
        data: { status: 'PROCESSING', lockedAt: new Date(), attempts: { increment: 1 } },
    });
    return claimed.count ? { ...candidate, attempts: candidate.attempts + 1 } : null;
}

async function runJob(job) {
    const payload = validateJobPayload(
        job.type,
        normalizePersistedJobPayload(job.type, job.payload),
    );
    let actor = { id: null, schoolId: job.schoolId, role: 'SYSTEM', modulePermissions: [] };
    if (payload.actorId) {
        const user = await prisma.user.findFirst({
            where: { id: payload.actorId, isActive: true },
            select: {
                id: true,
                schoolId: true,
                role: true,
                staffModuleAccess: { select: { module: true } },
            },
        });
        if (
            !user ||
            (user.role !== 'SUPER_ADMIN' && user.schoolId !== job.schoolId)
        ) throw new Error('Background job actor is no longer active in this school');
        actor = {
            id: user.id,
            schoolId: user.role === 'SUPER_ADMIN' ? job.schoolId : user.schoolId,
            role: user.role,
            modulePermissions: user.staffModuleAccess.map(({ module }) => module),
        };
    }

    switch (job.type) {
        case JOB_TYPES.REPORT_CARD_PDF:
            return DocumentService.generateReportCardPdf(payload, actor);
        case JOB_TYPES.PAYROLL_RUN: {
            const run = await PayrollService.executePayrollRun(
                { year: payload.year, month: payload.month },
                actor,
            );
            const payslips = await prisma.payslip.findMany({
                where: { payrollRunId: run.id, schoolId: job.schoolId },
            });
            await Promise.all(
                payslips.map((payslip) =>
                    enqueueJob({
                        type: JOB_TYPES.PAYSLIP_PDF,
                        schoolId: job.schoolId,
                        payload: { payslipId: payslip.id },
                    }),
                ),
            );
            return run;
        }
        case JOB_TYPES.PAYSLIP_PDF: {
            const file = await DocumentService.generatePayslipPdf(payload.payslipId, actor);
            const payslip = await prisma.payslip.findFirst({
                where: { id: job.payload.payslipId, schoolId: job.schoolId },
                include: {
                    payrollRun: true,
                    teacher: { include: { user: true } },
                    staff: { include: { user: true } },
                },
            });
            const user = payslip?.teacher?.user || payslip?.staff?.user;
            if (user?.email) {
                const downloadUrl = await StorageService.createDownloadUrl(
                    file.storageKey,
                    job.schoolId,
                );
                await sendPayslipEmail({
                    to: user.email,
                    employeeName: `${payslip.teacher?.firstName || payslip.staff?.firstName} ${payslip.teacher?.lastName || payslip.staff?.lastName}`,
                    month: payslip.payrollRun.month,
                    downloadUrl,
                });
            }
            return file;
        }
        case JOB_TYPES.FILE_PROCESSING:
            return DocumentService.processImage(payload.fileUploadId, actor);
        case JOB_TYPES.FEE_REMINDER_BATCH:
            return FeeReminderService.processBatch(payload.batchId, job.schoolId);
        case JOB_TYPES.LEAVE_BALANCE_RESET: {
            const schools = job.schoolId
                ? [{ id: job.schoolId }]
                : await prisma.school.findMany({ where: { isActive: true }, select: { id: true } });
            for (const school of schools) {
                await HRService.resetLeaveBalances(school.id, payload.year, {
                    ...actor,
                    schoolId: school.id,
                });
            }
            return { schools: schools.length, year: payload.year };
        }
        default:
            throw new Error(`Unsupported background job type: ${job.type}`);
    }
}

export async function processNextJob() {
    const job = await claimNextJob();
    if (!job) return false;
    try {
        const result = await runJob(job);
        await prisma.backgroundJob.update({
            where: { id: job.id },
            data: { status: 'COMPLETED', completedAt: new Date(), result },
        });
    } catch (error) {
        const retry = job.attempts < job.maxAttempts;
        await prisma.backgroundJob.update({
            where: { id: job.id },
            data: {
                status: retry ? 'QUEUED' : 'FAILED',
                availableAt: retry ? new Date(Date.now() + job.attempts * 30000) : new Date(),
                error: error.message,
                lockedAt: null,
            },
        });
        logger.error({ err: error, jobId: job.id, type: job.type }, 'Background job failed');
    }
    return true;
}

export function startBackgroundProcessing() {
    const interval = setInterval(
        () =>
            processNextJob().catch((error) =>
                logger.error({ err: error }, 'Background worker tick failed'),
            ),
        2000,
    );
    interval.unref();
    cron.schedule('15 0 1 1 *', () =>
        enqueueJob({
            type: JOB_TYPES.LEAVE_BALANCE_RESET,
            payload: { year: new Date().getFullYear() },
        }).catch((error) => logger.error({ err: error }, 'Annual leave reset could not be queued')),
    );
    return () => clearInterval(interval);
}
