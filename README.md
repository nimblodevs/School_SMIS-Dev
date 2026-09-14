# School SMIS

School SMIS is a multi-tenant school management platform covering academics, admissions, finance, payroll, human resources, and operations.

## Repository structure

- `Client/` — frontend application
- `Server/` — backend API and service layer
- `Server/src/modules/` — feature modules and route-specific logic
- `Server/prisma/schema/` — split Prisma schema files by domain
- `Server/prisma/migrations/` — migration history

## Architecture overview

- Multi-tenant school model with `schoolId`-scoped records
- Request-scoped tenant context and ownership validation
- Permission-based authorization layered over role checks
- Prisma as the database access layer, with PostgreSQL RLS as an additional enforcement layer
- Split Prisma schema files for maintainability and ownership clarity

## Authorization stack

The intended enforcement order is:

1. Authentication
2. School context resolution
3. Permission authorization
4. Resource ownership validation
5. Prisma tenant scope enforcement
6. PostgreSQL RLS

Example permissions:

- `students:read`
- `students:create`
- `students:update`
- `fees:read`
- `fees:refund`
- `fees:approve`
- `payroll:read`
- `payroll:process`
- `payroll:approve`

## Server documentation

- [Server/README.md](Server/README.md)
- [Server/src/modules/academics/README.md](Server/src/modules/academics/README.md)
- [Server/src/modules/attendance/README.md](Server/src/modules/attendance/README.md)
- [Server/src/modules/audit/README.md](Server/src/modules/audit/README.md)
- [Server/src/modules/auth/README.md](Server/src/modules/auth/README.md)
- [Server/src/modules/cbc/README.md](Server/src/modules/cbc/README.md)
- [Server/src/modules/exams/README.md](Server/src/modules/exams/README.md)
- [Server/src/modules/finance/README.md](Server/src/modules/finance/README.md)
- [Server/src/modules/humanresource/README.md](Server/src/modules/humanresource/README.md)
- [Server/src/modules/jobs/README.md](Server/src/modules/jobs/README.md)
- [Server/src/modules/parents/README.md](Server/src/modules/parents/README.md)
- [Server/src/modules/payroll/README.md](Server/src/modules/payroll/README.md)
- [Server/src/modules/schools/README.md](Server/src/modules/schools/README.md)
- [Server/src/modules/storage/README.md](Server/src/modules/storage/README.md)
- [Server/src/modules/students/README.md](Server/src/modules/students/README.md)
- [Server/src/modules/users/README.md](Server/src/modules/users/README.md)

## Security notes

- Keep authentication and authorization independent.
- Treat Prisma tenant scoping as a guardrail, not a substitute for authorization.
- Use IP-level throttling and per-user lockout controls on all auth and OTP flows.
- Keep ownership checks explicit for parent, teacher, bursar, and payroll approval operations.
