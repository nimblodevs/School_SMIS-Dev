-- Add composite parent keys so a foreign key cannot cross school boundaries.
CREATE UNIQUE INDEX "academic_years_id_schoolId_key" ON "academic_years"("id", "schoolId");
CREATE UNIQUE INDEX "terms_id_schoolId_key" ON "terms"("id", "schoolId");
CREATE UNIQUE INDEX "students_id_schoolId_key" ON "students"("id", "schoolId");
CREATE UNIQUE INDEX "streams_id_schoolId_key" ON "streams"("id", "schoolId");
CREATE UNIQUE INDEX "enrollments_id_schoolId_key" ON "enrollments"("id", "schoolId");
CREATE UNIQUE INDEX "teachers_id_schoolId_key" ON "teachers"("id", "schoolId");
CREATE UNIQUE INDEX "class_subjects_id_schoolId_key" ON "class_subjects"("id", "schoolId");
CREATE UNIQUE INDEX "attendance_id_schoolId_key" ON "attendance"("id", "schoolId");
CREATE UNIQUE INDEX "exams_id_schoolId_key" ON "exams"("id", "schoolId");
CREATE UNIQUE INDEX "exam_results_id_schoolId_key" ON "exam_results"("id", "schoolId");
CREATE UNIQUE INDEX "invoices_id_schoolId_key" ON "invoices"("id", "schoolId");
CREATE UNIQUE INDEX "payments_id_schoolId_key" ON "payments"("id", "schoolId");

ALTER TABLE "terms" ADD CONSTRAINT "terms_academicYear_school_ownership_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId");
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_student_school_ownership_fkey"
    FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"("id", "schoolId"),
  ADD CONSTRAINT "enrollments_stream_school_ownership_fkey"
    FOREIGN KEY ("streamId", "schoolId") REFERENCES "streams"("id", "schoolId"),
  ADD CONSTRAINT "enrollments_academicYear_school_ownership_fkey"
    FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId");
ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_student_school_ownership_fkey"
    FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"("id", "schoolId"),
  ADD CONSTRAINT "attendance_enrollment_school_ownership_fkey"
    FOREIGN KEY ("enrollmentId", "schoolId") REFERENCES "enrollments"("id", "schoolId");
ALTER TABLE "exam_results"
  ADD CONSTRAINT "exam_results_student_school_ownership_fkey"
    FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"("id", "schoolId"),
  ADD CONSTRAINT "exam_results_exam_school_ownership_fkey"
    FOREIGN KEY ("examId", "schoolId") REFERENCES "exams"("id", "schoolId"),
  ADD CONSTRAINT "exam_results_enrollment_school_ownership_fkey"
    FOREIGN KEY ("enrollmentId", "schoolId") REFERENCES "enrollments"("id", "schoolId");
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_student_school_ownership_fkey"
    FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"("id", "schoolId"),
  ADD CONSTRAINT "invoices_enrollment_school_ownership_fkey"
    FOREIGN KEY ("enrollmentId", "schoolId") REFERENCES "enrollments"("id", "schoolId"),
  ADD CONSTRAINT "invoices_term_school_ownership_fkey"
    FOREIGN KEY ("termId", "schoolId") REFERENCES "terms"("id", "schoolId");
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_student_school_ownership_fkey"
    FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"("id", "schoolId"),
  ADD CONSTRAINT "payments_invoice_school_ownership_fkey"
    FOREIGN KEY ("invoiceId", "schoolId") REFERENCES "invoices"("id", "schoolId");
ALTER TABLE "class_subjects"
  ADD CONSTRAINT "class_subjects_stream_school_ownership_fkey"
    FOREIGN KEY ("streamId", "schoolId") REFERENCES "streams"("id", "schoolId"),
  ADD CONSTRAINT "class_subjects_teacher_school_ownership_fkey"
    FOREIGN KEY ("teacherId", "schoolId") REFERENCES "teachers"("id", "schoolId");
