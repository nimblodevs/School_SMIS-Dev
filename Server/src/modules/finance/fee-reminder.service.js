import { randomUUID } from 'node:crypto';
import { prisma, runTransaction } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { getConfiguredReminderProviders, sendFeeReminder } from '../../shared/email.js';

function requireSchool(actor) {
    if (!actor?.schoolId) throw new BadRequestError('A school must be selected');
    return actor.schoolId;
}

function requireConfiguredProvider(provider) {
    const configured = getConfiguredReminderProviders().find((item) => item.provider === provider);
    if (!configured?.connected) {
        throw new BadRequestError(`${provider} email is not configured for this server`);
    }
}

function invoiceView(invoice, today) {
    const amountDue = invoice.amountDue;
    const amountPaid = invoice.amountPaid;
    const balance = amountDue.minus(amountPaid);
    const studentName = [invoice.student.firstName, invoice.student.middleName, invoice.student.lastName]
        .filter(Boolean)
        .join(' ');
    const recipients = new Map();
    for (const { parent } of invoice.student.parents) {
        if (parent.email) {
            const normalizedEmail = parent.email.trim().toLowerCase();
            if (!recipients.has(normalizedEmail)) {
                recipients.set(normalizedEmail, {
                    email: parent.email,
                    name: [parent.firstName, parent.lastName].filter(Boolean).join(' '),
                });
            }
        }
    }
    return {
        id: invoice.id,
        studentId: invoice.studentId,
        studentName,
        admissionNo: invoice.student.admissionNo,
        term: invoice.term.name,
        academicYear: invoice.term.academicYear.name,
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        amountDue: amountDue.toFixed(2),
        amountPaid: amountPaid.toFixed(2),
        outstanding: balance.toFixed(2),
        daysOverdue: Math.max(1, Math.floor((today.getTime() - invoice.dueDate.getTime()) / 86400000)),
        recipients: [...recipients.values()],
        reminderHistory: invoice.reminders.map((reminder) => ({
            id: reminder.id,
            recipientEmail: reminder.recipientEmail,
            provider: reminder.provider,
            status: reminder.status,
            failureReason: reminder.failureReason,
            sentAt: reminder.sentAt,
            createdAt: reminder.createdAt,
        })),
    };
}

function personalize(template, invoice, recipient) {
    return template
        .replaceAll('{{parentName}}', recipient.name || 'Parent/Guardian')
        .replaceAll('{{studentName}}', invoice.studentName)
        .replaceAll('{{admissionNo}}', invoice.admissionNo)
        .replaceAll('{{invoiceId}}', invoice.id)
        .replaceAll('{{term}}', invoice.term)
        .replaceAll('{{academicYear}}', invoice.academicYear)
        .replaceAll('{{dueDate}}', invoice.dueDate)
        .replaceAll('{{balance}}', invoice.outstanding);
}

function defaultSubject(invoice) {
    return `Fee reminder for ${invoice.studentName}`;
}

function defaultMessage(invoice, recipient, note = '') {
    const greeting = recipient.name ? `Hello ${recipient.name},` : 'Hello Parent/Guardian,';
    return [
        greeting,
        '',
        `Our records show an outstanding school fee balance for ${invoice.studentName} (${invoice.admissionNo}).`,
        `Term: ${invoice.term} ${invoice.academicYear}`,
        `Outstanding balance: ${invoice.outstanding}`,
        `Due date: ${invoice.dueDate}`,
        `Invoice reference: ${invoice.id}`,
        ...(note ? ['', note] : []),
        '',
        'Please contact the school finance office if you have already made this payment or need assistance.',
    ].join('\n');
}

export class FeeReminderService {
    static configuredProviders() {
        return getConfiguredReminderProviders();
    }

