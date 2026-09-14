ALTER TABLE "password_reset_otps"
ADD COLUMN "isResend" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "password_reset_otps_user_id_purpose_is_resend_created_at_idx"
ON "password_reset_otps"("userId", "purpose", "isResend", "createdAt");
