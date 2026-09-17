import { z } from 'zod'

const strongPassword = z
    .string()
    .min(12, 'Use at least 12 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/\d/, 'Add a number')
    .regex(/[^A-Za-z0-9]/, 'Add a special character')

export const loginSchema = z.object({
    email: z.string().trim().email('Enter a valid email address'),
    password: z.string().min(10, 'Use at least 10 characters'),
})

export const otpSchema = z.object({
    otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

export const emailSchema = z.object({
    email: z.string().trim().email('Enter a valid email address'),
})

export const resetPasswordSchema = emailSchema.extend({
    otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    newPassword: strongPassword,
    confirmPassword: z.string(),
}).refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
})

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: strongPassword,
    confirmPassword: z.string(),
}).refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
})

export const newPasswordSchema = z.object({
    newPassword: strongPassword,
    confirmPassword: z.string(),
}).refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
})