ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CARD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_ALLOCATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_REFUNDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVOICE_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_PROCESSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVITE';

CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'REVERSED');
CREATE TYPE "CreditNoteStatus" AS ENUM ('ISSUED', 'PARTIALLY_APPLIED', 'APPLIED', 'REFUNDED', 'VOIDED');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "CreditNoteReason" AS ENUM ('OVERPAYMENT', 'REFUND', 'REVERSAL', 'ADJUSTMENT', 'WRONG_INVOICE', 'DUPLICATE', 'CHARGEBACK');

ALTER TABLE "payment_allocations"
    ADD COLUMN "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "reversedAt" TIMESTAMP(3),
    ADD COLUMN "reversedBy" TEXT,
    ADD COLUMN "reversalReason" TEXT,
    ADD COLUMN "createdById" TEXT;

CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "creditNo" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" "CreditNoteReason" NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_notes_creditNo_key" UNIQUE ("creditNo"),
    CONSTRAINT "credit_notes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "credit_note_applications" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "invoiceBalanceBefore" DECIMAL(12,2) NOT NULL,
    "invoiceBalanceAfter" DECIMAL(12,2) NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_note_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_note_applications_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "credit_note_applications_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "credit_note_applications_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "credit_note_applications_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "credit_note_applications_balance_math" CHECK ("invoiceBalanceBefore" - "amount" = "invoiceBalanceAfter"),
    CONSTRAINT "credit_note_applications_balance_nonnegative" CHECK ("invoiceBalanceAfter" >= 0)
);

CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "creditNoteId" TEXT,
    "paymentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "failureReason" TEXT,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_refunds_creditNoteId_key" UNIQUE ("creditNoteId"),
    CONSTRAINT "payment_refunds_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_refunds_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payment_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_refunds_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_refunds_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_keys_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "idempotency_keys_schoolId_scope_key_key" UNIQUE ("schoolId", "scope", "key")
);

CREATE INDEX "payment_allocations_invoiceId_status_idx" ON "payment_allocations" ("invoiceId", "status");
CREATE INDEX "payment_allocations_paymentId_status_idx" ON "payment_allocations" ("paymentId", "status");
CREATE INDEX "credit_notes_schoolId_studentId_status_idx" ON "credit_notes" ("schoolId", "studentId", "status");
CREATE INDEX "credit_note_applications_creditNoteId_status_idx" ON "credit_note_applications" ("creditNoteId", "status");
CREATE INDEX "credit_note_applications_invoiceId_status_idx" ON "credit_note_applications" ("invoiceId", "status");
CREATE INDEX "payment_refunds_schoolId_status_idx" ON "payment_refunds" ("schoolId", "status");
CREATE INDEX "payment_refunds_studentId_status_idx" ON "payment_refunds" ("studentId", "status");
CREATE INDEX "idempotency_keys_createdAt_idx" ON "idempotency_keys" ("createdAt");