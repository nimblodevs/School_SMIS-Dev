-- Existing audit rows predate mandatory trace IDs. Preserve them with a
-- deterministic legacy value before enforcing the constraint.
UPDATE "audit_logs"
SET "traceId" = md5('legacy:' || "id")
WHERE "traceId" IS NULL;

ALTER TABLE "audit_logs" ALTER COLUMN "traceId" SET NOT NULL;
