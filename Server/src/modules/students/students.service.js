import { prisma, runTransaction } from '../../config/prisma.js';
import { nextAdmissionNo } from '../../shared/sequences.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';
import { userHasModuleAccess } from '../../api/middlewares/roleMiddleware.js';

const enrollmentSelect = {
    where: { status: 'ACTIVE' },
    take: 1,
    select: {
        id: true,
        status: true,
        academicYear: { select: { id: true, name: true } },
        stream: {
            select: {
                id: true,
                name: true,
                classLevel: { select: { id: true, name: true, curriculum: true } },
            },
        },
    },
};

const studentSummarySelect = {
    id: true,
    admissionNo: true,
    firstName: true,
    middleName: true,
    lastName: true,
    gender: true,
    dateOfBirth: true,
    admissionDate: true,
    isActive: true,
    schoolId: true,
    userId: true,
    createdAt: true,
    enrollments: enrollmentSelect,
    parents: {
        select: {
            parent: {
                select: {
                    id: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    phone: true,
                    relation: true,
                },
            },
        },
    },
};

const studentSelect = {
    ...studentSummarySelect,
    nationalIdNumber: true,
    birthCertificateNumber: true,
    passportNumber: true,
    parents: {
        select: {
            parent: {
                select: {
                    id: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    phone: true,
                    relation: true,
                    nationalIdNumber: true,
                },
            },
        },
    },
};

export class StudentService {
    static assertCanManage(actor) {
        if (!userHasModuleAccess(actor, 'STUDENTS')) {
            throw new ForbiddenError('Access denied to the STUDENTS module');
        }
    }

    /**
     * Admits a student, assigns initial enrollment, and links parents in a transaction.
     */
    static async create(input, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) {
            throw new BadRequestError('User context must belong to a school to perform admissions');
        }

        const student = await runTransaction(async (tx) => {
            // 1. Fetch school details to format admission number
            const school = await tx.school.findUnique({
                where: { id: schoolId },
                select: { schoolCode: true },
            });

            if (!school) throw new NotFoundError('School record not found');

            const admissionNo = await nextAdmissionNo(tx, schoolId, school.schoolCode);

            const [stream, academicYear] = await Promise.all([
                tx.stream.findFirst({
                    where: { id: input.streamId, schoolId },
                    select: { id: true },
                }),
                tx.academicYear.findFirst({
                    where: { id: input.academicYearId, schoolId },
                    select: { id: true },
                }),
            ]);
            if (!stream || !academicYear)
                throw new BadRequestError('Initial placement does not belong to this school');

            // 2. Create Student Record
            const newStudent = await tx.student.create({
                data: {
                    schoolId,
                    admissionNo,
                    firstName: input.firstName.trim(),
                    middleName: input.middleName ? input.middleName.trim() : null,
                    lastName: input.lastName.trim(),
                    gender: input.gender,
                    dateOfBirth: new Date(input.dateOfBirth),
                    nationalIdNumber: input.nationalIdNumber,
                    birthCertificateNumber: input.birthCertificateNumber,
                    passportNumber: input.passportNumber || null,
                },
            });

            // 3. Create Active Academic Enrollment
            await tx.enrollment.create({
                data: {
                    schoolId,
                    studentId: newStudent.id,
                    streamId: input.streamId,
                    academicYearId: input.academicYearId,
                    status: 'ACTIVE',
                },
            });

            // 4. Link Parents/Guardians if provided
            if (input.parents && input.parents.length > 0) {
                const parentIds = [...new Set(input.parents.map((parent) => parent.parentId))];
                const parents = await tx.parent.findMany({
                    where: { id: { in: parentIds }, schoolId },
                    select: { id: true },
                });
                if (parents.length !== parentIds.length)
                    throw new BadRequestError('One or more parents do not belong to this school');
                await tx.studentParent.createMany({
                    data: input.parents.map((p) => ({
                        studentId: newStudent.id,
                        parentId: p.parentId,
                    })),
                });
            }

            return tx.student.findUnique({
                where: { id: newStudent.id },
                select: studentSummarySelect,
            });
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Student',
            entityId: student.id,
            metadata: {
                admissionNo: student.admissionNo,
                name: `${student.firstName} ${student.lastName}`,
            },
            ipAddress,
            userAgent,
        });

