import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const mocks = vi.hoisted(() => {
    const prisma = {
        passwordResetOtp: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            create: vi.fn(),
            count: vi.fn(),
        },
        refreshSession: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
            create: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        school: { findUnique: vi.fn() },
    };

    return {
        prisma,
        runTransaction: vi.fn(),
        recordAudit: vi.fn(),
        sendLoginOtp: vi.fn(),
    };
});

vi.mock('../src/config/prisma.js', () => ({
    prisma: mocks.prisma,
    runTransaction: mocks.runTransaction,
}));
vi.mock('../src/shared/audit.js', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('../src/shared/email.js', () => ({
    sendLoginOtp: mocks.sendLoginOtp,
    sendPasswordResetOtp: vi.fn(),
}));

import { AuthService } from '../src/modules/auth/auth.service.js';

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
    for (const model of Object.values(mocks.prisma)) {
        for (const method of Object.values(model)) method.mockReset();
    }
    mocks.runTransaction.mockReset().mockImplementation(async (operation) => {
        if (typeof operation === 'function') return operation(mocks.prisma);
        return Promise.all(operation);
    });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
    mocks.sendLoginOtp.mockReset().mockResolvedValue(undefined);
});

describe('auth service security invariants', () => {
    it('does not resend a login code without a live challenge', async () => {
        mocks.prisma.passwordResetOtp.findFirst.mockResolvedValue(null);

        await expect(AuthService.resendLoginOtp('c'.repeat(43))).rejects.toThrow(
            'Unable to resend login verification code',
        );
        expect(mocks.sendLoginOtp).not.toHaveBeenCalled();
    });

    it('rotates the login challenge on resend without returning account details', async () => {
        const previousChallengeToken = 'c'.repeat(43);
        mocks.prisma.passwordResetOtp.findFirst.mockResolvedValue({
            id: 'challenge-id',
            userId: 'user-id',
            attempts: 0,
            user: {
                id: 'user-id',
                email: 'user@example.com',
                username: 'private-name',
                isActive: true,
                schoolId: null,
                school: null,
            },
        });
        mocks.prisma.passwordResetOtp.count.mockResolvedValue(0);
        mocks.prisma.passwordResetOtp.updateMany.mockResolvedValue({ count: 1 });
        mocks.prisma.passwordResetOtp.create.mockImplementation(async ({ data }) => ({
            id: 'next-challenge-id',
            expiresAt: data.expiresAt,
        }));

        const result = await AuthService.resendLoginOtp(previousChallengeToken);

        expect(result.challengeToken).not.toBe(previousChallengeToken);
        expect(result).not.toHaveProperty('email');
        expect(result).not.toHaveProperty('username');
        expect(mocks.prisma.passwordResetOtp.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                challengeTokenHash: AuthService.hashToken(result.challengeToken),
                isResend: true,
            }),
        });
    });

    it('does not issue a session when an OTP was claimed concurrently', async () => {
        const otp = '123456';
        mocks.prisma.passwordResetOtp.findFirst.mockResolvedValue({
            id: 'challenge-id',
            userId: 'user-id',
            attempts: 0,
            codeHash: AuthService.hashToken(otp),
        });
        mocks.prisma.passwordResetOtp.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            AuthService.verifyLoginOtp({ challengeToken: 'c'.repeat(43), otp }),
        ).rejects.toThrow('Invalid or expired login verification code');
        expect(mocks.prisma.user.update).not.toHaveBeenCalled();
        expect(mocks.prisma.refreshSession.create).not.toHaveBeenCalled();
    });

    it('does not update a password when a reset-code claim loses a race', async () => {
        vi.spyOn(bcrypt, 'hash').mockResolvedValue('replacement-hash');
        const otp = '654321';
        mocks.prisma.user.findUnique.mockResolvedValue({
            id: 'user-id',
            schoolId: 'school-id',
        });
        mocks.prisma.passwordResetOtp.findFirst.mockResolvedValue({
            id: 'reset-id',
            attempts: 0,
            codeHash: AuthService.hashToken(otp),
        });
        mocks.prisma.passwordResetOtp.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            AuthService.resetPassword({
                email: 'user@example.com',
                otp,
                newPassword: 'StrongReplacement1!',
            }),
        ).rejects.toThrow('Invalid or expired reset code');
        expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    });

    it('revokes sessions when a concurrent refresh loses the atomic claim', async () => {
        mocks.prisma.refreshSession.findUnique.mockResolvedValue({
            id: 'refresh-id',
            userId: 'user-id',
            familyId: 'family-id',
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
            isImpersonated: false,
            user: { id: 'user-id', schoolId: null, isActive: true },
        });
        mocks.prisma.user.findUnique.mockResolvedValue({
            id: 'user-id',
            email: 'user@example.com',
            role: 'TEACHER',
            schoolId: null,
            isActive: true,
            currentSessionId: 'session-id',
        });
        mocks.prisma.refreshSession.updateMany
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValue({ count: 1 });

        await expect(AuthService.refresh('refresh-token')).rejects.toThrow(
            'Refresh token reuse detected',
        );
        expect(mocks.prisma.refreshSession.create).not.toHaveBeenCalled();
        expect(mocks.prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-id' },
            data: { currentSessionId: null },
        });
        expect(mocks.recordAudit).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'AUTH_REFRESH_TOKEN_REUSE' }),
        );
    });

    it('preserves impersonation claims when rotating a refresh token', async () => {
        const signAccessToken = vi.spyOn(AuthService, 'signAccessToken').mockReturnValue('signed-token');
        mocks.prisma.refreshSession.findUnique.mockResolvedValue({
            id: 'refresh-id',
            userId: 'actor-id',
            familyId: 'family-id',
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
            isImpersonated: true,
            impersonatedUserId: 'target-id',
            actorSessionId: 'actor-session-id',
            user: { id: 'actor-id', schoolId: null, isActive: true },
        });
        mocks.prisma.user.findUnique
            .mockResolvedValueOnce({
                id: 'actor-id',
                email: 'admin@example.com',
                role: 'SUPER_ADMIN',
                schoolId: null,
                isActive: true,
                currentSessionId: 'actor-session-id',
            })
            .mockResolvedValueOnce({
                id: 'target-id',
                email: 'student@example.com',
                role: 'STUDENT',
                schoolId: null,
                isActive: true,
            });
        mocks.prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });

        const result = await AuthService.refresh('refresh-token');

        expect(result.accessToken).toBe('signed-token');
        expect(signAccessToken).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'target-id' }),
            expect.any(String),
            {
                isImpersonated: true,
                targetUserId: 'target-id',
                actorId: 'actor-id',
                actorSessionId: 'actor-session-id',
            },
        );
        expect(mocks.prisma.refreshSession.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'actor-id',
                isImpersonated: true,
                impersonatedUserId: 'target-id',
                actorSessionId: 'actor-session-id',
            }),
        });
        expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    });
});