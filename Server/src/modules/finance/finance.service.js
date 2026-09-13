import { prisma } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';

export class FinanceService {
    static async generateTermInvoices({ termId, classLevelId, dueDate }, actor) {
        const schoolId = actor.schoolId;

        const feeStructure = await prisma.feeStructure.findUnique({
            where: { termId_classLevelId: { termId, classLevelId } },
        });
        if (!feeStructure) throw new NotFoundError('Fee structure not defined for class level and term');

        const activeEnrollments = await prisma.enrollment.findMany({
            where: {
                schoolId,
                status: 'ACTIVE',
                stream: { classLevelId },
            },
        });

        const createdInvoices = await prisma.$transaction(async (tx) => {
            const invoices = [];
            for (const enrollment of activeEnrollments) {
                const inv = await tx.invoice.upsert({
                    where: {
                        studentId_termId: {
                            studentId: enrollment.studentId,
                            termId,
                        },
                    },
                    update: {}, // Preserve existing status if already billed
                    create: {
                        schoolId,
                        studentId: enrollment.studentId,
                        enrollmentId: enrollment.id,
                        termId,
                        amountDue: feeStructure.amount,
                        dueDate: new Date(dueDate),
                    },
                });
                invoices.push(inv);
            }
            return invoices;
        });

        return { totalGenerated: createdInvoices.length };
    }

    static async recordPayment(payload, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;

        return prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    schoolId,
                    invoiceId: payload.invoiceId,
                    studentId: payload.studentId,
                    amount: payload.amount,
                    method: payload.method,
                    status: 'COMPLETED',
                    reference: payload.reference,
                    recordedById: actor.id,
                    paidAt: new Date(),
                },
            });

            if (payload.invoiceId) {
                const invoice = await tx.invoice.findUnique({ where: { id: payload.invoiceId } });
                if (invoice) {
                    const newPaidAmount = Number(invoice.amountPaid) + Number(payload.amount);
                    const isPaidInFull = newPaidAmount >= Number(invoice.amountDue);

                    await tx.invoice.update({
                        where: { id: payload.invoiceId },
                        data: {
                            amountPaid: newPaidAmount,
                            status: isPaidInFull ? 'PAID' : 'PARTIALLY_PAID',
                        },
                    });
                }
            }

            await recordAudit({
                action: 'CREATE',
                actorId: actor.id,
                schoolId,
                entityType: 'Payment',
                entityId: payment.id,
                metadata: payload,
                ipAddress,
                userAgent,
            });

            return payment;
        });
    }
}