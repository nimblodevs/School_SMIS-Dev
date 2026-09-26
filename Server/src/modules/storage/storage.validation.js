import { z } from 'zod';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const supportedMimeType = z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const profilePhotoTypes = new Set([
    'SCHOOL_PROFILE_PHOTO',
    'STUDENT_PROFILE_PHOTO',
    'PARENT_PROFILE_PHOTO',
]);

function validateProfilePhoto(data, context) {
    if (!profilePhotoTypes.has(data.relatedType)) return;
    if (!data.relatedId) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['relatedId'], message: 'Profile photos require a profile ID' });
    }
    if (!data.mimeType.startsWith('image/')) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'Profile photos must be image files' });
    }
}

export const registerFileUploadSchema = z.object({
    fileName: z.string().min(1),
    originalName: z.string().min(1),
    mimeType: supportedMimeType,
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    storageKey: z.string().min(1),
    relatedType: z.string().optional(),
    relatedId: z.string().uuid().optional(),
}).superRefine(validateProfilePhoto);

export const createUploadUrlSchema = z.object({
    originalName: z.string().min(1),
    mimeType: supportedMimeType,
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    relatedType: z.string().optional(),
    relatedId: z.string().uuid().optional(),
}).superRefine(validateProfilePhoto);
