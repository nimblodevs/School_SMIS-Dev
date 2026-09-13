import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../../config/prisma.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { env } from '../../config/env.js';

function requireBucket() {
    if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
        throw new BadRequestError('Cloudflare R2 is not configured');
    }
    return env.R2_BUCKET;
}

function storageClient() {
    requireBucket();
    return new S3Client({
        region: 'auto',
        endpoint: env.R2_ENDPOINT,
        credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
}

function safeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
}

export class StorageService {
    static async uploadGeneratedFile({ storageKey, originalName, mimeType, body, relatedType, relatedId }, actor) {
        const schoolId = actor.schoolId;
        if (!schoolId || !storageKey.startsWith(`${schoolId}/`)) {
            throw new BadRequestError('Generated file is outside the current school scope');
        }
        const storageBucket = requireBucket();
        await storageClient().send(new PutObjectCommand({
            Bucket: storageBucket,
            Key: storageKey,
            Body: body,
            ContentType: mimeType,
            ContentLength: body.length,
        }));

        const existing = await prisma.fileUpload.findFirst({ where: { schoolId, storageKey } });
        if (existing) {
            return prisma.fileUpload.update({
                where: { id: existing.id },
                data: { originalName, fileName: originalName, mimeType, sizeBytes: body.length, storageBucket, relatedType, relatedId, url: null },
            });
        }

        return prisma.fileUpload.create({
            data: { schoolId, fileName: originalName, originalName, mimeType, sizeBytes: body.length, storageKey, storageBucket, relatedType, relatedId, uploadedById: actor.id },
        });
    }

    static async createDownloadUrl(storageKey, schoolId) {
        if (!schoolId || !storageKey.startsWith(`${schoolId}/`)) {
            throw new BadRequestError('Storage key is outside the current school scope');
        }
        return getSignedUrl(
            storageClient(),
            new GetObjectCommand({ Bucket: requireBucket(), Key: storageKey }),
            { expiresIn: env.R2_URL_EXPIRES_SECONDS },
        );
    }

    static async downloadFile(storageKey, schoolId) {
        if (!schoolId || !storageKey.startsWith(`${schoolId}/`)) {
            throw new BadRequestError('Storage key is outside the current school scope');
        }
        const response = await storageClient().send(new GetObjectCommand({ Bucket: requireBucket(), Key: storageKey }));
        return Buffer.from(await response.Body.transformToByteArray());
    }

    static async createUploadUrl(fileData, actor) {
        if (!actor.schoolId) throw new BadRequestError('User context must belong to a school');
        const bucket = requireBucket();
        const storageKey = `${actor.schoolId}/${randomUUID()}-${safeFileName(fileData.originalName)}`;
        const uploadUrl = await getSignedUrl(
            storageClient(),
            new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: fileData.mimeType, ContentLength: fileData.sizeBytes }),
            { expiresIn: env.R2_URL_EXPIRES_SECONDS },
        );

        return {
            storageKey,
            storageBucket: bucket,
            uploadUrl,
            expiresIn: env.R2_URL_EXPIRES_SECONDS,
        };
    }

    static async registerFileUpload(fileData, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');
        const storageBucket = requireBucket();
        if (!fileData.storageKey.startsWith(`${schoolId}/`)) {
            throw new BadRequestError('Storage key is outside the current school scope');
        }

        const upload = await prisma.fileUpload.create({
            data: {
                schoolId,
                fileName: fileData.fileName,
                originalName: fileData.originalName,
                mimeType: fileData.mimeType,
                sizeBytes: fileData.sizeBytes,
                storageKey: fileData.storageKey,
                storageBucket,
                url: null,
                relatedType: fileData.relatedType,
                relatedId: fileData.relatedId,
                uploadedById: actor.id,
            },
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'FileUpload',
            entityId: upload.id,
            metadata: { relatedType: fileData.relatedType, relatedId: fileData.relatedId },
            ipAddress,
            userAgent,
        });

        if (fileData.mimeType.startsWith('image/')) {
            const { enqueueJob, JOB_TYPES } = await import('../../shared/background-jobs.js');
            await enqueueJob({
                type: JOB_TYPES.FILE_PROCESSING,
                schoolId,
                payload: { fileUploadId: upload.id, actorId: actor.id },
            });
        }

        return upload;
    }

    static async getFilesByEntity(relatedType, relatedId, schoolId) {
        const files = await prisma.fileUpload.findMany({
            where: {
                schoolId,
                relatedType,
                relatedId,
            },
            orderBy: { createdAt: 'desc' },
        });

        const bucket = requireBucket();
        return Promise.all(files.map(async (file) => ({
            ...file,
            url: undefined,
            downloadUrl: await getSignedUrl(
                storageClient(),
                new GetObjectCommand({ Bucket: bucket, Key: file.storageKey }),
                { expiresIn: env.R2_URL_EXPIRES_SECONDS },
            ),
            expiresIn: env.R2_URL_EXPIRES_SECONDS,
        })));
    }
}