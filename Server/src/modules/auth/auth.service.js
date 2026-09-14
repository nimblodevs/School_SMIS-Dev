import bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma, runTransaction } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { recordAudit } from '../../shared/audit.js';
import { sendLoginOtp, sendPasswordResetOtp } from '../../shared/email.js';
import { UnauthorizedError, NotFoundError } from '../../shared/errors/AppError.js';

export class AuthService {
    static hashToken(token) {
        return createHash('sha256').update(token).digest('hex');
    }

    static signAccessToken(user, sessionId, extraClaims = {}) {
        return jwt.sign(
            {
                sub: user.id,
                email: user.email,
                role: user.role,
                schoolId: user.schoolId,
                sessionId,
                ...extraClaims,
            },
            env.JWT_PRIVATE_KEY,
            {
                algorithm: 'RS256',
                expiresIn: env.JWT_EXPIRES_IN,
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
            },
        );
    }

    static async createRefreshSession(userId, { ipAddress, userAgent } = {}) {
        const refreshToken = randomUUID() + randomUUID();
        await prisma.refreshSession.create({
            data: {
                userId,
                tokenHash: this.hashToken(refreshToken),
                expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 86400000),
                ipAddress,
                userAgent,
            },
        });
        return refreshToken;
    }

    static async issueTokens(
        user,
        {
            ipAddress,
            userAgent,
            isImpersonated = false,
            targetUserId = null,
            actorId = null,
            actorSessionId = null,
            refreshUserId = user.id,
        } = {},
    ) {
        const sessionId = randomUUID();
        if (!isImpersonated) {
            await prisma.refreshSession.updateMany({
                where: { userId: refreshUserId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        }
        const refreshToken = await this.createRefreshSession(refreshUserId, {
            ipAddress,
            userAgent,
        });
        if (!isImpersonated) {
            await prisma.user.update({
                where: { id: user.id },
                data: { currentSessionId: sessionId },
            });
        }
        return {
            accessToken: this.signAccessToken(user, sessionId, {
                isImpersonated,
                ...(targetUserId ? { targetUserId } : {}),
                ...(actorId ? { actorId } : {}),
                ...(actorSessionId ? { actorSessionId } : {}),
            }),
            refreshToken,
        };
    }

    /**
     * Authenticate user and enforce Single Device Session
     */
    static async login({ username, email, password, userAgent, ipAddress }) {
        const user = await prisma.user.findFirst({
            where: { username, email },
            include: {
                school: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        isActive: true,
                    },
                },
                staffModuleAccess: {
                    select: { module: true },
                },
                teacher: {
                    select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        nationalIdNumber: true,
                        passportNumber: true,
                        employeeKey: true,
                    },
                },
                staff: {
                    select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        nationalIdNumber: true,
                        passportNumber: true,
                        employeeKey: true,
                        department: true,
                    },
                },
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        nationalIdNumber: true,
                        passportNumber: true,
                        birthCertificateNumber: true,
                        admissionNo: true,
                    },
                },
                parent: {
                    select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        nationalIdNumber: true,
                        passportNumber: true,
                        phone: true,
                    },
                },
            },
        });

        if (!user) {
            await recordAudit({
                action: 'AUTH_LOGIN_FAILED',
                entityType: 'User',
                ipAddress,
                userAgent,
                metadata: { reason: 'invalid_credentials' },
            });
            throw new UnauthorizedError('Invalid email or password');
        }

        if (!user.isActive) {
            await recordAudit({
                action: 'AUTH_LOGIN_FAILED',
                actorId: user.id,
                schoolId: user.schoolId,
                entityType: 'User',
                entityId: user.id,
                ipAddress,
                userAgent,
                metadata: { reason: 'inactive_account' },
            });
            throw new UnauthorizedError(
                'Your account has been deactivated. Contact your administrator.',
            );
        }

        if (user.schoolId && !user.school?.isActive) {
            await recordAudit({
                action: 'AUTH_LOGIN_FAILED',
                actorId: user.id,
                schoolId: user.schoolId,
                entityType: 'User',
                entityId: user.id,
                ipAddress,
                userAgent,
                metadata: { reason: 'inactive_school' },
            });
            throw new UnauthorizedError(
                'The school account associated with your user profile is inactive.',
            );
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            await recordAudit({
                action: 'AUTH_LOGIN_FAILED',
                actorId: user.id,
                schoolId: user.schoolId,
                entityType: 'User',
                entityId: user.id,
                ipAddress,
                userAgent,
                metadata: { reason: 'account_locked' },
            });
            throw new UnauthorizedError('Invalid email or password');
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            const failedLoginAttempts = user.failedLoginAttempts + 1;
            const shouldLock = failedLoginAttempts >= env.LOGIN_MAX_ATTEMPTS;
            const lockedUntil = shouldLock
                ? new Date(Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60 * 1000)
                : null;

            await prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts, lockedUntil },
            });
            await recordAudit({
                action: shouldLock ? 'ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
                actorId: user.id,
                schoolId: user.schoolId,
                entityType: 'User',
                entityId: user.id,
                ipAddress,
                userAgent,
                metadata: { reason: 'invalid_credentials', failedLoginAttempts },
            });
            throw new UnauthorizedError('Invalid email or password');
        }

        const otp = String(randomInt(100000, 1000000));
        await prisma.passwordResetOtp.create({
            data: {
                userId: user.id,
                codeHash: this.hashToken(otp),
                purpose: 'LOGIN',
                expiresAt: new Date(Date.now() + env.LOGIN_OTP_MINUTES * 60000),
            },
        });
        await sendLoginOtp({ to: user.email, otp });

        await recordAudit({
            action: 'AUTH_LOGIN_SUCCESS',
            actorId: user.id,
            schoolId: user.schoolId,
            entityType: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
            metadata: { stage: 'credentials_validated', otpRequired: true },
        });

        return {
            requiresOtp: true,
            userId: user.id,
            email: user.email,
            username: user.username,
        };
    }

    static async verifyLoginOtp({ userId, otp }, { ipAddress, userAgent } = {}) {
        const challenge = await prisma.passwordResetOtp.findFirst({
            where: {
                userId,
                purpose: 'LOGIN',
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: { user: true },
        });

        if (!challenge || challenge.attempts >= 5 || challenge.codeHash !== this.hashToken(otp)) {
            if (challenge)
                await prisma.passwordResetOtp.update({
                    where: { id: challenge.id },
                    data: { attempts: { increment: 1 } },
                });
            throw new UnauthorizedError('Invalid or expired login verification code');
        }

        const user = challenge.user;
        if (!user.isActive)
            throw new UnauthorizedError(
                'Your account has been deactivated. Contact your administrator.',
            );
        if (user.schoolId) {
            const school = await prisma.school.findUnique({
                where: { id: user.schoolId },
                select: { isActive: true },
            });
            if (!school?.isActive)
                throw new UnauthorizedError(
                    'The school account associated with your user profile is inactive.',
                );
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: new Date(),
                lastLoginIp: ipAddress || null,
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });

        const tokens = await this.issueTokens(user, { ipAddress, userAgent });
        await prisma.passwordResetOtp.update({
            where: { id: challenge.id },
            data: { consumedAt: new Date() },
        });

        await recordAudit({
            action: 'AUTH_LOGIN_SUCCESS',
            actorId: user.id,
            schoolId: user.schoolId,
            entityType: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
        });

        return {
            ...tokens,
            requiresPasswordReset: user.mustChangePassword,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                schoolId: user.schoolId,
            },
        };
    }

    static async resendLoginOtp(userId, { ipAddress, userAgent } = {}) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, username: true, isActive: true, schoolId: true },
        });

        if (!user || !user.isActive)
            throw new UnauthorizedError('Unable to resend login verification code');

        const otp = String(randomInt(100000, 1000000));
        await prisma.passwordResetOtp.updateMany({
            where: { userId, purpose: 'LOGIN', consumedAt: null },
            data: { consumedAt: new Date() },
        });

        const loginChallenge = await prisma.passwordResetOtp.create({
            data: {
                userId,
                codeHash: this.hashToken(otp),
                purpose: 'LOGIN',
                expiresAt: new Date(Date.now() + env.LOGIN_OTP_MINUTES * 60000),
            },
        });

        try {
            await sendLoginOtp({ to: user.email, otp });
        } catch (error) {
            await prisma.passwordResetOtp.update({
                where: { id: loginChallenge.id },
                data: { consumedAt: new Date() },
            });
            throw error;
        }

        await recordAudit({
            action: 'AUTH_LOGIN_SUCCESS',
            actorId: user.id,
            schoolId: user.schoolId,
            entityType: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
            metadata: { stage: 'otp_resent' },
        });

        return { userId: user.id, email: user.email, username: user.username };
    }

    /**
     * Terminate active session (Log out single device)
     */
    static async logout(
        userId,
        { ipAddress, userAgent, refreshToken, isImpersonated = false, actorId = null } = {},
    ) {
        const sessionUserId = isImpersonated && actorId ? actorId : userId;
        const user = await prisma.user.update({
            where: { id: sessionUserId },
            data: { currentSessionId: null },
            select: { id: true, schoolId: true },
        });

        if (refreshToken) {
            await prisma.refreshSession.updateMany({
                where: {
                    userId: sessionUserId,
                    tokenHash: this.hashToken(refreshToken),
                    revokedAt: null,
                },
                data: { revokedAt: new Date() },
            });
        }

        await recordAudit({
            action: 'AUTH_LOGOUT',
            actorId: isImpersonated && actorId ? actorId : user.id,
            schoolId: user.schoolId,
            entityType: 'User',
            entityId: userId,
            ipAddress,
            userAgent,
            metadata: isImpersonated ? { impersonatedUserId: userId } : null,
        });

        return { message: 'Logged out successfully' };
    }

    static async changePassword(userId, { currentPassword, newPassword, ipAddress, userAgent }) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true },
        });

        if (!user) {
            throw new NotFoundError('User profile not found');
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            await recordAudit({
                action: 'PASSWORD_CHANGE_FAILED',
                actorId: userId,
                entityType: 'User',
                entityId: userId,
                ipAddress,
                userAgent,
                metadata: { reason: 'invalid_current_password' },
            });
            throw new UnauthorizedError('Current password is incorrect');
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                currentSessionId: null,
            },
        });
        await prisma.refreshSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        await recordAudit({
            action: 'PASSWORD_CHANGED',
            actorId: userId,
            entityType: 'User',
            entityId: userId,
            ipAddress,
            userAgent,
        });
    }

    static async refresh(refreshToken, { ipAddress, userAgent } = {}) {
        const tokenHash = this.hashToken(refreshToken);
        const session = await prisma.refreshSession.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (
            !session ||
            session.revokedAt ||
            session.expiresAt <= new Date() ||
            !session.user.isActive
        ) {
            throw new UnauthorizedError('Refresh token is invalid or expired');
        }

        const nextRefreshToken = await this.createRefreshSession(session.userId, {
            ipAddress,
            userAgent,
        });
        await prisma.refreshSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date(), replacedById: this.hashToken(nextRefreshToken) },
        });
        const sessionId = randomUUID();
        await prisma.user.update({
            where: { id: session.userId },
            data: { currentSessionId: sessionId },
        });
        return {
            accessToken: this.signAccessToken(session.user, sessionId),
            refreshToken: nextRefreshToken,
        };
    }

    static async forgotPassword(email, { ipAddress, userAgent } = {}) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return;

        const otp = String(randomInt(100000, 1000000));
        await prisma.passwordResetOtp.deleteMany({
            where: { userId: user.id, purpose: 'PASSWORD_RESET', consumedAt: null },
        });
        await prisma.passwordResetOtp.create({
            data: {
                userId: user.id,
                codeHash: this.hashToken(otp),
                purpose: 'PASSWORD_RESET',
                expiresAt: new Date(Date.now() + env.PASSWORD_RESET_OTP_MINUTES * 60000),
            },
        });
        await sendPasswordResetOtp({ to: user.email, otp });
        await recordAudit({
            action: 'AUTH_LOGIN_FAILED',
            actorId: user.id,
            schoolId: user.schoolId,
            entityType: 'PasswordReset',
            ipAddress,
            userAgent,
            metadata: { reason: 'otp_requested' },
        });
    }

    static async resetPassword({ email, otp, newPassword }, { ipAddress, userAgent } = {}) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedError('Invalid or expired reset code');
        const reset = await prisma.passwordResetOtp.findFirst({
            where: {
                userId: user.id,
                purpose: 'PASSWORD_RESET',
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!reset || reset.attempts >= 5 || reset.codeHash !== this.hashToken(otp)) {
            if (reset)
                await prisma.passwordResetOtp.update({
                    where: { id: reset.id },
                    data: { attempts: { increment: 1 } },
                });
            throw new UnauthorizedError('Invalid or expired reset code');
        }
        await runTransaction([
            prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash: await bcrypt.hash(newPassword, 12),
                    currentSessionId: null,
                    mustChangePassword: false,
                },
            }),
            prisma.passwordResetOtp.update({
                where: { id: reset.id },
                data: { consumedAt: new Date() },
            }),
            prisma.refreshSession.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);
        await recordAudit({
            action: 'PASSWORD_CHANGED',
            actorId: user.id,
            schoolId: user.schoolId,
            entityType: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
            metadata: { method: 'otp' },
        });
    }

    static async verifyOtp({ email, otp }) {
        const user = await prisma.user.findUnique({ where: { email } });
        const reset =
            user &&
            (await prisma.passwordResetOtp.findFirst({
                where: {
                    userId: user.id,
                    purpose: 'PASSWORD_RESET',
                    consumedAt: null,
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: 'desc' },
            }));
        if (!reset || reset.attempts >= 5 || reset.codeHash !== this.hashToken(otp)) {
            if (reset)
                await prisma.passwordResetOtp.update({
                    where: { id: reset.id },
                    data: { attempts: { increment: 1 } },
                });
            throw new UnauthorizedError('Invalid or expired reset code');
        }
    }

    static async listUsers({ schoolId, role, search, page = 1, pageSize = 50 }) {
        const where = {
            ...(schoolId ? { schoolId } : {}),
            ...(role ? { role } : {}),
            ...(search
                ? {
                    OR: [
                        { email: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const [users, total] = await runTransaction([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    role: true,
                    schoolId: true,
                    isActive: true,
                    mustChangePassword: true,
                    authProvider: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.user.count({ where }),
        ]);
        return { users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    static async googleLogin(idToken, { ipAddress, userAgent } = {}) {
        if (!env.GOOGLE_CLIENT_ID) throw new UnauthorizedError('Google login is not configured');
        const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload?.email || !payload.email_verified || !payload.sub)
            throw new UnauthorizedError('Google account is not verified');

        let user = await prisma.user.findFirst({
            where: { OR: [{ googleSubject: payload.sub }, { email: payload.email.toLowerCase() }] },
        });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    username: `${payload.email.split('@')[0].replace(/[^A-Za-z0-9._-]/g, '')}-${randomUUID().slice(0, 8)}`,
                    email: payload.email.toLowerCase(),
                    phone: `google-${randomUUID()}`,
                    passwordHash: await bcrypt.hash(randomUUID(), 12),
                    role: 'PARENT',
                    authProvider: 'GOOGLE',
                    googleSubject: payload.sub,
                },
            });
        } else if (!user.googleSubject) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { googleSubject: payload.sub, authProvider: 'GOOGLE' },
            });
        }
        if (!user.isActive) throw new UnauthorizedError('User account is deactivated');
        const tokens = await this.issueTokens(user, { ipAddress, userAgent });
        await recordAudit({
            action: 'AUTH_LOGIN_SUCCESS',
            actorId: user.id,
            schoolId: user.schoolId,
            entityType: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
            metadata: { provider: 'GOOGLE' },
        });
        return {
            ...tokens,
            requiresPasswordReset: false,
            user: { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId },
        };
    }

    static async startImpersonation(actor, targetUserId, { ipAddress, userAgent } = {}) {
        const target = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, email: true, role: true, schoolId: true, isActive: true },
        });
        if (!target || !target.isActive || !['TEACHER', 'PARENT', 'STUDENT'].includes(target.role))
            throw new UnauthorizedError('Target user is not eligible for support access');
        if (actor.role !== 'SUPER_ADMIN' && target.schoolId !== actor.schoolId) {
            throw new UnauthorizedError('Support access is limited to users in your school');
        }
        const tokens = await this.issueTokens(target, {
            ipAddress,
            userAgent,
            isImpersonated: true,
            targetUserId: target.id,
            actorId: actor.id,
            actorSessionId: actor.sessionId,
            refreshUserId: actor.id,
        });
        await recordAudit({
            action: 'IMPERSONATION_STARTED',
            actorId: actor.id,
            schoolId: actor.schoolId,
            entityType: 'User',
            entityId: target.id,
            ipAddress,
            userAgent,
            metadata: { targetRole: target.role },
        });
        return { ...tokens, user: target };
    }

    /**
     * Fetch authenticated user profile
     */
    static async getMe(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                schoolId: true,
                isActive: true,
                createdAt: true,
                school: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                staffModuleAccess: {
                    select: { module: true },
                },
                teacher: {
                    select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        nationalIdNumber: true,
                        passportNumber: true,
                        employeeKey: true,
                    },
                },
                staff: {
                    select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        nationalIdNumber: true,
                        passportNumber: true,
                        employeeKey: true,
                        department: true,
                        jobTitle: true,
                    },
                },
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        nationalIdNumber: true,
                        passportNumber: true,
                        birthCertificateNumber: true,
                        admissionNo: true,
                    },
                },
                parent: {
                    include: {
                        students: {
                            include: { student: true },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundError('User profile not found');
        }

        const modulePermissions = user.staffModuleAccess.map((a) => a.module);
        delete user.staffModuleAccess;

        return { ...user, modulePermissions };
    }
}
