// src/shared/errors/AppError.js

/**
 * Base application error.
 *
 * Every subclass must define its own `code` (stable, machine-readable) and
 * `statusCode`. The response shape is:
 *
 *   { success: false, error: { code, message, details?, stack? } }
 *
 * `code` values are part of the public API contract. Never change them
 * without a version bump. Add new codes; don't repurpose old ones.
 */
export class AppError extends Error {
    /**
     * @param {string} message       human-readable message (may change)
     * @param {number} statusCode    HTTP status
     * @param {object|null} errors   structured details (Zod bag, field map)
     * @param {object} [options]
     * @param {string} [options.code]      stable machine code; defaults to the class name
     * @param {boolean} [options.operational=true]  true for expected errors, false for programmer bugs
     * @param {Error} [options.cause]      original error being wrapped
     */
    constructor(message, statusCode = 500, errors = null, options = {}) {
        super(message, options.cause ? { cause: options.cause } : undefined);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errors = errors;
        this.code = options.code ?? this.constructor.name.replace(/Error$/, '').toUpperCase();
        this.isOperational = options.operational ?? true;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Serialize for logging / response. `errorHandler` uses this when present.
     */
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            ...(this.errors && { details: this.errors }),
        };
    }
}

// ---------------------------------------------------------------------------
// 4xx — client errors
// ---------------------------------------------------------------------------

export class BadRequestError extends AppError {
    constructor(message = 'Invalid request payload', errors = null, options = {}) {
        super(message, 400, errors, { code: 'BAD_REQUEST', ...options });
    }
}

export class ValidationError extends AppError {
    constructor(message = 'Validation failed', errors = null, options = {}) {
        super(message, 422, errors, { code: 'VALIDATION_ERROR', ...options });
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', options = {}) {
        super(message, 401, null, { code: 'UNAUTHORIZED', ...options });
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden', options = {}) {
        super(message, 403, null, { code: 'FORBIDDEN', ...options });
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', options = {}) {
        super(message, 404, null, { code: 'NOT_FOUND', ...options });
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Conflict', errors = null, options = {}) {
        super(message, 409, errors, { code: 'CONFLICT', ...options });
    }
}

export class GoneError extends AppError {
    constructor(message = 'Resource is no longer available', options = {}) {
        super(message, 410, null, { code: 'GONE', ...options });
    }
}

export class PayloadTooLargeError extends AppError {
    constructor(message = 'Payload too large', options = {}) {
        super(message, 413, null, { code: 'PAYLOAD_TOO_LARGE', ...options });
    }
}

export class UnsupportedMediaTypeError extends AppError {
    constructor(message = 'Unsupported media type', options = {}) {
        super(message, 415, null, { code: 'UNSUPPORTED_MEDIA_TYPE', ...options });
    }
}

export class RateLimitError extends AppError {
    constructor(message = 'Too many requests', options = {}) {
        super(message, 429, null, { code: 'RATE_LIMITED', ...options });
    }
}

// ---------------------------------------------------------------------------
// 5xx — server errors
// ---------------------------------------------------------------------------

export class InternalServerError extends AppError {
    constructor(message = 'Internal server error', options = {}) {
        super(message, 500, null, { code: 'INTERNAL_ERROR', ...options });
    }
}

export class NotImplementedError extends AppError {
    constructor(message = 'Not implemented', options = {}) {
        super(message, 501, null, { code: 'NOT_IMPLEMENTED', ...options });
    }
}

export class ServiceUnavailableError extends AppError {
    constructor(message = 'Service temporarily unavailable', options = {}) {
        super(message, 503, null, { code: 'SERVICE_UNAVAILABLE', ...options });
    }
}
