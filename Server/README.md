# School SMIS API

School SMIS is a backend API for managing school operations, including academic records, fees, payroll, HR, staff management, and document uploads.

## Tech Stack

- Node.js
- Express
- Prisma ORM
- PostgreSQL
- JWT authentication
- Swagger API documentation

## Project Structure

- `server.js` - application entry point
- `src/` - source code for routes, controllers, services, and utilities
- `prisma/` - Prisma schema and migration files
- `.env` - environment configuration

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file and add your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
   ```

3. Generate the Prisma client:
   ```bash
   npm run prisma:generate
   ```

4. Validate the schema:
   ```bash
   npm run prisma:validate
   ```

5. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

6. Optionally load two isolated demo tenants:
   ```bash
   npm run prisma:seed
   ```

   The seed creates `demo-school` and `northstar-demo`. Use `admin` / `AdminDemo123!`
   for the first tenant, `northstar.admin` / `AdminDemo123!` for the second, or
   `superadmin` / `SuperAdmin123!` with the printed `x-school-id` value. These
   credentials are development fixtures only.

7. Start the server:
   ```bash
   npm run dev
   ```

## Useful Scripts

- `npm run start` - Start the API in production mode
- `npm run dev` - Start the API with nodemon for development
- `npm run lint` - Run ESLint
- `npm run format` - Format the codebase with Prettier
- `npm run format:check` - Check formatting without modifying files
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Apply Prisma migrations
- `npm run prisma:validate` - Validate Prisma schema
- `npm run prisma:push` - Push schema changes directly to the database
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:format` - Format the Prisma schema
- `npm test` - Placeholder until test suite is added

## Prisma Notes

This project uses Prisma with PostgreSQL and a JavaScript-based Prisma configuration.

## Tenant Isolation

Authenticated school users are always restricted to the school in their account. Platform
`SUPER_ADMIN` users must select an active tenant by sending its UUID in the `x-school-id`
header before using any tenant-owned module. They may omit the header only for platform-level
school administration and global audit-log access.

Tenant isolation is enforced in both the Prisma query extension and database relationship
triggers. Services must still validate that all user-supplied related IDs belong to the
effective school before writing, using the shared ownership helpers.

## License

MIT