    static async listOverdueInvoices(actor) {
        const schoolId = requireSchool(actor);
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const invoices = await prisma.invoice.findMany({
            where: {
                schoolId,
                dueDate: { lt: today },
                status: { not: 'PAID' },
            },
            include: {
                student: {
                    select: {
                        id: true,
                        admissionNo: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        parents: {
                            select: {
                                parent: { select: { firstName: true, lastName: true, email: true } },
                            },
                        },
                    },
                },
                term: { select: { name: true, academicYear: { select: { name: true } } } },
                reminders: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        recipientEmail: true,
                        provider: true,
                        status: true,
                        failureReason: true,
                        sentAt: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { dueDate: 'asc' },
        });

        const items = invoices
            .filter((invoice) => invoice.amountDue.gt(invoice.amountPaid))
            .map((invoice) => invoiceView(invoice, today));
        const totalOutstanding = items.reduce(
            (total, invoice) => total + Number(invoice.outstanding),
            0,
        );
        return {
            items,
            totalInvoices: items.length,
            totalOutstanding: totalOutstanding.toFixed(2),
            recipientCount: items.reduce((total, invoice) => total + invoice.recipients.length, 0),
        };
    }

    static async queueSingle({ invoiceId, provider, recipientEmail, subject, message }, actor) {
        const schoolId = requireSchool(actor);
        requireConfiguredProvider(provider);
        const [invoice] = (await this.listOverdueInvoices(actor)).items
            .filter((item) => item.id === invoiceId);
        if (!invoice) throw new NotFoundError('Overdue invoice not found in this school');

        const email = recipientEmail?.trim();
        if (!email) throw new BadRequestError('A recipient email is required');
        const recipient = invoice.recipients.find(
            (item) => item.email.toLowerCase() === email.toLowerCase(),
        ) || { email, name: '' };
        const batchId = randomUUID();
        const reminder = await runTransaction(async (tx) => {
            const created = await tx.feeReminder.create({
                data: {
                    schoolId,
                    invoiceId,
                    batchId,
                    recipientEmail: email,
                    provider,
                    subject: personalize(subject || defaultSubject(invoice), invoice, recipient),
                    message: personalize(message || defaultMessage(invoice, recipient), invoice, recipient),
                    senderId: actor.id,
                },
            });
            await recordAudit({
                action: 'UPDATE',
                actorId: actor.id,
                schoolId,
                entityType: 'FeeReminder',
                entityId: created.id,
                metadata: { status: 'PENDING', provider, invoiceId, batchId },
            }, tx);
            return created;
        });

        return { batchId, invoiceCount: 1, recipientCount: 1, reminderIds: [reminder.id] };
    }

    static async queueBulk({ provider, subject, note }, actor) {
        const schoolId = requireSchool(actor);
        requireConfiguredProvider(provider);
        const overdue = await this.listOverdueInvoices(actor);
        if (!overdue.items.length) throw new BadRequestError('There are no overdue invoices to remind');

        const batchId = randomUUID();
        const entries = [];
        for (const invoice of overdue.items) {
            if (!invoice.recipients.length) {
                entries.push({
                    schoolId,
                    invoiceId: invoice.id,
                    batchId,
                    recipientEmail: null,
                    provider,
                    subject: personalize(subject || defaultSubject(invoice), invoice, { name: '' }),
                    message: personalize(defaultMessage(invoice, { name: '' }, note), invoice, { name: '' }),
                    status: 'SKIPPED',
                    failureReason: 'No parent or guardian email is available',
                    senderId: actor.id,
                });
                continue;
            }
            for (const recipient of invoice.recipients) {
                entries.push({
                    schoolId,
                    invoiceId: invoice.id,
                    batchId,
                    recipientEmail: recipient.email,
                    provider,
                    subject: personalize(subject || defaultSubject(invoice), invoice, recipient),
                    message: personalize(defaultMessage(invoice, recipient, note), invoice, recipient),
                    senderId: actor.id,
                });
            }
        }

        await runTransaction(async (tx) => {
            await tx.feeReminder.createMany({ data: entries });
            await recordAudit({
                action: 'UPDATE',
                actorId: actor.id,
                schoolId,
                entityType: 'FeeReminderBatch',
                entityId: batchId,
                metadata: {
                    status: 'QUEUED',
                    provider,
                    invoiceCount: overdue.totalInvoices,
                    recipientCount: entries.filter((entry) => entry.status !== 'SKIPPED').length,
                    skippedCount: entries.filter((entry) => entry.status === 'SKIPPED').length,
                },
            }, tx);
        });

        return {
            batchId,
            invoiceCount: overdue.totalInvoices,
            recipientCount: entries.filter((entry) => entry.status !== 'SKIPPED').length,
            skippedCount: entries.filter((entry) => entry.status === 'SKIPPED').length,
        };
    }

    static async markBatchQueueFailed(batchId, schoolId, error) {
        await prisma.feeReminder.updateMany({
            where: { batchId, schoolId, status: 'PENDING' },
            data: { status: 'FAILED', failureReason: `Queue failed: ${error.message}` },
        });
    }

    static async getBatch(batchId, actor) {
        const schoolId = requireSchool(actor);
        const reminders = await prisma.feeReminder.findMany({
            where: { batchId, schoolId },
            include: {
                invoice: {
                    select: {
                        id: true,
                        amountDue: true,
                        amountPaid: true,
                        dueDate: true,
                        student: { select: { admissionNo: true, firstName: true, lastName: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        if (!reminders.length) throw new NotFoundError('Reminder batch not found');
        const counts = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
        for (const reminder of reminders) counts[reminder.status]++;
        const total = reminders.length;
        const completed = total - counts.PENDING;
        return {
            batchId,
            total,
            completed,
            progress: total ? Math.round((completed / total) * 100) : 100,
            counts,
            reminders,
        };
    }

    static async processBatch(batchId, schoolId) {
        const reminders = await prisma.feeReminder.findMany({
            where: { batchId, schoolId, status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
        });
        const result = { sent: 0, failed: 0, skipped: 0 };
        for (const reminder of reminders) {
            let status = 'SENT';
            let failureReason = null;
            let sentAt = new Date();
            try {
                if (!reminder.recipientEmail) {
                    status = 'SKIPPED';
                    failureReason = 'No recipient email is available';
                    sentAt = null;
                } else {
                    await sendFeeReminder({
                        provider: reminder.provider,
                        to: reminder.recipientEmail,
                        subject: reminder.subject,
                        text: reminder.message,
                    });
                }
            } catch (error) {
                status = 'FAILED';
                failureReason = error.message.slice(0, 2000);
                sentAt = null;
            }

            await prisma.feeReminder.update({
                where: { id: reminder.id },
                data: { status, failureReason, sentAt },
            });
            result[status.toLowerCase()]++;
            await recordAudit({
                action: 'UPDATE',
                actorId: reminder.senderId,
                schoolId,
                entityType: 'FeeReminder',
                entityId: reminder.id,
                metadata: { status, invoiceId: reminder.invoiceId, provider: reminder.provider },
            });
        }
        return result;
    }
}