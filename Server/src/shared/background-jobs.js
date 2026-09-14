import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { HRService } from '../modules/humanresource/hr.service.js';
import { PayrollService } from '../modules/payroll/payroll.service.js';
import { DocumentService } from '../modules/storage/document.service.js';
import { StorageService } from '../modules/storage/storage.service.js';
import { sendPayslipEmail } from './email.js';

export const JOB_TYPES = {
    REPORT_CARD_PDF: 'REPORT_CARD_PDF',
    PAYROLL_RUN: 'PAYROLL_RUN',
    PAYSLIP_PDF: 'PAYSLIP_PDF',
    FILE_PROCESSING: 'FILE_PROCESSING',
    LEAVE_BALANCE_RESET: 'LEAVE_BALANCE_RESET',
};

export async function enqueueJob({
    type,
    schoolId = null,
    payload = {},
    availableAt = new Date(),
    maxAttempts = 3,
}) {
    return prisma.backgroundJob.create({
        data: { id: randomUUID(), type, schoolId, payload, availableAt, maxAttempts },
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
    let actor = { id: null, schoolId: job.schoolId, role: 'SYSTEM' };
    if (job.payload.actorId) {
        const requestingUser = await prisma.user.findFirst({
            where: { id: job.payload.actorId, schoolId: job.schoolId },
            select: { id: true, schoolId: true, role: true },
        });
        if (!requestingUser) {
            throw new Error('Background job requester no longer exists in this school');
        }
        actor = requestingUser;
    }

    switch (job.type) {
        case JOB_TYPES.REPORT_CARD_PDF:
            return DocumentService.generateReportCardPdf(job.payload, actor);
        case JOB_TYPES.PAYROLL_RUN: {
            const run = await PayrollService.executePayrollRun(
                { year: job.payload.year, month: job.payload.month },
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
                        payload: {
                            payslipId: payslip.id,
                            actorId: job.payload.actorId,
                        },
                    }),
                ),
            );
            return run;
        }
        case JOB_TYPES.PAYSLIP_PDF: {
            const file = await DocumentService.generatePayslipPdf(job.payload.payslipId, actor);
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
            return DocumentService.processImage(job.payload.fileUploadId, actor);
        case JOB_TYPES.LEAVE_BALANCE_RESET: {
            const schools = job.schoolId
                ? [{ id: job.schoolId }]
                : await prisma.school.findMany({ where: { isActive: true }, select: { id: true } });
            for (const school of schools) {
                await HRService.resetLeaveBalances(school.id, job.payload.year, {
                    id: null,
                    schoolId: school.id,
                    role: 'SYSTEM',
                });
            }
            return { schools: schools.length, year: job.payload.year };
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
