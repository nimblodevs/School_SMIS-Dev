-- User names are stored on person profiles; remove the duplicate identity column.
ALTER TABLE "users" DROP COLUMN "middleName";
