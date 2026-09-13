import { z } from 'zod';

const GenderEnum = z.enum(['MALE', 'FEMALE', 'OTHER']);

export const bulkStudentRowSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    middleName: z.string().optional().transform((v) => v || null),
    lastName: z.string().min(1, 'Last name is required'),
    gender: z.string().transform((val) => val.toUpperCase()).pipe(GenderEnum),
    dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format. Use YYYY-MM-DD',
    }),
    nationalIdNumber: z.string().min(1, 'National ID Number is required'),
    birthCertificateNumber: z.string().min(1, 'Birth Certificate Number is required'),
    passportNumber: z.string().optional().transform((v) => v || null),
    streamId: z.string().uuid('Invalid Stream UUID'),
    academicYearId: z.string().uuid('Invalid Academic Year UUID'),
    parentNationalId: z.string().optional().transform((v) => v || null),
});