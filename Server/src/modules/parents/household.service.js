import { prisma } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';

export class HouseholdService {
    /**
     * Fetches all children/siblings tied to a parent account.
     */
    static async getHouseholdOverview(parentId, schoolId) {
        if (!schoolId) throw new BadRequestError('A school must be selected');
        const parent = await prisma.parent.findFirst({
            where: { id: parentId, schoolId },
            include: {
                students: {
                    include: {
                        student: {
                            include: {
                                enrollments: {
                                    where: { status: 'ACTIVE' },
                                    include: {
                                        stream: {
                                            include: { classLevel: true },
                                        },
                                        academicYear: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!parent) throw new NotFoundError('Parent profile not found');

        const children = parent.students.map(({ student }) => {
            const activeEnrollment = student.enrollments[0] || null;
            return {
                id: student.id,
                admissionNo: student.admissionNo,
                fullName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
                gender: student.gender,
                classLevel: activeEnrollment?.stream?.classLevel?.name || 'Unassigned',
                stream: activeEnrollment?.stream?.name || 'Unassigned',
                curriculum: activeEnrollment?.stream?.classLevel?.curriculum || 'N/A',
                academicYear: activeEnrollment?.academicYear?.name || 'N/A',
            };
        });

        return {
            parentId: parent.id,
            parentName: `${parent.firstName} ${parent.lastName}`,
            relation: parent.relation,
            totalChildren: children.length,
            children,
        };
    }
}
