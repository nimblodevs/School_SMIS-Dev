-- Finance sequence counters are scoped by school and calendar year.
DO $$
BEGIN
    CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "invoice_sequences" (
    "school_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next_val" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("school_id", "year"),
    CONSTRAINT "invoice_sequences_school_id_fkey"
        FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_sequences_year_check" CHECK ("year" BETWEEN 2000 AND 2100),
    CONSTRAINT "invoice_sequences_next_val_check" CHECK ("next_val" > 0)
);

CREATE TABLE "payslip_sequences" (
    "school_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next_val" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "payslip_sequences_pkey" PRIMARY KEY ("school_id", "year"),
    CONSTRAINT "payslip_sequences_school_id_fkey"
        FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payslip_sequences_year_check" CHECK ("year" BETWEEN 2000 AND 2100),
    CONSTRAINT "payslip_sequences_next_val_check" CHECK ("next_val" > 0)
);

CREATE TABLE "credit_note_sequences" (
    "school_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next_val" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "credit_note_sequences_pkey" PRIMARY KEY ("school_id", "year"),
    CONSTRAINT "credit_note_sequences_school_id_fkey"
        FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "credit_note_sequences_year_check" CHECK ("year" BETWEEN 2000 AND 2100),
    CONSTRAINT "credit_note_sequences_next_val_check" CHECK ("next_val" > 0)
);

CREATE TABLE "admission_sequences" (
    "school_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next_val" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "admission_sequences_pkey" PRIMARY KEY ("school_id", "year"),
    CONSTRAINT "admission_sequences_school_id_fkey"
        FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "admission_sequences_year_check" CHECK ("year" BETWEEN 2000 AND 2100),
    CONSTRAINT "admission_sequences_next_val_check" CHECK ("next_val" > 0)
);

CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "invoiceBalanceBefore" DECIMAL(12,2) NOT NULL,
    "invoiceBalanceAfter" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_allocations_paymentId_invoiceId_key" UNIQUE ("paymentId", "invoiceId"),
    CONSTRAINT "payment_allocations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "narration" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ledger_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Constraints applicable to the current finance and payroll schema.
ALTER TABLE "payments"
    ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "payment_allocations"
    ADD CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "salary_structures"
    ADD CONSTRAINT "salary_structures_base_salary_positive" CHECK ("baseSalary" > 0);

ALTER TABLE "allowance_types"
    ADD CONSTRAINT "allowance_types_job_group_consistency" CHECK (
        ("applicability" = 'JOB_GROUP' AND "jobGroupId" IS NOT NULL)
        OR ("applicability" <> 'JOB_GROUP' AND "jobGroupId" IS NULL)
    );

ALTER TABLE "statutory_rate_configs"
    ADD CONSTRAINT "statutory_rate_configs_valid" CHECK (
        "minSalary" >= 0
        AND "rate" >= 0
        AND "rate" <= 1
        AND ("maxSalary" IS NULL OR "maxSalary" > "minSalary")
    );

ALTER TABLE "leave_balances"
    ADD CONSTRAINT "leave_balances_valid" CHECK (
        "allocatedDays" >= 0
        AND "usedDays" >= 0
        AND "usedDays" <= "allocatedDays"
    );
