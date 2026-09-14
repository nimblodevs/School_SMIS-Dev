-- Add five-digit school codes and independent employee sequences.
ALTER TABLE "schools"
  ADD COLUMN "schoolCode" TEXT,
  ADD COLUMN "nextTeacherSequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextStaffSequence" INTEGER NOT NULL DEFAULT 0;

WITH numbered_schools AS (
  SELECT "id", lpad(row_number() OVER (ORDER BY "createdAt", "id")::text, 5, '0') AS "schoolCode"
  FROM "schools"
)
UPDATE "schools" AS school
SET "schoolCode" = numbered_schools."schoolCode"
FROM numbered_schools
WHERE school."id" = numbered_schools."id";

ALTER TABLE "schools"
  ALTER COLUMN "schoolCode" SET NOT NULL;

CREATE UNIQUE INDEX "schools_schoolCode_key" ON "schools"("schoolCode");
ALTER TABLE "schools"
  ADD CONSTRAINT "schools_schoolCode_format_check"
  CHECK ("schoolCode" ~ '^[0-9]{5}$');
