import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from './env.js';

const isDevelopment = env.NODE_ENV === 'development';

export const logger = pino({
    level: env.LOG_LEVEL,
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers.set-cookie',
            '*.password',
            '*.passwordHash',
            '*.token',
            '*.accessToken',
        ],
        censor: '[REDACTED]',
    },
    ...(isDevelopment && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    }),
});

export const requestLogger = pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || undefined,
    customLogLevel: (req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, _res) => `${req.method} ${req.originalUrl} completed`,
    customErrorMessage: (req, _res, _error) => `${req.method} ${req.originalUrl} failed`,
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.path,
            remoteAddress: req.ip,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
});
