import { z } from 'zod';

export const executePayrollSchema = z
    .object({
        month: z
            .string()
            .regex(/^\d{4}-\d{2}$/, 'Month format must be YYYY-MM')
            .refine((value) => {
                const monthNumber = Number(value.split('-')[1]);
                return monthNumber >= 1 && monthNumber <= 12;
            }, 'Month must be between 01 and 12'),
    })
    .transform(({ month }) => {
        const [yearText, monthText] = month.split('-');
        return { year: Number(yearText), month: Number(monthText) };
    });
