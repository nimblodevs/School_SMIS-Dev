import { z } from 'zod';

const slugSchema = z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers, and hyphens only');

export const createSchoolSchema = z.object({
    name: z.string().trim().min(2).max(200),
    slug: slugSchema,
    motto: z.string().trim().max(500).optional(),
    vision: z.string().trim().max(2000).optional(),
    mission: z.string().trim().max(2000).optional(),
    address: z.string().trim().max(300).optional(),
    city: z.string().trim().max(100).optional(),
    county: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(30).optional(),
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    website: z.string().trim().url().optional(),
});

export const updateSchoolSchema = z.object({
    name: z.string().trim().min(2).max(200).optional(),
    slug: slugSchema.optional(),
    motto: z.string().trim().max(500).nullable().optional(),
    vision: z.string().trim().max(2000).nullable().optional(),
    mission: z.string().trim().max(2000).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    county: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().max(30).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    email: z.string().trim().toLowerCase().email().nullable().optional(),
    website: z.string().trim().url().nullable().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const schoolIdSchema = z.object({
    schoolId: z.string().uuid(),
});

export const updateSchoolSettingsSchema = z.object({
    mpesaShortcode: z.string().trim().min(3).max(30).nullable().optional(),
    mpesaEnabled: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one settings field is required');
