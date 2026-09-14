import { z } from 'zod';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const supportedMimeType = z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export const registerFileUploadSchema = z.object({
    fileName: z.string().min(1),
    originalName: z.string().min(1),
    mimeType: supportedMimeType,
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    storageKey: z.string().min(1),
    relatedType: z.string().optional(),
    relatedId: z.string().uuid().optional(),
});

export const createUploadUrlSchema = z.object({
    originalName: z.string().min(1),
    mimeType: supportedMimeType,
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    relatedType: z.string().optional(),
    relatedId: z.string().uuid().optional(),
});
