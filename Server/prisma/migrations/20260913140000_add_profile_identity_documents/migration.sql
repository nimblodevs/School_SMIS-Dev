-- Add identity-document fields to employee, parent, and student profiles.
ALTER TABLE "teachers"
  ADD COLUMN "nationalIdNumber" TEXT,
  ADD COLUMN "passportNumber" TEXT;

ALTER TABLE "staff"
  ADD COLUMN "nationalIdNumber" TEXT,
  ADD COLUMN "passportNumber" TEXT;

ALTER TABLE "parents"
  ADD COLUMN "nationalIdNumber" TEXT,
  ADD COLUMN "passportNumber" TEXT;

ALTER TABLE "students"
  ADD COLUMN "passportNumber" TEXT,
  ADD COLUMN "birthCertificateNumber" TEXT;

CREATE UNIQUE INDEX "teachers_nationalIdNumber_key" ON "teachers"("nationalIdNumber");
CREATE UNIQUE INDEX "teachers_passportNumber_key" ON "teachers"("passportNumber");
CREATE UNIQUE INDEX "staff_nationalIdNumber_key" ON "staff"("nationalIdNumber");
CREATE UNIQUE INDEX "staff_passportNumber_key" ON "staff"("passportNumber");
CREATE UNIQUE INDEX "parents_nationalIdNumber_key" ON "parents"("nationalIdNumber");
CREATE UNIQUE INDEX "parents_passportNumber_key" ON "parents"("passportNumber");
CREATE UNIQUE INDEX "students_passportNumber_key" ON "students"("passportNumber");
CREATE UNIQUE INDEX "students_birthCertificateNumber_key" ON "students"("birthCertificateNumber");
