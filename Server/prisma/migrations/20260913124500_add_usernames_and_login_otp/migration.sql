-- Add usernames for the two-step login flow.
ALTER TABLE "users" ADD COLUMN "username" TEXT;

UPDATE "users"
SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) || '-' || substr("id", 1, 8)
WHERE "username" IS NULL;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- Reuse the OTP table for login verification while keeping reset codes isolated.
ALTER TABLE "password_reset_otps"
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET';

CREATE INDEX "password_reset_otps_purpose_idx" ON "password_reset_otps"("purpose");
