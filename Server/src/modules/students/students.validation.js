import { z } from 'zod';

const GenderEnum = z.enum(['MALE', 'FEMALE', 'OTHER']);
const RelationEnum = z.enum(['MOTHER', 'FATHER', 'GUARDIAN']);

export const createStudentSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    middleName: z.string().optional(),
    lastName: z.string().min(1, 'Last name is required'),
    gender: GenderEnum,
    dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format (YYYY-MM-DD expected)',
    }),
    nationalIdNumber: z.string().min(1, 'National ID Number is required'),
    birthCertificateNumber: z.string().min(1, 'Birth Certificate Number is required'),
    passportNumber: z.string().optional(),

    // Initial Academic Placement
    academicYearId: z.string().uuid('Invalid Academic Year ID'),
    streamId: z.string().uuid('Invalid Stream ID'),

    // Parent links during admission
    parents: z
        .array(
            z.object({
                parentId: z.string().uuid('Invalid Parent ID'),
            })
        )
        .optional(),
});

export const updateStudentSchema = createStudentSchema.partial().extend({
    isActive: z.boolean().optional(),
});

export const linkParentSchema = z.object({
    parentId: z.string().uuid('Invalid Parent ID'),
});