import { z } from 'zod';

export const executePayrollSchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Month format must be YYYY-MM'),
});