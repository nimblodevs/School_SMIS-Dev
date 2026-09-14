import { z } from 'zod';

const RelationEnum = z.enum(['MOTHER', 'FATHER', 'GUARDIAN']);

const parentSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    middleName: z.string().optional(),
    lastName: z.string().min(1, 'Last name is required'),
    nationalIdNumber: z.string().min(1, 'National ID Number is required'),
    phone: z.string().min(1, 'Phone number is required'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    relation: RelationEnum.default('GUARDIAN'),
    createPortalAccount: z.boolean().default(false),
});

export const createParentSchema = parentSchema.superRefine((value, context) => {
    if (value.createPortalAccount && !value.email) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['email'],
            message: 'Email is required for a portal account',
        });
    }
});

export const updateParentSchema = parentSchema
    .omit({ createPortalAccount: true })
    .partial()
    .extend({ relation: RelationEnum.optional() })
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required',
    });

export const linkStudentSchema = z.object({
    studentId: z.string().uuid('Invalid Student ID'),
});

export const updateParentDesignationSchema = z.object({
    isPrimaryContact: z.boolean().optional(),
    isFinanciallyResponsible: z.boolean().optional(),
    canPickUp: z.boolean().optional(),
});
