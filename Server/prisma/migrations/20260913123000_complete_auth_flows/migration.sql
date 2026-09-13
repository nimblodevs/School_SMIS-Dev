-- Complete the authentication schema used by the auth service.
ALTER TABLE "users"
  ADD COLUMN "mustChangePassword" BOOLEAN,
  ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "googleSubject" TEXT;

UPDATE "users" SET "mustChangePassword" = false WHERE "mustChangePassword" IS NULL;
ALTER TABLE "users"
  ALTER COLUMN "mustChangePassword" SET DEFAULT true,
  ALTER COLUMN "mustChangePassword" SET NOT NULL;

CREATE UNIQUE INDEX "users_googleSubject_key" ON "users"("googleSubject");

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPERSONATION_STARTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPERSONATED_ACTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPERSONATION_ENDED';

CREATE TABLE "refresh_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedById" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_sessions_tokenHash_key" ON "refresh_sessions"("tokenHash");
CREATE INDEX "refresh_sessions_userId_revokedAt_idx" ON "refresh_sessions"("userId", "revokedAt");
CREATE INDEX "refresh_sessions_expiresAt_idx" ON "refresh_sessions"("expiresAt");
ALTER TABLE "refresh_sessions"
  ADD CONSTRAINT "refresh_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "password_reset_otps" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_otps_userId_expiresAt_idx" ON "password_reset_otps"("userId", "expiresAt");
ALTER TABLE "password_reset_otps"
  ADD CONSTRAINT "password_reset_otps_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
