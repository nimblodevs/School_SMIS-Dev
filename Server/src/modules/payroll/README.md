# Payroll Module

## Purpose
The payroll module calculates school payroll runs, generates payslips, applies statutory and loan deductions, and records payroll processing outcomes for a specific school and payroll period.

## Responsibilities
- Build payroll runs per year and month
- Aggregate employee earnings, deductions, and net pay
- Generate payslips for teacher and staff employees
- Track payroll status and accounting consequences
- Enforce per-school and per-employee payroll boundaries

## Database models owned
- `PayrollRun`
- `Payslip`
- `SalaryStructure`
- `StatutoryDeduction`
- `StatutoryRateConfig`
- `CustomDeduction`
- `BankAccount`
- `EmploymentContract`
- `LoanProvider`
- `EmployeeLoanRequest`
- `EmployeeSalaryLoan`
- `LoanRepayment`
- `AllowanceType`
- `LeaveType`
- `LeaveBalance`
- `LeaveRequest`
- `ResignationRecord`

## API endpoints
The payroll routes expose the job orchestration required to execute payroll runs and related operational actions. The route layer requires authenticated access and module authorization for payroll features.

Typical flows include:
- payroll run execution
- payslip generation and retrieval
- compensation and deduction queries
- employee payroll records and summaries

## Authorization requirements
- Authenticated session required
- Module access via the `PAYROLL` module permissions and/or role-based access
- School-scoped enforcement is mandatory
- Non-admin users should only view payroll data belonging to their own employee profile or the specific school they are authorized to access

## Transactions
- Payroll run execution should be transactional to avoid partially generated payslips
- Replacement of payslips for a rerun must be atomic
- Deduction, loan, and leave-balance updates must be committed together so the payroll ledger remains consistent

## Events
- Payroll run created
- Payroll run executed
- Payslip generated
- Loan deduction applied
- Statutory deduction processed
- Payroll failure or retry events

## External integrations
- Salary export and reporting integrations
- Banking/third-party salary transfers
- Notification services for payslip availability or payroll status
- Leave and HR data feeds used during payroll calculation
