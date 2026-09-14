# Payroll Module

## Purpose
The payroll module manages payroll runs, payslips, deductions, leave, and compensation processing for each school.

## Key models
- `PayrollRun`
- `Payslip`
- `SalaryStructure`
- `AllowanceType`
- `StatutoryDeduction`
- `StatutoryRateConfig`
- `CustomDeduction`
- `EmploymentContract`
- `LeaveBalance`
- `LeaveRequest`

## Responsibilities
- Build payroll periods and calculate employee net pay
- Generate payslips and keep payroll status history
- Support deduction, leave, and compensation workflows
- Track approval and processing milestones

## Authorization
- Route access should use explicit permissions like `payroll:read`, `payroll:process`, and `payroll:approve`
- Approval should be handled separately from execution to maintain clear policy boundaries
- Reads and updates must respect school and employee ownership constraints

## Operational notes
- Payroll execution should be atomic to avoid partial payslip generation
- Leave and loan-related payroll adjustments should be committed in the same transaction as the run results
