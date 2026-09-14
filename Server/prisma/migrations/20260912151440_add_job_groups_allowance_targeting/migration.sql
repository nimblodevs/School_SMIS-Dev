/*
  Warnings:

  - You are about to drop the column `otherAllowances` on the `salary_structures` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nssfNumber]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[kraPin]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shaNumber]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nssfNumber]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[kraPin]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shaNumber]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AllowanceApplicability" AS ENUM ('ALL_EMPLOYEES', 'TEACHERS', 'STAFF', 'JOB_GROUP');

-- AlterTable
ALTER TABLE "salary_structures" DROP COLUMN "otherAllowances",
ADD COLUMN     "allowanceTypeId" TEXT,
ADD COLUMN     "statutoryDeductionId" TEXT;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "jobGroupId" TEXT,
ADD COLUMN     "kraPin" TEXT,
ADD COLUMN     "nssfNumber" TEXT,
ADD COLUMN     "shaNumber" TEXT;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "jobGroupId" TEXT,
ADD COLUMN     "kraPin" TEXT,
ADD COLUMN     "nssfNumber" TEXT,
ADD COLUMN     "shaNumber" TEXT;

-- CreateTable
CREATE TABLE "job_groups" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffId" TEXT,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "accountHolderName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT,
    "swiftCode" TEXT,
    "routingNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "supportsWireTransfer" BOOLEAN NOT NULL DEFAULT true,
    "supportsBankTransfer" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowance_types" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "applicability" "AllowanceApplicability" NOT NULL DEFAULT 'ALL_EMPLOYEES',
    "jobGroupId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowance_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_deductions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_groups_schoolId_idx" ON "job_groups"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "job_groups_schoolId_code_key" ON "job_groups"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "job_groups_schoolId_name_key" ON "job_groups"("schoolId", "name");

-- CreateIndex
CREATE INDEX "bank_accounts_schoolId_idx" ON "bank_accounts"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_teacherId_accountNumber_key" ON "bank_accounts"("teacherId", "accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_staffId_accountNumber_key" ON "bank_accounts"("staffId", "accountNumber");

-- CreateIndex
CREATE INDEX "allowance_types_schoolId_idx" ON "allowance_types"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "allowance_types_schoolId_code_key" ON "allowance_types"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "allowance_types_schoolId_name_key" ON "allowance_types"("schoolId", "name");

-- CreateIndex
CREATE INDEX "statutory_deductions_schoolId_idx" ON "statutory_deductions"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_deductions_schoolId_code_key" ON "statutory_deductions"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_deductions_schoolId_name_key" ON "statutory_deductions"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_nssfNumber_key" ON "staff"("nssfNumber");

-- CreateIndex
CREATE UNIQUE INDEX "staff_kraPin_key" ON "staff"("kraPin");

-- CreateIndex
CREATE UNIQUE INDEX "staff_shaNumber_key" ON "staff"("shaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_nssfNumber_key" ON "teachers"("nssfNumber");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_kraPin_key" ON "teachers"("kraPin");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_shaNumber_key" ON "teachers"("shaNumber");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_jobGroupId_fkey" FOREIGN KEY ("jobGroupId") REFERENCES "job_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_jobGroupId_fkey" FOREIGN KEY ("jobGroupId") REFERENCES "job_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_groups" ADD CONSTRAINT "job_groups_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_types" ADD CONSTRAINT "allowance_types_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_types" ADD CONSTRAINT "allowance_types_jobGroupId_fkey" FOREIGN KEY ("jobGroupId") REFERENCES "job_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_deductions" ADD CONSTRAINT "statutory_deductions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_allowanceTypeId_fkey" FOREIGN KEY ("allowanceTypeId") REFERENCES "allowance_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_statutoryDeductionId_fkey" FOREIGN KEY ("statutoryDeductionId") REFERENCES "statutory_deductions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
