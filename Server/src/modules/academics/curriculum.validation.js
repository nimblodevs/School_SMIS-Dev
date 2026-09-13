import { z } from 'zod';

const CurriculumEnum = z.enum(['KCSE', 'CBC', 'CAMBRIDGE', 'IB']);

export const subjectCurriculumSchema = z.object({
    name: z.string().min(1, 'Subject name is required'),
    code: z.string().min(1, 'Subject code is required'),
    curriculum: CurriculumEnum,
    isElective: z.boolean().default(false),
    // CBC specific fields
    strandCount: z.number().int().nonnegative().optional(),
    // KCSE / Cambridge specific fields
    paperCount: z.number().int().min(1).max(4).optional().default(1),
}).refine((data) => {
    if (data.curriculum === 'CBC' && data.paperCount > 1) {
        return false; // CBC uses strands, not examination papers
    }
    return true;
}, {
    message: 'CBC learning areas cannot have multiple exam papers',
    path: ['paperCount'],
});