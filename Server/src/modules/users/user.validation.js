import { z } from 'zod';

const baseProvisionSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(100)
        .regex(/^[A-Za-z0-9._-]+$/),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().min(7).max(30),
    schoolId: z.string().uuid().optional(),
    firstName: z.string().trim().min(1).max(100),
    middleName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().min(1).max(100),
    nationalIdNumber: z.string().trim().min(5).max(30),
    passportNumber: z.string().trim().min(5).max(30).optional(),
    hireDate: z.coerce.date(),
    nssfNumber: z.string().trim().min(1).max(50),
    kraPin: z.string().trim().min(1).max(50),
    shaNumber: z.string().trim().min(1).max(50),
    jobGroupId: z.string().uuid().optional(),
});

export const createTeacherSchema = baseProvisionSchema;

export const createStaffSchema = baseProvisionSchema.extend({
    department: z.string().trim().min(1).max(100),
    jobTitle: z.string().trim().min(1).max(100),
});
