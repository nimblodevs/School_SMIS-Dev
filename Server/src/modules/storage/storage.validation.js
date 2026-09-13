import { z } from 'zod';

export const registerFileUploadSchema = z.object({
    fileName: z.string().min(1),
    originalName: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().positive(),
    storageKey: z.string().min(1),
    relatedType: z.string().optional(),
    relatedId: z.string().uuid().optional(),
});

export const createUploadUrlSchema = z.object({
    originalName: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().positive(),
    relatedType: z.string().optional(),
    relatedId: z.string().uuid().optional(),
});