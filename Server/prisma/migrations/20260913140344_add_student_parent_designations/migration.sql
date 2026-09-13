/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `schools` will be added. If there are existing duplicate values, this will fail.
  - Made the column `contactName` on table `loan_providers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `loan_providers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `loan_providers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nationalIdNumber` on table `parents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `motto` on table `schools` required. This step will fail if there are existing NULL values in that column.
  - Made the column `vision` on table `schools` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mission` on table `schools` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `schools` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `schools` required. This step will fail if there are existing NULL values in that column.
  - Made the column `kraPin` on table `staff` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nssfNumber` on table `staff` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shaNumber` on table `staff` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nationalIdNumber` on table `staff` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `student_parents` table without a default value. This is not possible if the table is not empty.
  - Made the column `kraPin` on table `teachers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nssfNumber` on table `teachers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shaNumber` on table `teachers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nationalIdNumber` on table `teachers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "student_parents" DROP CONSTRAINT "student_parents_parentId_fkey";

-- DropForeignKey
ALTER TABLE "student_parents" DROP CONSTRAINT "student_parents_studentId_fkey";

-- AlterTable
ALTER TABLE "loan_providers" ALTER COLUMN "contactName" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "parents" ALTER COLUMN "nationalIdNumber" SET NOT NULL;

-- AlterTable
ALTER TABLE "staff" ALTER COLUMN "kraPin" SET NOT NULL,
ALTER COLUMN "nssfNumber" SET NOT NULL,
ALTER COLUMN "shaNumber" SET NOT NULL,
ALTER COLUMN "nationalIdNumber" SET NOT NULL;

-- AlterTable
ALTER TABLE "student_parents" ADD COLUMN     "canPickUp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isFinanciallyResponsible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "teachers" ALTER COLUMN "kraPin" SET NOT NULL,
ALTER COLUMN "nssfNumber" SET NOT NULL,
ALTER COLUMN "shaNumber" SET NOT NULL,
ALTER COLUMN "nationalIdNumber" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
