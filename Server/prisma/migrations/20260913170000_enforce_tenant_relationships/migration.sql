-- Prevent tenant-owned records from referencing records owned by another school.
-- Prisma's application-level extension scopes queries; these triggers protect the
-- invariant for raw SQL, nested writes, scripts, and future service regressions.

CREATE OR REPLACE FUNCTION "enforce_same_school_reference"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    child_school_id TEXT;
    referenced_id TEXT;
    referenced_school_id TEXT;
BEGIN
    child_school_id := to_jsonb(NEW) ->> 'schoolId';
    referenced_id := to_jsonb(NEW) ->> TG_ARGV[2];

    IF child_school_id IS NULL OR referenced_id IS NULL THEN
        RETURN NEW;
    END IF;

    EXECUTE format(
        'SELECT "schoolId" FROM %I WHERE %I::text = $1',
        TG_ARGV[0],
        TG_ARGV[1]
    )
    INTO referenced_school_id
    USING referenced_id;

    -- A NULL school is reserved for platform users. It is valid only on actor
    -- relations; identity/profile relations must always belong to the tenant.
    IF referenced_school_id IS NULL AND NOT (
        TG_ARGV[0] = 'users'
        AND TG_ARGV[2] = ANY (ARRAY[
            'markedById',
            'assessedById',
            'recordedById',
            'grantedById',
            'processedById',
            'approvedById',
            'initiatedById',
            'reviewedById'
        ])
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = format(
                'Tenant boundary violation: %I.%I must reference a tenant-owned record',
                TG_TABLE_NAME,
                TG_ARGV[2]
            );
    ELSIF referenced_school_id IS NOT NULL AND referenced_school_id <> child_school_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = format(
                'Tenant boundary violation: %I.%I references a record from another school',
                TG_TABLE_NAME,
                TG_ARGV[2]
            );
    END IF;

    RETURN NEW;
END;
$$;

DO $$
DECLARE
    relation RECORD;
    has_violation BOOLEAN;
    trigger_name TEXT;
BEGIN
    FOR relation IN
        SELECT
            constraint_row.conname AS constraint_name,
            child_class.relname AS child_table,
            child_attribute.attname AS child_column,
            parent_class.relname AS parent_table,
            parent_attribute.attname AS parent_column
        FROM pg_constraint constraint_row
        JOIN pg_class child_class
          ON child_class.oid = constraint_row.conrelid
        JOIN pg_namespace child_namespace
          ON child_namespace.oid = child_class.relnamespace
        JOIN pg_class parent_class
          ON parent_class.oid = constraint_row.confrelid
        JOIN pg_namespace parent_namespace
          ON parent_namespace.oid = parent_class.relnamespace
        JOIN pg_attribute child_attribute
          ON child_attribute.attrelid = child_class.oid
         AND child_attribute.attnum = constraint_row.conkey[1]
        JOIN pg_attribute parent_attribute
          ON parent_attribute.attrelid = parent_class.oid
         AND parent_attribute.attnum = constraint_row.confkey[1]
        WHERE constraint_row.contype = 'f'
          AND array_length(constraint_row.conkey, 1) = 1
          AND child_namespace.nspname = current_schema()
          AND parent_namespace.nspname = current_schema()
          AND child_attribute.attname <> 'schoolId'
          AND EXISTS (
              SELECT 1
              FROM pg_attribute attribute_row
              WHERE attribute_row.attrelid = child_class.oid
                AND attribute_row.attname = 'schoolId'
                AND NOT attribute_row.attisdropped
          )
          AND EXISTS (
              SELECT 1
              FROM pg_attribute attribute_row
              WHERE attribute_row.attrelid = parent_class.oid
                AND attribute_row.attname = 'schoolId'
                AND NOT attribute_row.attisdropped
          )
    LOOP
        EXECUTE format(
            $query$SELECT EXISTS (
                SELECT 1
                FROM %I child_row
                JOIN %I parent_row ON child_row.%I = parent_row.%I
                WHERE child_row."schoolId" IS NOT NULL
                  AND (
                      parent_row."schoolId" <> child_row."schoolId"
                      OR (
                          parent_row."schoolId" IS NULL
                          AND NOT (
                              %L = 'users'
                              AND %L = ANY (ARRAY[
                                  'markedById',
                                  'assessedById',
                                  'recordedById',
                                  'grantedById',
                                  'processedById',
                                  'approvedById',
                                  'initiatedById',
                                  'reviewedById'
                              ])
                          )
                      )
                  )
            )$query$,
            relation.child_table,
            relation.parent_table,
            relation.child_column,
            relation.parent_column,
            relation.parent_table,
            relation.child_column
        )
        INTO has_violation;

        IF has_violation THEN
            RAISE EXCEPTION 'Existing tenant boundary violation in %.%',
                relation.child_table,
                relation.child_column;
        END IF;

        trigger_name := 'tenant_guard_' || substr(md5(relation.constraint_name), 1, 16);
        EXECUTE format(
            'CREATE TRIGGER %I
             BEFORE INSERT OR UPDATE OF %I, "schoolId" ON %I
             FOR EACH ROW EXECUTE FUNCTION "enforce_same_school_reference"(%L, %L, %L)',
            trigger_name,
            relation.child_column,
            relation.child_table,
            relation.parent_table,
            relation.parent_column,
            relation.child_column
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION "enforce_student_parent_school"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    student_school_id TEXT;
    parent_school_id TEXT;
BEGIN
    SELECT "schoolId" INTO student_school_id
    FROM "students"
    WHERE "id" = NEW."studentId";

    SELECT "schoolId" INTO parent_school_id
    FROM "parents"
    WHERE "id" = NEW."parentId";

    IF student_school_id IS DISTINCT FROM parent_school_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Tenant boundary violation: student and parent belong to different schools';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "enforce_teacher_subject_school"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    teacher_school_id TEXT;
    subject_school_id TEXT;
BEGIN
    SELECT "schoolId" INTO teacher_school_id
    FROM "teachers"
    WHERE "id" = NEW."teacherId";

    SELECT "schoolId" INTO subject_school_id
    FROM "subjects"
    WHERE "id" = NEW."subjectId";

    IF teacher_school_id IS DISTINCT FROM subject_school_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Tenant boundary violation: teacher and subject belong to different schools';
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "student_parents" student_parent
        JOIN "students" student ON student."id" = student_parent."studentId"
        JOIN "parents" parent ON parent."id" = student_parent."parentId"
        WHERE student."schoolId" <> parent."schoolId"
    ) THEN
        RAISE EXCEPTION 'Existing tenant boundary violation in student_parents';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "teacher_subjects" teacher_subject
        JOIN "teachers" teacher ON teacher."id" = teacher_subject."teacherId"
        JOIN "subjects" subject ON subject."id" = teacher_subject."subjectId"
        WHERE teacher."schoolId" <> subject."schoolId"
    ) THEN
        RAISE EXCEPTION 'Existing tenant boundary violation in teacher_subjects';
    END IF;
END;
$$;

CREATE TRIGGER "tenant_guard_student_parents"
BEFORE INSERT OR UPDATE OF "studentId", "parentId" ON "student_parents"
FOR EACH ROW EXECUTE FUNCTION "enforce_student_parent_school"();

CREATE TRIGGER "tenant_guard_teacher_subjects"
BEFORE INSERT OR UPDATE OF "teacherId", "subjectId" ON "teacher_subjects"
FOR EACH ROW EXECUTE FUNCTION "enforce_teacher_subject_school"();
