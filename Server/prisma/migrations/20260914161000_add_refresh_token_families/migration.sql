ALTER TABLE "refresh_sessions"
ADD COLUMN "familyId" TEXT,
ADD COLUMN "reusedAt" TIMESTAMP(3);

UPDATE "refresh_sessions"
SET "familyId" = "id"
WHERE "familyId" IS NULL;

ALTER TABLE "refresh_sessions"
ALTER COLUMN "familyId" SET NOT NULL;

CREATE INDEX "refresh_sessions_familyId_idx"
ON "refresh_sessions"("familyId");

ALTER TYPE "AuditAction" ADD VALUE 'AUTH_REFRESH_TOKEN_REUSE';