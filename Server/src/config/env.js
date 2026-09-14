import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    JWT_ISSUER: z.string().default('school-smis-api'),
    JWT_AUDIENCE: z.string().default('school-smis-client'),
    CLIENT_ORIGINS: z.string().default('http://localhost:3000'),
    TRUST_PROXY: z.coerce.boolean().default(false),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),
    GOOGLE_CLIENT_ID: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    PASSWORD_RESET_OTP_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
    LOGIN_OTP_MINUTES: z.coerce.number().int().min(1).max(10).default(5),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().default('school-files'),
    R2_ENDPOINT: z.string().url().optional(),
    R2_URL_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    OTEL_SERVICE_NAME: z.string().default('school-smis-api'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    process.exit(1);
}

export const env = parsed.data;
