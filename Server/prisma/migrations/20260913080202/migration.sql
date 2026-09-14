/*
  Warnings:

  - The values [FIXED_TERM,INTERNSHIP,CONSULTANT] on the enum `ContractType` will be removed. If these variants are still used in the database, this will fail.
  - The values [REVIEWED] on the enum `ResignationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `isActive` on the `allowance_types` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `custom_deductions` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `custom_deductions` table. All the data in the column will be lost.
  - You are about to drop the column `contractType` on the `employment_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `documentId` on the `employment_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `documentUrl` on the `employment_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `employment_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `employment_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `daysAllocated` on the `leave_balances` table. All the data in the column will be lost.
  - You are about to drop the column `daysUsed` on the `leave_balances` table. All the data in the column will be lost.
  - You are about to drop the column `approvalNotes` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentId` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentUrl` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `daysRequested` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `decidedAt` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `rejectionReason` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `defaultDaysPerYear` on the `leave_types` table. All the data in the column will be lost.
  - The `status` column on the `payroll_runs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `basicSalary` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `houseAllowance` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `housingLevy` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `nssf` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `otherAllowances` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `otherDeductions` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `paye` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `salaryStructureId` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `shif` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `transportAllowance` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentId` on the `resignation_records` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentUrl` on the `resignation_records` table. All the data in the column will be lost.
  - You are about to drop the column `details` on the `resignation_records` table. All the data in the column will be lost.
  - You are about to drop the column `finalExitDate` on the `resignation_records` table. All the data in the column will be lost.
  - You are about to drop the column `handoverNotes` on the `resignation_records` table. All the data in the column will be lost.
  - You are about to drop the column `resignationDate` on the `resignation_records` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedAt` on the `resignation_records` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `resignation_records` table. All the data in the column will be lost.
  - You are about to drop the column `basicSalary` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `exemptHousingLevy` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `exemptNssf` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `exemptPaye` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `exemptShif` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `houseAllowance` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `statutoryDeductionId` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `transportAllowance` on the `salary_structures` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `effectiveDate` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `housingLevyRate` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `nssfRate` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `nssfTierIILimit` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `nssfTierILimit` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `payeBands` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `payeMonthlyRelief` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `shifMinimum` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `shifRate` on the `statutory_rate_configs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[leaveTypeId,employeeKey,year]` on the table `leave_balances` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount` to the `allowance_types` table without a default value. This is not possible if the table is not empty.
  - Added the required column `effectiveDate` to the `custom_deductions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `employment_contracts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `allocatedDays` to the `leave_balances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `daysAllowedPerYear` to the `leave_types` table without a default value. This is not possible if the table is not empty.
  - Added the required column `basicPay` to the `payslips` table without a default value. This is not possible if the table is not empty.
  - Added the required column `effectiveDate` to the `resignation_records` table without a default value. This is not possible if the table is not empty.
  - Made the column `initiatedById` on table `resignation_records` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `baseSalary` to the `salary_structures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deductionId` to the `statutory_rate_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `effectiveFrom` to the `statutory_rate_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minSalary` to the `statutory_rate_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rate` to the `statutory_rate_configs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PROCESSING', 'APPROVED', 'PAID');

-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "payslips" DROP CONSTRAINT "payslips_salaryStructureId_fkey";

-- DropForeignKey
ALTER TABLE "resignation_records" DROP CONSTRAINT "resignation_records_initiatedById_fkey";

-- DropForeignKey
ALTER TABLE "salary_structures" DROP CONSTRAINT "salary_structures_statutoryDeductionId_fkey";

-- DropIndex
DROP INDEX "allowance_types_schoolId_name_key";

-- DropIndex
DROP INDEX "leave_balances_employeeKey_leaveTypeId_year_key";

-- DropIndex
DROP INDEX "resignation_records_schoolId_staffId_idx";

-- DropIndex
DROP INDEX "resignation_records_schoolId_status_idx";

-- DropIndex
DROP INDEX "resignation_records_schoolId_teacherId_idx";

-- DropIndex
DROP INDEX "statutory_deductions_schoolId_name_key";

-- AlterTable
ALTER TABLE "allowance_types" DROP COLUMN "isActive",
ADD COLUMN     "amount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "isTaxable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "custom_deductions" DROP COLUMN "createdAt",
DROP COLUMN "isActive",
ADD COLUMN     "effectiveDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "employment_contracts" DROP COLUMN "contractType",
DROP COLUMN "documentId",
DROP COLUMN "documentUrl",
DROP COLUMN "notes",
DROP COLUMN "status",
ADD COLUMN     "termsDoc" TEXT;

-- AlterEnum
BEGIN;
CREATE TYPE "ContractType_new" AS ENUM ('PERMANENT', 'CONTRACT', 'FIXED_TERM', 'CASUAL', 'INTERNSHIP');
ALTER TYPE "ContractType" RENAME TO "ContractType_old";
ALTER TYPE "ContractType_new" RENAME TO "ContractType";
DROP TYPE "public"."ContractType_old";
COMMIT;

-- Add the contract type after replacing the old enum and dropping contractType.
ALTER TABLE "employment_contracts"
ADD COLUMN     "type" "ContractType" NOT NULL;

-- AlterTable
ALTER TABLE "leave_balances" DROP COLUMN "daysAllocated",
DROP COLUMN "daysUsed",
ADD COLUMN     "allocatedDays" INTEGER NOT NULL,
ADD COLUMN     "usedDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "leave_requests" DROP COLUMN "approvalNotes",
DROP COLUMN "attachmentId",
DROP COLUMN "attachmentUrl",
DROP COLUMN "daysRequested",
DROP COLUMN "decidedAt",
DROP COLUMN "rejectionReason",
ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "leave_types" DROP COLUMN "defaultDaysPerYear",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "daysAllowedPerYear" INTEGER NOT NULL,
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "payslips" DROP COLUMN "basicSalary",
DROP COLUMN "houseAllowance",
DROP COLUMN "housingLevy",
DROP COLUMN "nssf",
DROP COLUMN "otherAllowances",
DROP COLUMN "otherDeductions",
DROP COLUMN "paidAt",
DROP COLUMN "paye",
DROP COLUMN "paymentMethod",
DROP COLUMN "salaryStructureId",
DROP COLUMN "shif",
DROP COLUMN "status",
DROP COLUMN "transportAllowance",
ADD COLUMN     "basicPay" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "resignation_records" DROP COLUMN "attachmentId",
DROP COLUMN "attachmentUrl",
DROP COLUMN "details",
DROP COLUMN "finalExitDate",
DROP COLUMN "handoverNotes",
DROP COLUMN "resignationDate",
DROP COLUMN "reviewedAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "effectiveDate" DATE NOT NULL,
ADD COLUMN     "exitInterview" TEXT,
ALTER COLUMN "reason" DROP NOT NULL,
ALTER COLUMN "initiatedById" SET NOT NULL;

-- AlterTable
ALTER TABLE "salary_structures" DROP COLUMN "basicSalary",
DROP COLUMN "exemptHousingLevy",
DROP COLUMN "exemptNssf",
DROP COLUMN "exemptPaye",
DROP COLUMN "exemptShif",
DROP COLUMN "houseAllowance",
DROP COLUMN "isActive",
DROP COLUMN "statutoryDeductionId",
DROP COLUMN "transportAllowance",
ADD COLUMN     "baseSalary" DECIMAL(12,2) NOT NULL,
ALTER COLUMN "effectiveDate" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "statutory_rate_configs" DROP COLUMN "createdAt",
DROP COLUMN "effectiveDate",
DROP COLUMN "housingLevyRate",
DROP COLUMN "isActive",
DROP COLUMN "nssfRate",
DROP COLUMN "nssfTierIILimit",
DROP COLUMN "nssfTierILimit",
DROP COLUMN "payeBands",
DROP COLUMN "payeMonthlyRelief",
DROP COLUMN "shifMinimum",
DROP COLUMN "shifRate",
ADD COLUMN     "deductionId" TEXT NOT NULL,
ADD COLUMN     "effectiveFrom" DATE NOT NULL,
ADD COLUMN     "effectiveTo" DATE,
ADD COLUMN     "fixedAmount" DECIMAL(12,2),
ADD COLUMN     "maxSalary" DECIMAL(12,2),
ADD COLUMN     "minSalary" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "rate" DECIMAL(5,4) NOT NULL;

-- DropEnum
DROP TYPE "ContractStatus";

-- DropEnum
DROP TYPE "PayrollRunStatus";

-- DropEnum
DROP TYPE "PayslipPaymentMethod";

-- DropEnum
DROP TYPE "PayslipStatus";

-- CreateIndex
CREATE INDEX "custom_deductions_teacherId_idx" ON "custom_deductions"("teacherId");

-- CreateIndex
CREATE INDEX "custom_deductions_staffId_idx" ON "custom_deductions"("staffId");

-- CreateIndex
CREATE INDEX "employment_contracts_teacherId_idx" ON "employment_contracts"("teacherId");

-- CreateIndex
CREATE INDEX "employment_contracts_staffId_idx" ON "employment_contracts"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_leaveTypeId_employeeKey_year_key" ON "leave_balances"("leaveTypeId", "employeeKey", "year");

-- CreateIndex
CREATE INDEX "leave_requests_teacherId_idx" ON "leave_requests"("teacherId");

-- CreateIndex
CREATE INDEX "leave_requests_staffId_idx" ON "leave_requests"("staffId");

-- CreateIndex
CREATE INDEX "resignation_records_schoolId_idx" ON "resignation_records"("schoolId");

-- CreateIndex
CREATE INDEX "resignation_records_teacherId_idx" ON "resignation_records"("teacherId");

-- CreateIndex
CREATE INDEX "resignation_records_staffId_idx" ON "resignation_records"("staffId");

-- CreateIndex
CREATE INDEX "salary_structures_teacherId_idx" ON "salary_structures"("teacherId");

-- CreateIndex
CREATE INDEX "salary_structures_staffId_idx" ON "salary_structures"("staffId");

-- CreateIndex
CREATE INDEX "statutory_rate_configs_deductionId_idx" ON "statutory_rate_configs"("deductionId");

-- AddForeignKey
ALTER TABLE "statutory_rate_configs" ADD CONSTRAINT "statutory_rate_configs_deductionId_fkey" FOREIGN KEY ("deductionId") REFERENCES "statutory_deductions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resignation_records" ADD CONSTRAINT "resignation_records_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
