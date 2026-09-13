import { prisma } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import bcrypt from 'bcryptjs';

const parentSelect = {
    id: true,
    firstName: true,
    middleName: true,
    lastName: true,
    nationalIdNumber: true,
    phone: true,
    email: true,
    relation: true,
    schoolId: true,
    userId: true,
    createdAt: true,
    user: {
        select: {
            id: true,
            email: true,
            isActive: true,
        },
    },
    students: {
        select: {
            student: {
                select: {
                    id: true,
                    admissionNo: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    gender: true,
                    isActive: true,
                    enrollments: {
                        where: { status: 'ACTIVE' },
                        take: 1,
                        select: {
                            stream: {
                                select: {
                                    name: true,
                                    classLevel: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

export class ParentService {
    /**
     * Create a parent profile and optionally provision a portal user account.
     */
    static async create(input, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) {
            throw new BadRequestError('User context must belong to a school to register parents');
        }

        const parent = await prisma.$transaction(async (tx) => {
            // Check if national ID already exists in this school
            const existingParent = await tx.parent.findFirst({
                where: { schoolId, nationalIdNumber: input.nationalIdNumber },
            });

            if (existingParent) {
                throw new BadRequestError('A parent with this National ID number already exists');
            }

            let userId = null;

            // Provision User login if requested
            if (input.createPortalAccount) {
                const portalEmail = input.email || `${input.phone}@parent.school`;

                const existingUser = await tx.user.findUnique({ where: { email: portalEmail } });
                if (existingUser) {
                    throw new BadRequestError('An account with this email address already exists');
                }

                // Generate default password (e.g., Parent Phone number)
                const hashedPassword = await bcrypt.hash(input.phone, 10);

                const newUser = await tx.user.create({
                    data: {
                        email: portalEmail,
                        passwordHash: hashedPassword,
                        role: 'PARENT',
                        schoolId,
                    },
                });
                userId = newUser.id;
            }

            // Create Parent record
            return tx.parent.create({
                data: {
                    schoolId,
                    userId,
                    firstName: input.firstName.trim(),
                    middleName: input.middleName ? input.middleName.trim() : null,
                    lastName: input.lastName.trim(),
                    nationalIdNumber: input.nationalIdNumber,
                    phone: input.phone,
                    email: input.email || null,
                    relation: input.relation,
                },
                select: parentSelect,
            });
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Parent',
            entityId: parent.id,
            metadata: { name: `${parent.firstName} ${parent.lastName}`, phone: parent.phone },
            ipAddress,
            userAgent,
        });

        return parent;
    }

    /**
     * Search and filter parent registry.
     */
    static async list({ page = 1, pageSize = 20, search, schoolId }) {
        const where = {
            ...(schoolId ? { schoolId } : {}),
            ...(search
                ? {
                    OR: [
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search } },
                        { nationalIdNumber: { contains: search } },
                        { email: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };

        const [parents, total] = await prisma.$transaction([
            prisma.parent.findMany({
                where,
                select: parentSelect,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.parent.count({ where }),
        ]);

        return {
            parents,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    /**
     * Fetch single parent details.
     */
    static async getById(parentId, schoolId) {
        const parent = await prisma.parent.findFirst({
            where: {
                id: parentId,
                ...(schoolId ? { schoolId } : {}),
            },
            select: parentSelect,
        });

        if (!parent) {
            throw new NotFoundError('Parent profile not found');
        }

        return parent;
    }

    /**
     * Update parent profile.
     */
    static async update(parentId, input, actor, { ipAddress, userAgent } = {}) {
        await this.getById(parentId, actor.schoolId);

        const updatedParent = await prisma.parent.update({
            where: { id: parentId },
            data: {
                ...(input.firstName && { firstName: input.firstName.trim() }),
                ...(input.middleName !== undefined && { middleName: input.middleName ? input.middleName.trim() : null }),
                ...(input.lastName && { lastName: input.lastName.trim() }),
                ...(input.nationalIdNumber && { nationalIdNumber: input.nationalIdNumber }),
                ...(input.phone && { phone: input.phone }),
                ...(input.email !== undefined && { email: input.email || null }),
                ...(input.relation && { relation: input.relation }),
            },
            select: parentSelect,
        });

        await recordAudit({
            action: 'UPDATE',
            actorId: actor.id,
            schoolId: actor.schoolId,
            entityType: 'Parent',
            entityId: parentId,
            metadata: { fields: Object.keys(input) },
            ipAddress,
            userAgent,
        });

        return updatedParent;
    }

    /**
     * Link a student to a parent.
     */
    static async linkStudent(parentId, studentId, actor) {
        await this.getById(parentId, actor.schoolId);

        const student = await prisma.student.findFirst({
            where: { id: studentId, schoolId: actor.schoolId },
        });

        if (!student) {
            throw new NotFoundError('Student record not found in this school');
        }

        const existingLink = await prisma.studentParent.findUnique({
            where: { studentId_parentId: { studentId, parentId } },
        });

        if (existingLink) {
            throw new BadRequestError('Student is already linked to this parent');
        }

        return prisma.studentParent.create({
            data: { studentId, parentId },
            include: {
                student: {
                    select: { id: true, admissionNo: true, firstName: true, lastName: true },
                },
            },
        });
    }

    /**
     * Unlink a student from a parent.
     */
    static async unlinkStudent(parentId, studentId, actor) {
        await this.getById(parentId, actor.schoolId);

        try {
            await prisma.studentParent.delete({
                where: { studentId_parentId: { studentId, parentId } },
            });
            return { message: 'Student successfully unlinked from parent' };
        } catch (error) {
            if (error?.code === 'P2025') {
                throw new NotFoundError('Association between student and parent not found');
            }
            throw error;
        }
    }
}