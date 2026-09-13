import { AppError } from '../../shared/errors/AppError.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export const errorHandler = (err, req, res, next) => {
    const isKnownError = err instanceof AppError;
    const error = isKnownError ? err : new AppError('Internal Server Error', 500);

    (req.log || logger).error({ err, method: req.method, url: req.originalUrl }, 'Request failed');

    const response = {
        success: false,
        message: error.message,
        ...(isKnownError && error.errors && { errors: error.errors }),
        ...(env.NODE_ENV === 'development' && isKnownError && { stack: err.stack }),
    };

    return res.status(error.statusCode).json(response);
};