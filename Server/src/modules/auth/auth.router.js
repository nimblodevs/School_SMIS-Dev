import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';

const router = Router();
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Try again later.' },
});

// Public routes
router.post('/login', loginLimiter, AuthController.login);
router.post('/verify-login-otp', loginLimiter, AuthController.verifyLoginOtp);
router.post('/resend-login-otp', loginLimiter, AuthController.resendLoginOtp);
router.post('/google', loginLimiter, AuthController.googleLogin);
router.post('/forgot-password', loginLimiter, AuthController.forgotPassword);
router.post('/verify-otp', loginLimiter, AuthController.verifyOtp);
router.post('/reset-password', loginLimiter, AuthController.resetPassword);
router.post('/refresh', AuthController.refresh);

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
