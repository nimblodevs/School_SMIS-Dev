import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import hpp from 'hpp';
import { env } from './config/env.js';
import { errorHandler } from './api/middlewares/errorHandler.js';
import { originGuard } from './api/middlewares/originGuard.js';
import apiRouter from './api/routes.js';
import { requestLogger } from './config/logger.js';
import { getOrCreateTraceId, runWithTraceId } from './config/tracing.js';

const app = express();
const allowedOrigins = env.CLIENT_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);

app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');

// Enable CORS with Credentials support for Cookies
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Origin is not allowed by CORS'));
        },
        credentials: true, // Required for HTTP-Only cookies to pass cross-origin
    })
);

// Standard Middlewares
app.use(helmet());
app.use(hpp());
app.use(requestLogger);
app.use((req, res, next) => {
    const traceId = getOrCreateTraceId(req.id);
    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Request-Id', req.id || traceId);
    runWithTraceId(traceId, next);
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie Parser Middleware
app.use(cookieParser());
app.use(originGuard);

// Base Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount versioned API routes
app.use('/api/v1', apiRouter);

// 404 Route Handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Requested endpoint not found' });
});

// Central Error Handler Middleware
app.use(errorHandler);

export { app };