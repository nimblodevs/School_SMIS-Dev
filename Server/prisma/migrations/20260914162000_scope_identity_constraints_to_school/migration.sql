ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_nssfNumber_key";
ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_kraPin_key";
ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_shaNumber_key";
ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_nationalIdNumber_key";

ALTER TABLE "staff" DROP CONSTRAINT IF EXISTS "staff_nssfNumber_key";
ALTER TABLE "staff" DROP CONSTRAINT IF EXISTS "staff_kraPin_key";
ALTER TABLE "staff" DROP CONSTRAINT IF EXISTS "staff_shaNumber_key";
ALTER TABLE "staff" DROP CONSTRAINT IF EXISTS "staff_nationalIdNumber_key";

ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_nationalIdNumber_key";
ALTER TABLE "parents" DROP CONSTRAINT IF EXISTS "parents_nationalIdNumber_key";

CREATE UNIQUE INDEX "teachers_schoolId_nssfNumber_key" ON "teachers"("schoolId", "nssfNumber");
CREATE UNIQUE INDEX "teachers_schoolId_kraPin_key" ON "teachers"("schoolId", "kraPin");
CREATE UNIQUE INDEX "teachers_schoolId_shaNumber_key" ON "teachers"("schoolId", "shaNumber");
CREATE UNIQUE INDEX "teachers_schoolId_nationalIdNumber_key" ON "teachers"("schoolId", "nationalIdNumber");

CREATE UNIQUE INDEX "staff_schoolId_nssfNumber_key" ON "staff"("schoolId", "nssfNumber");
CREATE UNIQUE INDEX "staff_schoolId_kraPin_key" ON "staff"("schoolId", "kraPin");
CREATE UNIQUE INDEX "staff_schoolId_shaNumber_key" ON "staff"("schoolId", "shaNumber");
CREATE UNIQUE INDEX "staff_schoolId_nationalIdNumber_key" ON "staff"("schoolId", "nationalIdNumber");

CREATE UNIQUE INDEX "students_schoolId_nationalIdNumber_key" ON "students"("schoolId", "nationalIdNumber");
CREATE UNIQUE INDEX "parents_schoolId_nationalIdNumber_key" ON "parents"("schoolId", "nationalIdNumber");