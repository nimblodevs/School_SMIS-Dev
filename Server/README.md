# School SMIS API

The Server project is the backend for the School SMIS platform. It exposes the application API, enforces tenant-aware access, and coordinates domain modules such as academics, attendance, finance, exams, payroll, HR, and storage.

## Architecture overview

- Express server with modular route registration
- Prisma ORM with PostgreSQL
- Request-scoped tenant context for multi-school isolation
- Module-based service structure under `src/modules`
- Shared utilities for audit, ownership, sequencing, and background jobs

## Project structure

- `src/` — application source code
- `src/api/` — router setup and middleware
- `src/config/` — environment, Prisma, tenant context, tracing, logger configuration
- `src/modules/` — business domain modules
- `src/shared/` — common utilities, ownership checks, audit helpers, jobs
- `prisma/` — Prisma schema, migrations, seed data, database tooling
- `test/` — validation and integration tests
- `.env` — local runtime configuration

## Module documentation

Each domain module has its own README with purpose, ownership, endpoints, authorization rules, and integration notes.

- [src/modules/academics/README.md](src/modules/academics/README.md)
- [src/modules/attendance/README.md](src/modules/attendance/README.md)
- [src/modules/audit/README.md](src/modules/audit/README.md)
- [src/modules/auth/README.md](src/modules/auth/README.md)
- [src/modules/cbc/README.md](src/modules/cbc/README.md)
- [src/modules/exams/README.md](src/modules/exams/README.md)
- [src/modules/finance/README.md](src/modules/finance/README.md)
- [src/modules/humanresource/README.md](src/modules/humanresource/README.md)
- [src/modules/jobs/README.md](src/modules/jobs/README.md)
- [src/modules/parents/README.md](src/modules/parents/README.md)
- [src/modules/payroll/README.md](src/modules/payroll/README.md)
- [src/modules/schools/README.md](src/modules/schools/README.md)
- [src/modules/storage/README.md](src/modules/storage/README.md)
- [src/modules/students/README.md](src/modules/students/README.md)
- [src/modules/users/README.md](src/modules/users/README.md)

## Environment setup

Create a `.env` file in this directory with the required runtime variables, for example:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
JWT_SECRET="your-secret-key"
```

Additional auth, email, storage, or integration variables may be required depending on the environment and deployed features.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

3. Validate the schema:

   ```bash
   npm run prisma:validate
   ```

4. Run database migrations:

   ```bash
   npm run prisma:migrate
   ```

5. Start the API in development mode:

   ```bash
   npm run dev
   ```

## Useful scripts

- `npm run start` — start the API in production mode
- `npm run dev` — start the API with nodemon in development mode
- `npm run lint` — run ESLint
- `npm run format` — format the codebase with Prettier
- `npm run format:check` — check formatting without writing files
- `npm run prisma:generate` — generate the Prisma client
- `npm run prisma:migrate` — apply local Prisma migrations
- `npm run prisma:deploy` — deploy pending migrations in production
- `npm run prisma:validate` — validate the Prisma schema
- `npm run prisma:push` — push schema changes directly to the database
- `npm run prisma:studio` — open Prisma Studio
- `npm run prisma:format` — format the Prisma schema
- `npm test` — run the server test suite

## Testing

The project includes Vitest-based verification for validation, smoke checks, and integration paths.

```bash
npm test
```

## Security and tenancy notes

The backend is designed for multi-tenant operation. School-scoped access is enforced through request context and Prisma tenant scoping rather than relying on ad hoc filters in individual handlers.

## License

MIT
