# Users Module

## Purpose
The users module manages employee and user provisioning workflows, including teacher and staff account creation and school-level user administration.

## Responsibilities
- Provision teacher and staff accounts for a school
- Maintain user identity and role metadata
- Support school admin user lifecycle operations
- Coordinate employee profile creation with user credential issuance

## Database models owned
- `User`
- `Teacher`
- `Staff`
- `EmployeeNumber`

## API endpoints
- Teacher creation routes
- Staff creation routes
- User-management flows for school administrators

## Authorization requirements
- Authenticated users only
- Admin or super-admin role required for management endpoints
- School-scoped operations must not cross tenant boundaries
- User provisioning should be restricted to the current school context

## Transactions
- Employee-user provisioning should be atomic to keep user and profile records consistent
- Sequence allocation and ownership assignment should be committed together

## Events
- Employee account created
- Credential delivery triggered
- User role or school assignment changed

## External integrations
- Email delivery for credentials and onboarding messages
- HR and payroll feeds derived from employee creation
- Identity and access lifecycle integrations
