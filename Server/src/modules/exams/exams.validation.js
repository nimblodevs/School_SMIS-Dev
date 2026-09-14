import { z } from 'zod';

export const createExamSchema = z.object({
    name: z.string().min(1, 'Exam name is required'),
    termId: z.string().uuid(),
    subjectId: z.string().uuid(),
    examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    maxScore: z.number().positive().default(100),
});

export const recordBulkResultsSchema = z.object({
    results: z
        .array(
            z.object({
                studentId: z.string().uuid(),
                enrollmentId: z.string().uuid(),
                score: z.number().nonnegative(),
                grade: z.string().optional(),
                remarks: z.string().optional(),
            }),
        )
        .min(1, 'Results payload cannot be empty'),
});
