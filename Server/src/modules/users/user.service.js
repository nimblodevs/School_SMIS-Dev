import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { prisma, runTransaction } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { recordAudit } from '../../shared/audit.js';
import { sendTemporaryCredentials } from '../../shared/email.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';

function generateTemporaryPassword(schoolCode) {
    return `SMIS-${schoolCode}-${randomBytes(12).toString('base64url')}`;
}

export class UserService {
    static async provisionEmployee(role, input, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.role === 'SUPER_ADMIN' ? input.schoolId : actor.schoolId;
        if (!schoolId) throw new BadRequestError('schoolId is required for employee provisioning');

        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { id: true, schoolCode: true, isActive: true },
        });
        if (!school) throw new NotFoundError('School not found');
        if (!school.isActive) throw new BadRequestError('The school account is inactive');
        if (!/^\d{5}$/.test(school.schoolCode))
            throw new BadRequestError('The school must have a valid five-digit school code');

        const temporaryPassword = generateTemporaryPassword(school.schoolCode);
        const userId = randomUUID();
        const profileId = randomUUID();
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        let generatedOwnerKey;
        let generatedEmployeeNo;

        const user = await runTransaction(async (transaction) => {
            const existingUser = await transaction.user.findFirst({
                where: { OR: [{ email: input.email }, { username: input.username }] },
                select: { id: true },
            });
            if (existingUser) throw new BadRequestError('A user with this email already exists');

            const sequenceField = role === 'TEACHER' ? 'nextTeacherSequence' : 'nextStaffSequence';
            const sequence = await transaction.school.update({
                where: { id: schoolId },
                data: { [sequenceField]: { increment: 1 } },
                select: { [sequenceField]: true },
            });
            const sequenceNumber = sequence[sequenceField];
            if (sequenceNumber > 9999)
                throw new BadRequestError(
                    `The ${role.toLowerCase()} employee sequence has reached its four-digit limit`,
                );
            const ownerKey = `${role === 'TEACHER' ? 'T' : 'S'}:${profileId}`;
            const employeeNo = `${role === 'TEACHER' ? 'T' : 'S'}${school.schoolCode}${String(sequenceNumber).padStart(4, '0')}`;
            generatedOwnerKey = ownerKey;
            generatedEmployeeNo = employeeNo;

            await transaction.employeeNumber.create({
                data: {
                    schoolId,
                    employeeNo,
                    ownerKey,
                },
            });

            const createdUser = await transaction.user.create({
                data: {
                    id: userId,
                    username: input.username,
                    email: input.email,
                    phone: input.phone,
                    passwordHash,
                    mustChangePassword: true,
                    role,
                    schoolId,
                },
            });

            if (role === 'TEACHER') {
                await transaction.teacher.create({
                    data: {
                        id: profileId,
                        schoolId,
                        userId: createdUser.id,
                        employeeKey: ownerKey,
                        middleName: input.middleName,
                        nationalIdNumber: input.nationalIdNumber,
                        passportNumber: input.passportNumber,
                        nssfNumber: input.nssfNumber,
                        kraPin: input.kraPin,
                        shaNumber: input.shaNumber,
                        jobGroupId: input.jobGroupId,
                        firstName: input.firstName,
                        lastName: input.lastName,
                        hireDate: input.hireDate,
                    },
                });
            } else {
                await transaction.staff.create({
                    data: {
                        id: profileId,
                        schoolId,
                        userId: createdUser.id,
                        employeeKey: ownerKey,
                        middleName: input.middleName,
                        nationalIdNumber: input.nationalIdNumber,
                        passportNumber: input.passportNumber,
                        nssfNumber: input.nssfNumber,
                        kraPin: input.kraPin,
                        shaNumber: input.shaNumber,
                        jobGroupId: input.jobGroupId,
                        firstName: input.firstName,
                        lastName: input.lastName,
                        department: input.department,
                        jobTitle: input.jobTitle,
                        hireDate: input.hireDate,
                    },
                });
            }

            return createdUser;
        });

        try {
            await sendTemporaryCredentials({
                to: user.email,
                firstName: input.firstName,
                role,
                temporaryPassword,
            });
        } catch (error) {
            await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
            throw new BadRequestError(
                'Employee was created but credentials could not be delivered; the account has been deactivated.',
            );
        }

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: role === 'TEACHER' ? 'Teacher' : 'Staff',
            entityId: profileId,
            ipAddress,
            userAgent,
            metadata: { userId: user.id, email: user.email, credentialsDelivered: true },
        });

        return {
            id: profileId,
            userId: user.id,
            email: user.email,
            role,
            schoolId,
            employeeKey: generatedOwnerKey,
            employeeNo: generatedEmployeeNo,
            mustChangePassword: true,
            ...(env.NODE_ENV !== 'production' ? { temporaryPassword } : {}),
        };
    }
}
