ALTER TABLE "teachers" DROP CONSTRAINT "teachers_employeeKey_fkey";
ALTER TABLE "staff" DROP CONSTRAINT "staff_employeeKey_fkey";

UPDATE "employee_numbers" AS employee_number
SET "ownerKey" = 'T:' || teacher."id"
FROM "teachers" AS teacher
WHERE teacher."employeeKey" = employee_number."ownerKey";

UPDATE "employee_numbers" AS employee_number
SET "ownerKey" = 'S:' || staff."id"
FROM "staff" AS staff
WHERE staff."employeeKey" = employee_number."ownerKey";

UPDATE "teachers" AS teacher
SET "employeeKey" = 'T:' || teacher."id";

UPDATE "staff" AS staff
SET "employeeKey" = 'S:' || staff."id";

ALTER TABLE "teachers"
  ADD CONSTRAINT "teachers_employeeKey_fkey"
  FOREIGN KEY ("employeeKey") REFERENCES "employee_numbers"("ownerKey") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff"
  ADD CONSTRAINT "staff_employeeKey_fkey"
  FOREIGN KEY ("employeeKey") REFERENCES "employee_numbers"("ownerKey") ON DELETE RESTRICT ON UPDATE CASCADE;