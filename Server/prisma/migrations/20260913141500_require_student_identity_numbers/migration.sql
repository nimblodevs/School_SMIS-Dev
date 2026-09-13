-- Students must have both national ID and birth certificate numbers.
ALTER TABLE "students" ADD COLUMN "nationalIdNumber" TEXT;

UPDATE "students"
SET "nationalIdNumber" = 'REVIEW-ID-' || substr("id", 1, 8)
WHERE "nationalIdNumber" IS NULL;

UPDATE "students"
SET "birthCertificateNumber" = 'REVIEW-BC-' || substr("id", 1, 8)
WHERE "birthCertificateNumber" IS NULL;

ALTER TABLE "students"
  ALTER COLUMN "nationalIdNumber" SET NOT NULL,
  ALTER COLUMN "birthCertificateNumber" SET NOT NULL;

CREATE UNIQUE INDEX "students_nationalIdNumber_key" ON "students"("nationalIdNumber");
