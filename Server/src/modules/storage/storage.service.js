import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../../config/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { env } from '../../config/env.js';
import { StudentService } from '../students/students.service.js';

const PROFILE_PHOTO_TYPES = new Set([
    'SCHOOL_PROFILE_PHOTO',
    'STUDENT_PROFILE_PHOTO',
    'PARENT_PROFILE_PHOTO',
]);

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
        credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
    });
}

function safeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
}

export class StorageService {
    static async assertProfilePhotoAccess({ relatedType, relatedId, mimeType }, actor, upload = false) {
        if (!PROFILE_PHOTO_TYPES.has(relatedType)) return;
        if (!relatedId) throw new BadRequestError('Profile photos require a profile ID');
        if (upload && !mimeType?.startsWith('image/')) {
            throw new BadRequestError('Profile photos must be image files');
        }
        if (!actor.schoolId) throw new BadRequestError('User context must belong to a school');

        if (relatedType === 'SCHOOL_PROFILE_PHOTO') {
            if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
                throw new ForbiddenError('You cannot manage this school photo');
            }
            const school = await prisma.school.findUnique({
                where: { id: relatedId },
                select: { id: true },
            });
            if (!school || school.id !== actor.schoolId) {
                throw new NotFoundError('School profile not found');
            }
            return;
        }

        if (relatedType === 'STUDENT_PROFILE_PHOTO') {
            if (upload) StudentService.assertCanManage(actor);
            if (upload) await StudentService.assertInSchool(relatedId, actor);
            else await StudentService.getById(relatedId, actor);
            return;
        }

        const parent = await prisma.parent.findFirst({
            where: { id: relatedId, schoolId: actor.schoolId },
            select: { id: true, userId: true },
        });
        if (!parent) throw new NotFoundError('Parent profile not found');

        const canManageParentPhoto = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(actor.role);
        if (upload && !canManageParentPhoto && parent.userId !== actor.id) {
            throw new ForbiddenError('You cannot manage this parent photo');
        }
        if (!upload && !canManageParentPhoto && parent.userId !== actor.id) {
            throw new ForbiddenError('You cannot view this parent photo');
        }
    }

    static async uploadGeneratedFile(
        { storageKey, originalName, mimeType, body, relatedType, relatedId },
        actor,
    ) {
        const schoolId = actor.schoolId;
        if (!schoolId || !storageKey.startsWith(`${schoolId}/`)) {
            throw new BadRequestError('Generated file is outside the current school scope');
        }
        const storageBucket = requireBucket();
        await storageClient().send(
            new PutObjectCommand({
                Bucket: storageBucket,
                Key: storageKey,
                Body: body,
                ContentType: mimeType,
                ContentLength: body.length,
            }),
        );

        const existing = await prisma.fileUpload.findFirst({ where: { schoolId, storageKey } });
        if (existing) {
            return prisma.fileUpload.update({
                where: { id: existing.id },
                data: {
                    originalName,
                    fileName: originalName,
                    mimeType,
                    sizeBytes: body.length,
                    storageBucket,
                    relatedType,
                    relatedId,
                    url: null,
                },
            });
        }

        return prisma.fileUpload.create({
            data: {
                schoolId,
                fileName: originalName,
                originalName,
                mimeType,
                sizeBytes: body.length,
                storageKey,
                storageBucket,
                relatedType,
                relatedId,
                uploadedById: actor.id,
            },
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
        const response = await storageClient().send(
            new GetObjectCommand({ Bucket: requireBucket(), Key: storageKey }),
        );
        return Buffer.from(await response.Body.transformToByteArray());
    }

    static async createUploadUrl(fileData, actor) {
        if (!actor.schoolId) throw new BadRequestError('User context must belong to a school');
        await this.assertProfilePhotoAccess(fileData, actor, true);
        const bucket = requireBucket();
        const storageKey = `${actor.schoolId}/${randomUUID()}-${safeFileName(fileData.originalName)}`;
        const uploadUrl = await getSignedUrl(
            storageClient(),
            new PutObjectCommand({
                Bucket: bucket,
                Key: storageKey,
                ContentType: fileData.mimeType,
                ContentLength: fileData.sizeBytes,
            }),
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
        await this.assertProfilePhotoAccess(fileData, actor, true);
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

    static async getFilesByEntity(relatedType, relatedId, actor) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new ForbiddenError('User is not associated with a school');

        if (PROFILE_PHOTO_TYPES.has(relatedType)) {
            await this.assertProfilePhotoAccess({ relatedType, relatedId }, actor);
        } else if (relatedType === 'REPORT_CARD') {
            await StudentService.getById(relatedId, actor);
        } else if (relatedType === 'PAYSLIP') {
            const payslip = await prisma.payslip.findFirst({
                where: {
                    id: relatedId,
                    schoolId,
                    ...(!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)
                        ? {
                              OR: [
                                  { teacher: { userId: actor.id } },
                                  { staff: { userId: actor.id } },
                              ],
                          }
                        : {}),
                },
                select: { id: true },
            });
            if (!payslip) throw new NotFoundError('Payslip not found');
        } else if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
            throw new ForbiddenError('You do not have access to files for this entity type');
        }

        const files = await prisma.fileUpload.findMany({
            where: {
                schoolId,
                relatedType,
                relatedId,
            },
            orderBy: { createdAt: 'desc' },
        });

        const bucket = requireBucket();
        return Promise.all(
            files.map(async (file) => ({
                ...file,
                url: undefined,
                downloadUrl: await getSignedUrl(
                    storageClient(),
                    new GetObjectCommand({ Bucket: bucket, Key: file.storageKey }),
                    { expiresIn: env.R2_URL_EXPIRES_SECONDS },
                ),
                expiresIn: env.R2_URL_EXPIRES_SECONDS,
            })),
        );
    }
}
