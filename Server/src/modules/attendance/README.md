# Attendance Module

## Purpose
The attendance module records student attendance, validates status changes, and exposes attendance summaries for school operations.

## Responsibilities
- Record attendance by student, date, and school context
- Enforce policy around present/absent/late statuses
- Surface daily or period-based attendance summaries
- Support teacher and admin workflows for classroom tracking

## Database models owned
- `Attendance`

## API endpoints
- Attendance mark/create flows
- Attendance retrieval and summaries
- Period and date-specific attendance queries

## Authorization requirements
- Authenticated access required
- Module access through `ATTENDANCE` and / or role-based authority
- School-scoped enforcement is mandatory
- Staff and teachers should only access attendance for their assigned school

## Transactions
- Attendance updates should be atomic per record and daily summary
- Bulk attendance operations should be committed as a single transaction when possible

## Events
- Attendance recorded
- Attendance corrected or updated
- Daily attendance summary generated

## External integrations
- Parent notification services
- Reporting exports and compliance dashboards
- SMS or email absence alerts
