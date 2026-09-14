# Server API

This is the backend application for School SMIS. It exposes the API, enforces school-scoped access, and organizes business logic by feature module.

## Tech stack

- Node.js + Express
- PostgreSQL with Prisma ORM
- JWT-based authentication
- Vitest for validation and route checks
- Structured logging and audit hooks

## Project layout

- `src/api/` — routes and API middleware
- `src/config/` — environment, logger, database, and tenant setup
- `src/modules/` — domain modules such as auth, students, finance, payroll, and HR
- `src/shared/` — ownership checks, audit utilities, jobs, and shared helpers
- `prisma/schema/` — module-based Prisma schema split
- `prisma/migrations/` — Prisma migration history
- `test/` — validation, smoke, and integration tests

## Prisma schema structure

The monolithic schema was split into the following module files:

- `00-base.prisma` — shared enums, root models, and tenant scaffolding
- `01-auth.prisma` — users, teachers, staff, and auth/session entities
- `02-students.prisma` — students, parents, and enrollment models
- `03-academics.prisma` — years, terms, classes, streams, subjects, and timetable
- `04-attendance-exams-cbc.prisma` — attendance, exams, learning areas, and CBC assessments
- `05-finance.prisma` — fees, invoices, payments, refunds, and ledger entries
- `06-payroll-hr.prisma` — payroll, HR records, loans, leave, and contract data
- `07-file-jobs.prisma` — file uploads and background jobs

Prisma is configured to read the `prisma/schema` directory rather than a single `schema.prisma` file.

## Authorization model

The system should enforce this order:

1. Authentication
2. School context resolution
3. Permission authorization
4. Resource ownership validation
5. Prisma tenant scoping
6. PostgreSQL RLS where enabled

This is intentionally stronger than a role-only model. Permissions such as `students:read`, `fees:approve`, and `payroll:approve` should be checked explicitly at route and service boundaries.

## Common commands

```bash
npm install
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm test
npm run dev
```

## Security and tenancy notes

- Auth and OTP endpoints should be protected with IP and user-level throttling.
- School-scoped access must always be validated before mutating or reading tenant data.
- Ownership checks are separate from tenant checks and should remain explicit.
- Background jobs and impersonation actions should remain fully auditable.
