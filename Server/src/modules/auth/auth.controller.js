import { AuthService } from './auth.service.js';
import {
    forgotPasswordSchema,
    googleLoginSchema,
    loginOtpSchema,
    loginSchema,
    resendLoginOtpSchema,
    resetPasswordSchema,
    changePasswordSchema,
    verifyOtpSchema,
} from './auth.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { env } from '../../config/env.js';

// Cookie Configuration helper
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

const REFRESH_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
};

function setAuthCookies(res, tokens) {
    res.cookie('token', tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
}

export class AuthController {
    static async login(req, res, next) {
        try {
            const validation = loginSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            const userAgent = req.headers['user-agent'];
            const ipAddress = req.ip || req.headers['x-forwarded-for'];

            const result = await AuthService.login({
                ...validation.data,
                userAgent,
                ipAddress,
            });

            return res.status(200).json({
                success: true,
                message: 'Credentials validated. Enter the OTP sent to your email.',
                data: {
                    userId: result.userId,
                    nextStep: '/api/v1/auth/verify-login-otp',
                    email: result.email,
                    username: result.username,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    static async verifyLoginOtp(req, res, next) {
        try {
            const validation = loginOtpSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation error', validation.error.format());
            const result = await AuthService.verifyLoginOtp(validation.data, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            setAuthCookies(res, result);
            return res.json({
                success: true,
                message: 'Login successful',
                data: { user: result.user },
            });
        } catch (error) {
            next(error);
        }
    }

    static async resendLoginOtp(req, res, next) {
        try {
            const validation = resendLoginOtpSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation error', validation.error.format());
            const result = await AuthService.resendLoginOtp(validation.data.userId, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.json({
                success: true,
                message: 'A new login verification code has been sent.',
                data: { ...result, nextStep: '/api/v1/auth/verify-login-otp' },
            });
        } catch (error) {
            next(error);
        }
    }

    static async logout(req, res, next) {
        try {
            if (req.user?.id) {
                await AuthService.logout(req.user.id, {
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    refreshToken: req.cookies?.refreshToken,
                    isImpersonated: req.user.isImpersonated,
                    actorId: req.user.actorId,
                });
            }

            // Clear HTTP-Only session cookie
            res.clearCookie('token', COOKIE_OPTIONS);
            res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);

            return res.status(200).json({
                success: true,
                message: 'Logged out successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    static async refresh(req, res, next) {
        try {
            const refreshToken = req.cookies?.refreshToken;
            if (!refreshToken) throw new BadRequestError('Refresh token is required');
            const result = await AuthService.refresh(refreshToken, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            setAuthCookies(res, result);
            return res.json({ success: true, message: 'Session refreshed' });
        } catch (error) {
            next(error);
        }
    }

    static async googleLogin(req, res, next) {
        try {
            const validation = googleLoginSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation error', validation.error.format());
            const result = await AuthService.googleLogin(validation.data.idToken, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            setAuthCookies(res, result);
            return res.json({ success: true, data: { user: result.user } });
        } catch (error) {
            next(error);
        }
    }

    static async forgotPassword(req, res, next) {
        try {
            const validation = forgotPasswordSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation error', validation.error.format());
            await AuthService.forgotPassword(validation.data.email, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.json({
                success: true,
                message: 'If the account exists, a reset code has been sent.',
            });
        } catch (error) {
            next(error);
        }
    }

    static async verifyOtp(req, res, next) {
        try {
            const validation = verifyOtpSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation error', validation.error.format());
            await AuthService.verifyOtp(validation.data);
            return res.json({ success: true, message: 'OTP is valid' });
        } catch (error) {
            next(error);
        }
    }

    static async resetPassword(req, res, next) {
        try {
            const validation = resetPasswordSchema.safeParse(req.body);
            if (!validation.success)
                throw new BadRequestError('Validation error', validation.error.format());
            await AuthService.resetPassword(validation.data, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            res.clearCookie('token', COOKIE_OPTIONS);
            res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
            return res.json({ success: true, message: 'Password reset successfully' });
        } catch (error) {
            next(error);
        }
    }

    static async impersonate(req, res, next) {
        try {
            const result = await AuthService.startImpersonation(req.user, req.params.userId, {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            setAuthCookies(res, result);
            return res.json({ success: true, data: { user: result.user, isImpersonated: true } });
        } catch (error) {
            next(error);
        }
    }

    static async listUsers(req, res, next) {
        try {
            const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10));
            const pageSize = Math.min(
                100,
                Math.max(1, Number.parseInt(req.query.pageSize ?? '50', 10)),
            );
            const result = await AuthService.listUsers({
                schoolId: req.user.role === 'SUPER_ADMIN' ? req.query.schoolId : req.user.schoolId,
                role: req.query.role,
                search: req.query.search,
                page,
                pageSize,
            });
            return res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getMe(req, res, next) {
        try {
            const user = await AuthService.getMe(req.user.id);
            return res.status(200).json({
                success: true,
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }

    static async changePassword(req, res, next) {
        try {
            const validation = changePasswordSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation error', validation.error.format());
            }

            await AuthService.changePassword(req.user.id, {
                ...validation.data,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            res.clearCookie('token', COOKIE_OPTIONS);

            return res.status(200).json({
                success: true,
                message: 'Password changed successfully. Please log in again.',
            });
        } catch (error) {
            next(error);
        }
    }
}
