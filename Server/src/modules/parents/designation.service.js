import { prisma, runTransaction } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { NotFoundError, BadRequestError } from '../../shared/errors/AppError.js';
import { resolveSchoolId } from '../../shared/ownership.js';

export class ParentDesignationService {
    /**
     * Updates emergency contact and financial responsibility designations for a student-parent link.
     */
    static async updateDesignation(studentId, parentId, designations, actor, { ipAddress, userAgent } = {}) {
        const schoolId = resolveSchoolId(actor);

        // Verify linkage existence within school context
        const existingLink = await prisma.studentParent.findFirst({
            where: {
                studentId,
                parentId,
                student: { schoolId },
                parent: { schoolId },
            },
        });

        if (!existingLink) {
            throw new NotFoundError('Student-Parent linkage not found in this school');
        }

        const updatedLink = await runTransaction(async (tx) => {
            // If setting as Primary Contact, unset any previously designated primary contact for this student
            if (designations.isPrimaryContact === true) {
                await tx.studentParent.updateMany({
                    where: {
                        studentId,
                        isPrimaryContact: true,
                        student: { schoolId },
                        parent: { schoolId },
                    },
                    data: { isPrimaryContact: false },
                });
            }

            // If setting as Primary Payer, unset any previously designated primary payer for this student
            if (designations.isFinanciallyResponsible === true) {
                await tx.studentParent.updateMany({
                    where: {
                        studentId,
                        isFinanciallyResponsible: true,
                        student: { schoolId },
                        parent: { schoolId },
                    },
                    data: { isFinanciallyResponsible: false },
                });
            }

            return tx.studentParent.update({
                where: { studentId_parentId: { studentId, parentId } },
                data: designations,
                include: {
                    parent: true,
                    student: {
                        select: { id: true, admissionNo: true, firstName: true, lastName: true },
                    },
                },
            });
        });

        await recordAudit({
            action: 'UPDATE',
            actorId: actor.id,
            schoolId,
            entityType: 'StudentParent',
            entityId: `${studentId}_${parentId}`,
            metadata: designations,
            ipAddress,
            userAgent,
        });

        return updatedLink;
    }

    /**
     * Helper to retrieve the primary fee payer for invoice generation.
     */
    static async getPrimaryPayer(studentId, schoolId) {
        if (!schoolId) throw new BadRequestError('A school must be selected');
        const primaryPayer = await prisma.studentParent.findFirst({
            where: {
                studentId,
                isFinanciallyResponsible: true,
                student: { schoolId },
                parent: { schoolId },
            },
            include: { parent: true },
        });

        if (!primaryPayer) {
            // Fallback: Return any linked parent if no primary payer is designated
            const fallbackParent = await prisma.studentParent.findFirst({
                where: { studentId, student: { schoolId }, parent: { schoolId } },
                include: { parent: true },
            });

            if (!fallbackParent) {
                throw new BadRequestError('No linked parent found for fee invoicing');
            }

            return fallbackParent.parent;
        }

        return primaryPayer.parent;
    }
}
