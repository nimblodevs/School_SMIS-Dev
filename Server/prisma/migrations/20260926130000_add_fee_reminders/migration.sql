CREATE TYPE "FeeReminderProvider" AS ENUM ('GMAIL', 'OUTLOOK');
CREATE TYPE "FeeReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "fee_reminders" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "batchId" TEXT,
    "recipientEmail" TEXT,
    "provider" "FeeReminderProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeeReminderStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "senderId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_reminders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fee_reminders_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fee_reminders_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fee_reminders_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "fee_reminders_schoolId_batchId_status_idx" ON "fee_reminders"("schoolId", "batchId", "status");
CREATE INDEX "fee_reminders_schoolId_invoiceId_createdAt_idx" ON "fee_reminders"("schoolId", "invoiceId", "createdAt");

CREATE OR REPLACE FUNCTION "enforce_fee_reminder_invoice_school"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    invoice_school_id TEXT;
BEGIN
    SELECT "schoolId" INTO invoice_school_id
    FROM "invoices"
    WHERE "id" = NEW."invoiceId";

    IF invoice_school_id IS NULL OR invoice_school_id <> NEW."schoolId" THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Tenant boundary violation: fee reminder invoice must belong to the same school';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "fee_reminders_invoice_school_guard"
BEFORE INSERT OR UPDATE OF "invoiceId", "schoolId" ON "fee_reminders"
FOR EACH ROW EXECUTE FUNCTION "enforce_fee_reminder_invoice_school"();