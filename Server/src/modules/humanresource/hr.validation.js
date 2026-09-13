import { z } from 'zod';

export const requestLeaveSchema = z.object({
    leaveTypeId: z.string().uuid(),
    teacherId: z.string().uuid().optional(),
    staffId: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().optional(),
}).refine(data => data.teacherId || data.staffId, {
    message: "Either teacherId or staffId must be provided",
});