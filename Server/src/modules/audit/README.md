# Audit Module

## Purpose
The audit module centralizes audit-log retrieval and event visibility for operational accountability and compliance review.

## Responsibilities
- Collect and expose system actions tied to authenticated actors
- Support school-scoped audit review and admin oversight
- Surface security and user action history in a consistent format

## Database models owned
- `AuditLog`

## API endpoints
- Audit log listing and retrieval
- Tenant-scoped event review endpoints

## Authorization requirements
- Authenticated users only
- Access limited to administrators and platform operators as required by the route guard
- All reads must be constrained to the current school

## Transactions
- Audit writes are append-only and should not be rolled back as part of normal business transactions
- Log persistence should happen in a way that preserves traceability even when business actions fail

## Events
- Login and logout activity
- User and role actions
- Payroll, finance, and school operations
- Security and impersonation events

## External integrations
- SIEM or compliance export pipelines
- Security dashboards and operational monitoring systems
