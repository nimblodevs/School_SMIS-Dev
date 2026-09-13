/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `parents` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `schools` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX IF EXISTS "password_reset_otps_purpose_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "parents_phone_key" ON "parents"("phone");

-- The school phone column is introduced by a later migration in this repository.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'schools'
      AND column_name = 'phone'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "schools_phone_key" ON "schools"("phone");
  END IF;
END $$;
