import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const CurriculumEnum = z.enum(['KCSE', 'CBC', 'CAMBRIDGE', 'IB']);

// Strict ISO calendar date, rejects rolling over (e.g. 2026-02-30)
const IsoDateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format')
    .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, 'Not a valid calendar date');

const UuidString = z.string().uuid('Invalid UUID');

// Trim and collapse internal whitespace; reject empty after trim
const TrimmedName = z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .refine((v) => v.length > 0, 'Name cannot be blank')
    .refine((v) => v.length <= 120, 'Name must be 120 characters or fewer');

// Uppercase subject code, 2-6 chars, alphanumeric
const SubjectCode = z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => /^[A-Z0-9]{2,6}$/.test(v), 'Code must be 2-6 uppercase letters or digits');

// Academic year name: "2026" or "2026/2027"
const AcademicYearName = z
    .string()
    .transform((v) => v.trim())
    .refine((v) => /^\d{4}(\/\d{4})?$/.test(v), 'Academic year name must be "YYYY" or "YYYY/YYYY"');

// Term name: "Term 1", "Term 2", "Term 3"
const TermName = z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .refine((v) => /^Term [1-3]$/i.test(v), 'Term name must be "Term 1", "Term 2", or "Term 3"')
    .transform((v) => {
        // Normalize to "Term N"
        const n = v.match(/[1-3]/)[0];
        return `Term ${n}`;
    });

// ---------------------------------------------------------------------------
// Academic Year
// ---------------------------------------------------------------------------

export const createAcademicYearSchema = z
    .object({
        name: AcademicYearName,
        startDate: IsoDateString,
        endDate: IsoDateString,
        isCurrent: z.boolean().default(false),
    })
    .refine((d) => d.startDate < d.endDate, {
        message: 'startDate must be before endDate',
        path: ['endDate'],
    });

// ---------------------------------------------------------------------------
// Term
// ---------------------------------------------------------------------------

export const createTermSchema = z
    .object({
        name: TermName,
        academicYearId: UuidString,
        startDate: IsoDateString,
        endDate: IsoDateString,
    })
    .refine((d) => d.startDate < d.endDate, {
        message: 'startDate must be before endDate',
        path: ['endDate'],
    });

// ---------------------------------------------------------------------------
// Class Level
// ---------------------------------------------------------------------------

export const createClassLevelSchema = z.object({
    name: TrimmedName,
    // curriculum is required — no silent KCSE default
    curriculum: CurriculumEnum,
});

// ---------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------

export const createStreamSchema = z.object({
    name: TrimmedName,
    classLevelId: UuidString,
});

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

export const createSubjectSchema = z.object({
    name: TrimmedName,
    code: SubjectCode,
    curriculum: CurriculumEnum,
});

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export const assignTeacherSubjectSchema = z.object({
    teacherId: UuidString,
    subjectId: UuidString,
});

export const assignClassSubjectSchema = z.object({
    streamId: UuidString,
    subjectId: UuidString,
    teacherId: UuidString,
});

// ---------------------------------------------------------------------------
// Listing (query params)
// ---------------------------------------------------------------------------

export const listQuerySchema = z.object({
    schoolId: UuidString.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
