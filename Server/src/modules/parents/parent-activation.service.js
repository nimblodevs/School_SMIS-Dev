import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, runTransaction } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { sendParentActivationInvite } from '../../shared/email.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';

export class ParentActivationService {
    /**
     * Generates a time-sensitive activation token and emails/SMS it to the parent.
     */
    static async sendActivationInvite(parentId, actor, { ipAddress, userAgent } = {}) {
        const parent = await prisma.parent.findUnique({
            where: { id: parentId },
            include: { user: true },
        });

        if (!parent) throw new NotFoundError('Parent profile not found');
        if (!parent.email) throw new BadRequestError('Parent email is required before sending an activation invite');

        // Generate secure token valid for 48 hours
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        let userId = parent.userId;

        if (!userId) {
            const email = parent.email || `${parent.phone}@parent.school`;
            const newUser = await prisma.user.create({
                data: {
                    username: `parent-${crypto.randomUUID()}`,
                    email,
                    phone: parent.phone,
                    role: 'PARENT',
                    schoolId: parent.schoolId,
                    passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10), // temporary lock
                    isActive: false,
                },
            });

            userId = newUser.id;
            await prisma.parent.update({
                where: { id: parentId },
                data: { userId },
            });
        }

        // Save token record
        await prisma.activationToken.create({
            data: {
                userId,
                tokenHash: hashedToken,
                expiresAt,
            },
        });

        await sendParentActivationInvite({ to: parent.email, firstName: parent.firstName, token: rawToken });

        await recordAudit({
            action: 'INVITE',
            actorId: actor.id,
            schoolId: parent.schoolId,
            entityType: 'Parent',
            entityId: parent.id,
            metadata: { email: parent.email, phone: parent.phone },
            ipAddress,
            userAgent,
        });

        return { message: 'Activation token generated and sent successfully' };
    }

    /**
     * Completes self-service parent account setup.
     */
    static async activateAccount({ token, password }) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const activationRecord = await prisma.activationToken.findFirst({
            where: {
                tokenHash,
                isUsed: false,
                expiresAt: { gt: new Date() },
            },
            include: { user: true },
        });

        if (!activationRecord) {
            throw new BadRequestError('Invalid or expired activation token');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await runTransaction([
            prisma.user.update({
                where: { id: activationRecord.userId },
                data: {
                    passwordHash: hashedPassword,
                    isActive: true,
                },
            }),
            prisma.activationToken.update({
                where: { id: activationRecord.id },
                data: { isUsed: true },
            }),
        ]);

        return { message: 'Account activated successfully. You can now log in.' };
    }
}