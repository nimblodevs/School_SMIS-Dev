import { env } from '../../config/env.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Parse once at startup.
const ALLOWED_ORIGINS = new Set(
    env.CLIENT_ORIGINS.split(',')
        .map((o) => o.trim().toLowerCase().replace(/\/$/, ''))
        .filter(Boolean),
);

function originFromReferer(referer) {
    if (!referer) return null;
    try {
        const url = new URL(referer);
        return `${url.protocol}//${url.host}`.toLowerCase();
    } catch {
        return null;
    }
}

export function originGuard(req, res, next) {
    if (!STATE_CHANGING_METHODS.has(req.method)) return next();

    // Only cookie-authenticated requests are CSRF-able.
    // Bearer tokens must be explicitly attached by the client, so they can't
    // be sent by a browser on behalf of another origin.
    const usesCookieAuth = Boolean(req.cookies?.token);
    if (!usesCookieAuth) return next();

    const origin =
        req.get('origin')?.toLowerCase().replace(/\/$/, '') ??
        originFromReferer(req.get('referer'));

    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return next(new ForbiddenError('Request origin is not allowed'));
    }

    return next();
}