-- Infrastructure hardening: traceable audits and year-partitioned time-series storage.
ALTER TABLE "audit_logs" ADD COLUMN "traceId" TEXT;
CREATE INDEX "audit_logs_traceId_idx" ON "audit_logs" ("traceId");

-- Prisma models retain their stable parent tables and primary keys. Child tables
-- provide year-local indexes while routing new time-series writes by year.
DO $$
DECLARE
    partition_year integer;
BEGIN
    FOR partition_year IN 2024..2035 LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS "attendance_%s" (CHECK ("date" >= DATE ''%s-01-01'' AND "date" < DATE ''%s-01-01'')) INHERITS ("attendance")',
            partition_year,
            partition_year,
            partition_year + 1
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS "attendance_%s_student_date_idx" ON "attendance_%s" ("studentId", "date")', partition_year, partition_year);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "attendance_%s_school_date_idx" ON "attendance_%s" ("schoolId", "date")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "attendance_%s" ADD CONSTRAINT "attendance_%s_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "attendance_%s" ADD CONSTRAINT "attendance_%s_student_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "attendance_%s" ADD CONSTRAINT "attendance_%s_enrollment_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "attendance_%s" ADD CONSTRAINT "attendance_%s_marked_by_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id")', partition_year, partition_year);
        EXECUTE format('INSERT INTO "attendance_%s" SELECT * FROM "attendance" WHERE "date" >= DATE ''%s-01-01'' AND "date" < DATE ''%s-01-01''', partition_year, partition_year, partition_year + 1);
        EXECUTE format('DELETE FROM "attendance" WHERE "date" >= DATE ''%s-01-01'' AND "date" < DATE ''%s-01-01''', partition_year, partition_year + 1);

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS "competency_assessments_%s" (CHECK ("assessedAt" >= TIMESTAMP ''%s-01-01 00:00:00'' AND "assessedAt" < TIMESTAMP ''%s-01-01 00:00:00'')) INHERITS ("competency_assessments")',
            partition_year,
            partition_year,
            partition_year + 1
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS "competency_assessments_%s_student_idx" ON "competency_assessments_%s" ("studentId", "subStrandId", "termId", "assessedAt" DESC)', partition_year, partition_year);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "competency_assessments_%s_school_date_idx" ON "competency_assessments_%s" ("schoolId", "assessedAt")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "competency_assessments_%s" ADD CONSTRAINT "competency_assessments_%s_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "competency_assessments_%s" ADD CONSTRAINT "competency_assessments_%s_student_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "competency_assessments_%s" ADD CONSTRAINT "competency_assessments_%s_enrollment_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "competency_assessments_%s" ADD CONSTRAINT "competency_assessments_%s_substrand_fkey" FOREIGN KEY ("subStrandId") REFERENCES "sub_strands"("id")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "competency_assessments_%s" ADD CONSTRAINT "competency_assessments_%s_term_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id")', partition_year, partition_year);
        EXECUTE format('ALTER TABLE "competency_assessments_%s" ADD CONSTRAINT "competency_assessments_%s_assessed_by_fkey" FOREIGN KEY ("assessedById") REFERENCES "users"("id")', partition_year, partition_year);
        EXECUTE format('INSERT INTO "competency_assessments_%s" SELECT * FROM "competency_assessments" WHERE "assessedAt" >= TIMESTAMP ''%s-01-01 00:00:00'' AND "assessedAt" < TIMESTAMP ''%s-01-01 00:00:00''', partition_year, partition_year, partition_year + 1);
        EXECUTE format('DELETE FROM "competency_assessments" WHERE "assessedAt" >= TIMESTAMP ''%s-01-01 00:00:00'' AND "assessedAt" < TIMESTAMP ''%s-01-01 00:00:00''', partition_year, partition_year + 1);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION route_attendance_to_year_partition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_table text := format('attendance_%s', EXTRACT(YEAR FROM NEW."date")::integer);
BEGIN
    IF to_regclass(target_table) IS NULL THEN
        RETURN NEW;
    END IF;

    EXECUTE format('INSERT INTO %I SELECT $1.*', target_table) USING NEW;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION route_competency_assessment_to_year_partition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_table text := format('competency_assessments_%s', EXTRACT(YEAR FROM NEW."assessedAt")::integer);
BEGIN
    IF to_regclass(target_table) IS NULL THEN
        RETURN NEW;
    END IF;

    EXECUTE format('INSERT INTO %I SELECT $1.*', target_table) USING NEW;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS attendance_year_partition_router ON "attendance";
CREATE TRIGGER attendance_year_partition_router
BEFORE INSERT ON "attendance"
FOR EACH ROW EXECUTE FUNCTION route_attendance_to_year_partition();

DROP TRIGGER IF EXISTS competency_assessment_year_partition_router ON "competency_assessments";
CREATE TRIGGER competency_assessment_year_partition_router
BEFORE INSERT ON "competency_assessments"
FOR EACH ROW EXECUTE FUNCTION route_competency_assessment_to_year_partition();

COMMENT ON TABLE "attendance" IS 'Year-partitioned through attendance_YYYY inherited partitions and a routing trigger.';
COMMENT ON TABLE "competency_assessments" IS 'Year-partitioned through competency_assessments_YYYY inherited partitions and a routing trigger.';
