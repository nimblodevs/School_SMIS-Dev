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
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_RSA_KEY\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nYOUR_PUBLIC_RSA_KEY\n-----END PUBLIC KEY-----"
JWT_EXPIRES_IN="10m"
JWT_ISSUER="school-smis-api"
JWT_AUDIENCE="school-smis-client"
```

Additional auth, email, storage, or integration variables may be required depending on the environment and deployed features. Generate an RSA key pair with `openssl genrsa -out jwt-private.pem 2048` and `openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem`, then provide the PEM contents through the two JWT variables.

Authentication is throttled at multiple layers: IP, email identifier, user, OTP challenge attempts, and OTP resend requests. The defaults allow 5 failed password attempts per account, 10 OTP attempts per challenge, and 3 OTP resends per user and IP within 10 minutes.

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

4. Run database migrations in development:

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
- `npm run prisma:push:local` — push schema changes directly to a local development database; never use this against staging or production
- `npm run prisma:studio` — open Prisma Studio
- `npm run prisma:format` — format the Prisma schema
- `npm test` — run the server test suite

## Testing

The project includes Vitest-based verification for validation, smoke checks, and integration paths.

```bash
npm test
```

## Database change policy

- Development: `npm run prisma:migrate`
- CI and production: `npm run prisma:deploy`
- Local prototyping only: `npm run prisma:push:local`

Production databases must be changed through reviewed Prisma migrations. Do not run `prisma db push` against production.

## Security and tenancy notes

The backend is designed for multi-tenant operation. School-scoped access is enforced through request context, Prisma tenant scoping, and database-level cross-school ownership triggers. National and employee identity identifiers are scoped to a school with composite unique constraints.

PostgreSQL Row Level Security is planned as an additional enforcement layer. It should be enabled together with a request transaction wrapper that executes `SET LOCAL app.current_school_id` on the same database connection; enabling policies before that plumbing exists would block valid requests or create unsafe pooled-connection state.

Access tokens use `RS256`: the API signs with `JWT_PRIVATE_KEY`, while API services verify with `JWT_PUBLIC_KEY`. Keep the private key only in the signing service and distribute the public key to verification-only services. In production, both keys are required.

## License

MIT
