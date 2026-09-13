-- Keep payment configuration separate from school identity and tenancy data.
CREATE TABLE "school_settings" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "mpesaShortcode" TEXT,
  "mpesaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_settings_schoolId_key" ON "school_settings"("schoolId");
CREATE UNIQUE INDEX "school_settings_mpesaShortcode_key" ON "school_settings"("mpesaShortcode");
ALTER TABLE "school_settings"
  ADD CONSTRAINT "school_settings_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "school_settings" ("id", "schoolId", "mpesaShortcode", "mpesaEnabled", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", "mpesaShortcode", ("mpesaShortcode" IS NOT NULL), "createdAt", CURRENT_TIMESTAMP
FROM "schools";

DROP INDEX "schools_mpesaShortcode_key";
ALTER TABLE "schools" DROP COLUMN "mpesaShortcode";
