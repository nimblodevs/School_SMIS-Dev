import 'dotenv/config';
import { generateKeyPairSync } from 'node:crypto';
import { z } from 'zod';

function normalizePem(value) {
    return value?.replaceAll('\\n', '\n');
}

const testKeyPair =
    process.env.NODE_ENV === 'test'
        ? generateKeyPairSync('rsa', {
            modulusLength: 2048,
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            publicKeyEncoding: { type: 'spki', format: 'pem' },
        })
        : null;

const envSchema = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    JWT_PRIVATE_KEY: z.string().optional(),
    JWT_PUBLIC_KEY: z.string().optional(),
    JWT_EXPIRES_IN: z.string().default('10m'),
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

if (env.NODE_ENV !== 'test' && (!env.JWT_PRIVATE_KEY || !env.JWT_PUBLIC_KEY)) {
    console.error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required outside test mode');
    process.exit(1);
}

env.JWT_PRIVATE_KEY = normalizePem(env.JWT_PRIVATE_KEY) ?? testKeyPair?.privateKey;
env.JWT_PUBLIC_KEY = normalizePem(env.JWT_PUBLIC_KEY) ?? testKeyPair?.publicKey;
