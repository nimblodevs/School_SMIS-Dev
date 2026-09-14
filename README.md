# School SMIS

School SMIS is a multi-tenant school management system with a client app and a server API.

## Repository structure

- `Client/` — frontend application
- `Server/` — backend API and application logic
- `Server/src/modules/` — feature modules, each with a module-level README

## Server overview

The backend is organized by domain module under `Server/src/modules`, including:

- `academics`
- `attendance`
- `audit`
- `auth`
- `cbc`
- `exams`
- `finance`
- `humanresource`
- `jobs`
- `parents`
- `payroll`
- `schools`
- `storage`
- `students`
- `users`

Each module contains a README describing:
- purpose
- responsibilities
- owned database models
- API endpoints
- authorization requirements
- transactions
- events
- external integrations

## Module index

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

## Getting started

See the server application documentation in:

- [Server/README.md](Server/README.md)
- module docs above

## Notes

The system is designed around tenant isolation, so school-scoped records are enforced through request context and Prisma tenant scoping in the server layer.

# Create a new orphan branch (no history)
git checkout --orphan temp_branch

# Stage all current files
git add -A

# Commit everything as a single new commit
git commit -m "Initial commit"

# Delete the old main branch
git branch -D main

# Rename temp_branch to main
git branch -m main

# Force push, overwriting remote history
git push -f origin main
