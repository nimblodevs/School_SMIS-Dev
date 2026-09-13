-- Add revocable session state and login abuse controls.
ALTER TABLE "users"
  ADD COLUMN "currentSessionId" TEXT,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginIp" TEXT,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Extend the audit event vocabulary for authentication security events.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AUTH_LOGIN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AUTH_LOGIN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AUTH_LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGE_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_LOCKED';

-- Allow anonymous failed-login events and structured security context.
ALTER TABLE "audit_logs"
  ALTER COLUMN "actorId" DROP NOT NULL,
  ALTER COLUMN "entityId" DROP NOT NULL,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE INDEX "audit_logs_action_createdAt_idx"
  ON "audit_logs"("action", "createdAt");
