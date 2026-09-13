import { StorageService } from './storage.service.js';
import { createUploadUrlSchema, registerFileUploadSchema } from './storage.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class StorageController {
    static async createUploadUrl(req, res, next) {
        try {
            const validation = createUploadUrlSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const grant = await StorageService.createUploadUrl(validation.data, req.user);
            return res.status(201).json({ success: true, data: grant });
        } catch (error) {
            next(error);
        }
    }

    static async registerUpload(req, res, next) {
        try {
            const validation = registerFileUploadSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const fileRecord = await StorageService.registerFileUpload(
                validation.data,
                req.user,
                { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
            );

            return res.status(201).json({
                success: true,
                message: 'File reference stored successfully',
                data: fileRecord,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getEntityFiles(req, res, next) {
        try {
            const { entityType, entityId } = req.params;
            const files = await StorageService.getFilesByEntity(
                entityType,
                entityId,
                req.user.schoolId
            );

            return res.status(200).json({
                success: true,
                data: files,
            });
        } catch (error) {
            next(error);
        }
    }
}