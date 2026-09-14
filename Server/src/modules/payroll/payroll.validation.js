import { z } from 'zod';

export const executePayrollSchema = z
    .object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month format must be YYYY-MM'),
    })
    .transform(({ month }) => {
        const [year, monthNumber] = month.split('-').map(Number);
        return { year, month: monthNumber };
    });
