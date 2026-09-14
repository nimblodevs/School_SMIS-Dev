# Human Resource Module

## Purpose
The human resource module manages staff and teacher records, leave workflows, employment data, and related lifecycle actions for a school.

## Responsibilities
- Maintain teacher and staff profiles and identity metadata
- Track leave balances, leave requests, and approvals
- Support resignation and employment lifecycle operations
- Coordinate employee numbers and employment contracts

## Database models owned
- `EmployeeNumber`
- `Teacher`
- `Staff`
- `EmploymentContract`
- `LeaveType`
- `LeaveBalance`
- `LeaveRequest`
- `ResignationRecord`
- `JobGroup`

## API endpoints
- HR staffing and employee management endpoints
- Leave request and approval routes
- Resignation and employment lifecycle actions

## Authorization requirements
- Authenticated users only
- Role/module access must be enforced for HR operations
- School-scoped restrictions apply to employee and leave records
- Employees should normally see only their own leave and employment-related data

## Transactions
- Leave approval and balance deduction should be atomic
- Resignation workflows should commit state changes together
- Employee profile updates should avoid partial profile mismatches

## Events
- Leave requested or approved
- Resignation recorded
- Employee profile created or updated
- Payroll-eligible staffing events

## External integrations
- Payroll and salary processing data feeds
- HR reporting systems
- Notifications for leave approvals and resignation events
