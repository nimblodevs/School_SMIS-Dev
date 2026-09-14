-- Add school profile and contact information.
ALTER TABLE "schools"
  ADD COLUMN "motto" TEXT,
  ADD COLUMN "vision" TEXT,
  ADD COLUMN "mission" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "county" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "website" TEXT;

UPDATE "schools" SET "name" = upper("name");
