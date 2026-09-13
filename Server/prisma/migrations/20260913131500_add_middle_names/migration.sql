-- Add optional middle names to user identities and person profiles.
ALTER TABLE "users" ADD COLUMN "middleName" TEXT;
ALTER TABLE "teachers" ADD COLUMN "middleName" TEXT;
ALTER TABLE "staff" ADD COLUMN "middleName" TEXT;
ALTER TABLE "students" ADD COLUMN "middleName" TEXT;
ALTER TABLE "parents" ADD COLUMN "middleName" TEXT;
