import { env } from '../../config/env.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';

const allowedOrigins = env.CLIENT_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originGuard(req, res, next) {
    if (!stateChangingMethods.has(req.method) || !req.cookies?.token) {
        return next();
    }

    const origin = req.get('origin');
    if (!origin || !allowedOrigins.includes(origin)) {
        return next(new ForbiddenError('Request origin is not allowed'));
    }

    return next();
}
