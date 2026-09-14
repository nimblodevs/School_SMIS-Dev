# Schools Module

## Purpose
The schools module manages tenant-level school metadata, configuration, and school-wide setup for each organization in the platform.

## Responsibilities
- Create and manage school records and configuration
- Handle school-level settings, codes, and metadata
- Support admin and platform-level school lifecycle actions
- Maintain tenant isolation for school records and settings

## Database models owned
- `School`
- `SchoolSettings`
- `SystemSequence`
- `AdmissionSequence`

## API endpoints
- School creation, update, and lookup routes
- School settings and profile updates
- Admin and platform operator school management flows

## Authorization requirements
- Platform operators and designated administrators can manage schools
- School-scoped staff must not access other schools’ tenant data
- All reads and writes must pass the active tenant context or explicit platform-operator validation

## Transactions
- School creation and config updates should be atomic
- Sequence and admission-number updates should remain consistent across operations

## Events
- School created or updated
- School settings changed
- Sequence or school-code generated

## External integrations
- SSO or domain-based school associations
- Tenant onboarding and provisioning services
- Reporting and platform-level admin tooling
