import { z } from 'zod';

export const recordAssessmentSchema = z.object({
    studentId: z.string().uuid(),
    enrollmentId: z.string().uuid(),
    subStrandId: z.string().uuid(),
    termId: z.string().uuid(),
    level: z.enum([
        'EXCEEDING_EXPECTATION',
        'MEETING_EXPECTATION',
        'APPROACHING_EXPECTATION',
        'BELOW_EXPECTATION',
    ]),
    remarks: z.string().optional(),
    assessedAt: z.string().datetime({ offset: true }).optional(),
});
