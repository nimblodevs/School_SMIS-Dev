ALTER TABLE "refresh_sessions"
ADD COLUMN "isImpersonated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "impersonatedUserId" TEXT,
ADD COLUMN "actorSessionId" TEXT;

ALTER TABLE "password_reset_otps"
ADD COLUMN "challengeTokenHash" TEXT;

CREATE UNIQUE INDEX "password_reset_otps_challengeTokenHash_key"
ON "password_reset_otps"("challengeTokenHash");