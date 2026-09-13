import { z } from 'zod';

const CurriculumEnum = z.enum(['KCSE', 'CBC', 'CAMBRIDGE', 'IB']);

export const createAcademicYearSchema = z.object({
    name: z.string().min(1, 'Academic year name is required'), // e.g., "2026"
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }),
    isCurrent: z.boolean().default(false),
});

export const createTermSchema = z.object({
    name: z.string().min(1, 'Term name is required'), // e.g., "Term 1"
    academicYearId: z.string().uuid('Invalid Academic Year ID'),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }),
});

export const createClassLevelSchema = z.object({
    name: z.string().min(1, 'Class level name is required'), // e.g., "Grade 7", "Form 2"
    curriculum: CurriculumEnum.default('KCSE'),
});

export const createStreamSchema = z.object({
    name: z.string().min(1, 'Stream name is required'), // e.g., "North", "Blue"
    classLevelId: z.string().uuid('Invalid Class Level ID'),
});

export const createSubjectSchema = z.object({
    name: z.string().min(1, 'Subject name is required'),
    code: z.string().min(1, 'Subject code is required'),
    curriculum: CurriculumEnum.default('KCSE'),
});

export const assignTeacherSubjectSchema = z.object({
    teacherId: z.string().uuid('Invalid Teacher ID'),
    subjectId: z.string().uuid('Invalid Subject ID'),
});

export const assignClassSubjectSchema = z.object({
    streamId: z.string().uuid('Invalid Stream ID'),
    subjectId: z.string().uuid('Invalid Subject ID'),
    teacherId: z.string().uuid('Invalid Teacher ID'),
});