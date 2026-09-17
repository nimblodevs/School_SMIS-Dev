import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';
import { env } from '../../config/env.js';

const router = Router();

const authIpLimiter = rateLimit({
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.LOGIN_RATE_LIMIT_PER_IP,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts from this IP. Try again later.',
    },
});
const refreshIpLimiter = rateLimit({
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.REFRESH_RATE_LIMIT_PER_IP,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many session refresh attempts. Try again later.',
    },
});
const loginIdentifierLimiter = rateLimit({
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.LOGIN_RATE_LIMIT_PER_IDENTIFIER,
    keyGenerator: (req) => `email:${req.body?.email?.trim().toLowerCase() || ipKeyGenerator(req.ip)}`,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts for this account.' },
});
const otpUserLimiter = rateLimit({
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.OTP_RATE_LIMIT_PER_USER,
    keyGenerator: (req) => `user:${req.body?.userId || ipKeyGenerator(req.ip)}`,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many OTP attempts. Try again later.' },
});
const resendIpLimiter = rateLimit({
    windowMs: env.OTP_RESEND_WINDOW_MINUTES * 60 * 1000,
    limit: env.OTP_RESEND_LIMIT,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many OTP resends. Try again later.' },
});

// Public routes
router.post('/login', authIpLimiter, loginIdentifierLimiter, AuthController.login);
router.post('/verify-login-otp', authIpLimiter, otpUserLimiter, AuthController.verifyLoginOtp);
router.post('/resend-login-otp', authIpLimiter, resendIpLimiter, otpUserLimiter, AuthController.resendLoginOtp);
router.post('/google', authIpLimiter, AuthController.googleLogin);
router.post('/forgot-password', authIpLimiter, loginIdentifierLimiter, AuthController.forgotPassword);
router.post('/verify-otp', authIpLimiter, otpUserLimiter, AuthController.verifyOtp);
router.post('/reset-password', authIpLimiter, otpUserLimiter, AuthController.resetPassword);
router.post('/refresh', refreshIpLimiter, AuthController.refresh);

// Authenticated routes
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.getMe);
router.post('/change-password', authenticate, AuthController.changePassword);
router.post(
    '/impersonate/:userId',
    authenticate,
    authorizeRoles('ADMIN', 'SUPER_ADMIN'),
    AuthController.impersonate,
);
router.get(
    '/users',
    authenticate,
    authorizeRoles('ADMIN', 'SUPER_ADMIN'),
    AuthController.listUsers,
);

export default router;
