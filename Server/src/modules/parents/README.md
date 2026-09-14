# Parents Module

## Purpose
The parents module manages parent profiles, parent-child relationships, parent activation workflows, and parent access lifecycle for student support processes.

## Responsibilities
- Maintain parent identity and contact data
- Link parents to students and household relationships
- Provision portal access when required
- Support parent activation and identity verification

## Database models owned
- `Parent`
- `StudentParent`
- `ActivationToken`

## API endpoints
- Parent create, list, and update routes
- Student-parent relationship endpoints
- Parent activation and portal-account support routes

## Authorization requirements
- Authenticated access required
- Parent access should be limited to their own profile and associated student records
- School-scoped data access is mandatory for school staff operations

## Transactions
- Parent creation and portal provisioning should be committed atomically
- Household relationship updates should be transactional to avoid orphaned links

## Events
- Parent profile created
- Parent activation email or SMS sent
- Parent linked or unlinked to a student

## External integrations
- Parent portal account creation
- Email/SMS activation flows
- Student and household reporting integrations
