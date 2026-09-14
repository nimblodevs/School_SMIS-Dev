import { z } from 'zod';

export const loginSchema = z
    .object({
        username: z.string().trim().min(3).max(100).optional(),
        email: z.string().trim().toLowerCase().email('Invalid email address format').optional(),
        password: z.string().min(10, 'Password must be at least 10 characters'),
    })
    .refine((value) => Boolean(value.username || value.email), {
        message: 'Username or email is required',
        path: ['username'],
    });

export const loginOtpSchema = z.object({
    userId: z.string().uuid(),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
});

export const resendLoginOtpSchema = z.object({
    userId: z.string().uuid(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
        .string()
        .min(12, 'New password must be at least 12 characters')
        .refine(
            (password) => /[a-z]/.test(password),
            'New password must contain a lowercase letter',
        )
        .refine(
            (password) => /[A-Z]/.test(password),
            'New password must contain an uppercase letter',
        )
        .refine((password) => /\d/.test(password), 'New password must contain a number')
        .refine(
            (password) => /[^A-Za-z0-9]/.test(password),
            'New password must contain a special character',
        ),
});

export const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address format'),
});

export const verifyOtpSchema = forgotPasswordSchema.extend({
    otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
});

export const resetPasswordSchema = verifyOtpSchema.extend({
    newPassword: changePasswordSchema.shape.newPassword,
});

export const googleLoginSchema = z.object({
    idToken: z.string().min(1),
});
