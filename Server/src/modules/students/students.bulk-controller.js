import multer from 'multer';
import { BulkAdmissionService } from './students.bulk-service.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

// Multer memory storage configuration
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        const hasAllowedExtension = /\.(csv|xlsx)$/i.test(file.originalname);
        if (allowedMimes.includes(file.mimetype) && hasAllowedExtension) {
            cb(null, true);
        } else {
            cb(new BadRequestError('Invalid file type. Only CSV and XLSX files are supported'));
        }
    },
}).single('file');

export async function handleBulkAdmission(req, res, next) {
    try {
        if (!req.file) {
            throw new BadRequestError('Please attach a CSV or XLSX file to process');
        }

        const ipAddress = req.ip || req.headers['x-forwarded-for'];
        const userAgent = req.headers['user-agent'];

        const result = await BulkAdmissionService.processBulkAdmission(
            req.file.buffer,
            req.file.mimetype,
            req.user,
            {
                ipAddress,
                userAgent,
            },
        );

        if (!result.success) {
            return res.status(422).json({
                success: false,
                message:
                    'Bulk processing failed due to validation errors. No records were imported.',
                summary: {
                    totalRows: result.totalRows,
                    failedRows: result.failedRows,
                },
                errors: result.errors,
            });
        }

        return res.status(201).json({
            success: true,
            message: `Successfully admitted ${result.admittedCount} students`,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}
