import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    prisma: {
        invoice: { findMany: vi.fn() },
        feeReminder: {
            create: vi.fn(),
            createMany: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
    },
    runTransaction: vi.fn(),
    recordAudit: vi.fn(),
    sendFeeReminder: vi.fn(),
}));

vi.mock('../src/config/prisma.js', () => ({
    prisma: mocks.prisma,
    runTransaction: mocks.runTransaction,
}));
vi.mock('../src/shared/audit.js', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('../src/shared/email.js', () => ({
    getConfiguredReminderProviders: () => [
        { provider: 'GMAIL', connected: true },
        { provider: 'OUTLOOK', connected: false },
    ],
    sendFeeReminder: mocks.sendFeeReminder,
}));

import { FeeReminderService } from '../src/modules/finance/fee-reminder.service.js';

function decimal(value) {
    return {
        value,
        minus(other) {
            return decimal(value - other.value);
        },
        gt(other) {
            return value > other.value;
        },
        toFixed(places) {
            return value.toFixed(places);
        },
    };
}

function overdueInvoice({ id = 'invoice-1', amountDue = 100, amountPaid = 15, parents } = {}) {
    return {
        id,
        schoolId: 'school-1',
        studentId: 'student-1',
        amountDue: decimal(amountDue),
        amountPaid: decimal(amountPaid),
        dueDate: new Date(Date.now() - 2 * 86400000),
        status: 'UNPAID',
        student: {
            id: 'student-1',
            admissionNo: 'A-100',
            firstName: 'Amina',
            middleName: null,
            lastName: 'Otieno',
            parents: (parents || []).map((parent) => ({ parent })),
        },
        term: { name: 'Term 1', academicYear: { name: '2026' } },
        reminders: [],
    };
}

beforeEach(() => {
    for (const model of Object.values(mocks.prisma)) {
        for (const method of Object.values(model)) method.mockReset();
    }
    mocks.runTransaction.mockReset().mockImplementation((operation) => operation(mocks.prisma));
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
    mocks.sendFeeReminder.mockReset().mockResolvedValue(undefined);
});

describe('fee reminder workflows', () => {
    it('previews the outstanding balance and deduplicates parent email recipients', async () => {
        mocks.prisma.invoice.findMany.mockResolvedValue([
            overdueInvoice({
                parents: [
                    { firstName: 'Sam', lastName: 'Otieno', email: 'sam@example.com' },
                    { firstName: 'Sam', lastName: 'Otieno', email: 'SAM@example.com' },
                ],
            }),
        ]);

        const result = await FeeReminderService.listOverdueInvoices({ id: 'actor-1', schoolId: 'school-1' });

        expect(result).toMatchObject({
            totalInvoices: 1,
            totalOutstanding: '85.00',
            recipientCount: 1,
            items: [
                {
                    studentName: 'Amina Otieno',
                    admissionNo: 'A-100',
                    outstanding: '85.00',
                    recipients: [{ email: 'sam@example.com', name: 'Sam Otieno' }],
                },
            ],
        });
    });

    it('queues personalized rows and records missing parent addresses as skipped', async () => {
        mocks.prisma.invoice.findMany.mockResolvedValue([
            overdueInvoice({
                parents: [{ firstName: 'Sam', lastName: 'Otieno', email: 'sam@example.com' }],
            }),
            overdueInvoice({ id: 'invoice-2', parents: [] }),
        ]);
        mocks.prisma.feeReminder.createMany.mockResolvedValue({ count: 2 });

        const result = await FeeReminderService.queueBulk(
            { provider: 'GMAIL', subject: 'Fee reminder' },
            { id: 'actor-1', schoolId: 'school-1' },
        );
        const rows = mocks.prisma.feeReminder.createMany.mock.calls[0][0].data;

        expect(result).toMatchObject({ invoiceCount: 2, recipientCount: 1, skippedCount: 1 });
        expect(rows).toEqual(expect.arrayContaining([
            expect.objectContaining({ recipientEmail: 'sam@example.com', provider: 'GMAIL' }),
            expect.objectContaining({ recipientEmail: null, status: 'SKIPPED' }),
        ]));
        expect(rows[0].message).toContain('Amina Otieno');
        expect(mocks.recordAudit).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'FeeReminderBatch' }),
            mocks.prisma,
        );
    });

    it('continues a batch when one provider send fails and persists every outcome', async () => {
        mocks.prisma.feeReminder.findMany.mockResolvedValue([
            { id: 'reminder-1', recipientEmail: 'one@example.com', provider: 'GMAIL', subject: 'S1', message: 'M1', invoiceId: 'invoice-1', senderId: 'actor-1' },
            { id: 'reminder-2', recipientEmail: 'two@example.com', provider: 'GMAIL', subject: 'S2', message: 'M2', invoiceId: 'invoice-2', senderId: 'actor-1' },
            { id: 'reminder-3', recipientEmail: null, provider: 'GMAIL', subject: 'S3', message: 'M3', invoiceId: 'invoice-3', senderId: 'actor-1' },
        ]);
        mocks.sendFeeReminder
            .mockResolvedValueOnce({ messageId: 'sent-1' })
            .mockRejectedValueOnce(new Error('SMTP unavailable'));
        mocks.prisma.feeReminder.update.mockResolvedValue({});

        const result = await FeeReminderService.processBatch('batch-1', 'school-1');

        expect(result).toEqual({ sent: 1, failed: 1, skipped: 1 });
        expect(mocks.sendFeeReminder).toHaveBeenCalledTimes(2);
        expect(mocks.prisma.feeReminder.update.mock.calls.map(([call]) => call.data.status)).toEqual([
            'SENT',
            'FAILED',
            'SKIPPED',
        ]);
        expect(mocks.prisma.feeReminder.update.mock.calls[1][0].data.failureReason).toBe('SMTP unavailable');
    });
});