        return student;
    }

    /**
     * Search and filter student registry.
     */
    static async list({ page = 1, pageSize = 20, search, streamId, isActive, schoolId }) {
        const where = {
            ...(schoolId ? { schoolId } : {}),
            ...(typeof isActive === 'boolean' ? { isActive } : {}),
            ...(streamId ? { enrollments: { some: { streamId, status: 'ACTIVE' } } } : {}),
            ...(search
                ? {
                      OR: [
                          { firstName: { contains: search, mode: 'insensitive' } },
                          { lastName: { contains: search, mode: 'insensitive' } },
                          { admissionNo: { contains: search, mode: 'insensitive' } },
                          { nationalIdNumber: { contains: search } },
                          { birthCertificateNumber: { contains: search } },
                      ],
                  }
                : {}),
        };

        const [students, total] = await runTransaction([
            prisma.student.findMany({
                where,
                select: studentSelect,
                orderBy: { admissionNo: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.student.count({ where }),
        ]);

        return {
            students,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    /**
     * Fetch single student record.
     */
    static async getById(studentId, actor) {
        if (!actor) throw new ForbiddenError('User context is required');

        const where = { id: studentId };
        if (actor.role !== 'SUPER_ADMIN') {
            if (!actor.schoolId) throw new ForbiddenError('User is not associated with a school');
            where.schoolId = actor.schoolId;
        }

        if (actor.role === 'PARENT') {
            where.parents = { some: { parent: { userId: actor.id } } };
        } else if (actor.role === 'STUDENT') {
            where.userId = actor.id;
        } else if (!userHasModuleAccess(actor, 'STUDENTS')) {
            throw new ForbiddenError('Access denied to the STUDENTS module');
        }

        const canViewIdentityDocuments = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(actor.role);
        const student = await prisma.student.findFirst({
            where,
            select: canViewIdentityDocuments ? studentSelect : studentSummarySelect,
        });

        if (!student) {
            throw new NotFoundError('Student profile not found');
        }

        return student;
    }

    static async assertInSchool(studentId, actor) {
        if (!actor) throw new ForbiddenError('User context is required');

        const where = { id: studentId };
        if (actor.role !== 'SUPER_ADMIN') {
            if (!actor.schoolId) throw new ForbiddenError('User is not associated with a school');
            where.schoolId = actor.schoolId;
        }

        const student = await prisma.student.findFirst({
            where,
            select: { id: true, schoolId: true },
        });
        if (!student) throw new NotFoundError('Student profile not found');
        return student;
    }

    /**
     * Update student details.
     */
    static async update(studentId, input, actor, { ipAddress, userAgent } = {}) {
        this.assertCanManage(actor);
        const student = await this.assertInSchool(studentId, actor);

        const updateData = { ...input };
        if (input.dateOfBirth) {
            updateData.dateOfBirth = new Date(input.dateOfBirth);
        }
        delete updateData.academicYearId;
        delete updateData.streamId;
        delete updateData.parents;

        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: updateData,
            select: studentSelect,
        });

        await recordAudit({
            action: 'UPDATE',
            actorId: actor.id,
            schoolId: student.schoolId,
            entityType: 'Student',
            entityId: studentId,
            metadata: { fields: Object.keys(input) },
            ipAddress,
            userAgent,
        });

        return updatedStudent;
    }

    /**
     * Link a parent to a student using StudentParent join table.
     */
    static async linkParent(studentId, parentId, actor) {
        this.assertCanManage(actor);
        const student = await this.assertInSchool(studentId, actor);

        const parent = await prisma.parent.findFirst({
            where: { id: parentId, schoolId: student.schoolId },
            select: { id: true },
        });
        if (!parent) throw new NotFoundError('Parent profile not found');

        const existingLink = await prisma.studentParent.findUnique({
            where: { studentId_parentId: { studentId, parentId } },
        });

        if (existingLink) {
            throw new BadRequestError('This parent is already linked to the student');
        }

        return prisma.studentParent.create({
            data: { studentId, parentId },
            include: { parent: true },
        });
    }

    /**
     * Remove link between parent and student.
     */
    static async unlinkParent(studentId, parentId, actor) {
        this.assertCanManage(actor);
        await this.assertInSchool(studentId, actor);

        try {
            await prisma.studentParent.delete({
                where: { studentId_parentId: { studentId, parentId } },
            });
            return { message: 'Parent link removed successfully' };
        } catch (error) {
            if (error?.code === 'P2025') {
                throw new NotFoundError('Link record between student and parent not found');
            }
            throw error;
        }
    }
}
