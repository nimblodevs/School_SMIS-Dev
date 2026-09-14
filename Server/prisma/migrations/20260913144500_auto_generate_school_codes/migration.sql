-- Generate school codes centrally and safely under concurrent school creation.
CREATE TABLE "system_sequences" (
  "key" TEXT NOT NULL,
  "nextSchoolCode" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_sequences_pkey" PRIMARY KEY ("key")
);

INSERT INTO "system_sequences" ("key", "nextSchoolCode", "updatedAt")
SELECT 'SCHOOL_CODE', COALESCE(MAX("schoolCode"::integer), 0) + 1, CURRENT_TIMESTAMP
FROM "schools";
