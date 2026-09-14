-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PARTIALLY_PAID', 'COMPLETED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "LoanRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanSourceType" AS ENUM ('SCHOOL', 'BANK', 'SACCO', 'OTHER');

-- CreateEnum
CREATE TYPE "ResignationStatus" AS ENUM ('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- AlterTable
ALTER TABLE "employment_contracts" ADD COLUMN     "documentId" TEXT;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "approvalNotes" TEXT,
ADD COLUMN     "attachmentId" TEXT,
ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "file_uploads" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "url" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_providers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LoanSourceType" NOT NULL DEFAULT 'BANK',
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_loan_requests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffId" TEXT,
    "requestType" "LoanSourceType" NOT NULL DEFAULT 'SCHOOL',
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "purpose" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "neededByDate" DATE,
    "status" "LoanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAmount" DECIMAL(12,2),
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "attachmentId" TEXT,
    "attachmentUrl" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "employee_loan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_loans" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffId" TEXT,
    "requestId" TEXT,
    "providerId" TEXT,
    "title" TEXT NOT NULL,
    "loanType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "monthlyDeduction" DECIMAL(12,2) NOT NULL,
    "interestRate" DECIMAL(5,2),
    "sourceType" "LoanSourceType" NOT NULL DEFAULT 'SCHOOL',
    "accountNumber" TEXT,
    "referenceNumber" TEXT,
    "reason" TEXT,
    "attachmentId" TEXT,
    "attachmentUrl" TEXT,
    "startDate" DATE NOT NULL,
    "dueDate" DATE,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salary_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "paymentMethod" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "attachmentId" TEXT,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resignation_records" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffId" TEXT,
    "resignationDate" DATE NOT NULL,
    "noticeDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ResignationStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "finalExitDate" DATE,
    "handoverNotes" TEXT,
    "attachmentId" TEXT,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resignation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_uploads_relatedType_relatedId_idx" ON "file_uploads"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "loan_providers_schoolId_idx" ON "loan_providers"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_providers_schoolId_name_key" ON "loan_providers"("schoolId", "name");

-- CreateIndex
CREATE INDEX "employee_loan_requests_schoolId_status_idx" ON "employee_loan_requests"("schoolId", "status");

-- CreateIndex
CREATE INDEX "employee_loan_requests_schoolId_teacherId_idx" ON "employee_loan_requests"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "employee_loan_requests_schoolId_staffId_idx" ON "employee_loan_requests"("schoolId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_salary_loans_requestId_key" ON "employee_salary_loans"("requestId");

-- CreateIndex
CREATE INDEX "employee_salary_loans_schoolId_status_idx" ON "employee_salary_loans"("schoolId", "status");

-- CreateIndex
CREATE INDEX "employee_salary_loans_schoolId_teacherId_idx" ON "employee_salary_loans"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "employee_salary_loans_schoolId_staffId_idx" ON "employee_salary_loans"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "loan_repayments_loanId_paymentDate_idx" ON "loan_repayments"("loanId", "paymentDate");

-- CreateIndex
CREATE INDEX "loan_repayments_schoolId_paymentDate_idx" ON "loan_repayments"("schoolId", "paymentDate");

-- CreateIndex
CREATE INDEX "resignation_records_schoolId_status_idx" ON "resignation_records"("schoolId", "status");

-- CreateIndex
CREATE INDEX "resignation_records_schoolId_teacherId_idx" ON "resignation_records"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "resignation_records_schoolId_staffId_idx" ON "resignation_records"("schoolId", "staffId");

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_providers" ADD CONSTRAINT "loan_providers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loan_requests" ADD CONSTRAINT "employee_loan_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loan_requests" ADD CONSTRAINT "employee_loan_requests_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loan_requests" ADD CONSTRAINT "employee_loan_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_loans" ADD CONSTRAINT "employee_salary_loans_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_loans" ADD CONSTRAINT "employee_salary_loans_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_loans" ADD CONSTRAINT "employee_salary_loans_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_loans" ADD CONSTRAINT "employee_salary_loans_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "employee_loan_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_loans" ADD CONSTRAINT "employee_salary_loans_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "loan_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "employee_salary_loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resignation_records" ADD CONSTRAINT "resignation_records_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resignation_records" ADD CONSTRAINT "resignation_records_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resignation_records" ADD CONSTRAINT "resignation_records_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resignation_records" ADD CONSTRAINT "resignation_records_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resignation_records" ADD CONSTRAINT "resignation_records_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
