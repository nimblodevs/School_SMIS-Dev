import { z } from 'zod';

export const markAttendanceSchema = z.object({
    date: z
        .string()
        .datetime({ offset: true })
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    streamId: z.string().uuid(),
    attendances: z
        .array(
            z.object({
                studentId: z.string().uuid(),
                enrollmentId: z.string().uuid(),
                status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
            }),
        )
        .min(1, 'At least one student attendance status must be provided'),
});

export const getRegisterQuerySchema = z.object({
    streamId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});
