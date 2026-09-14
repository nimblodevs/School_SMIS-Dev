import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const describeWithDatabase = integrationDatabaseUrl ? describe : describe.skip;

describeWithDatabase('multi-tenancy database policy', () => {
    let prisma;
    let tenantContext;
    let FinanceService;
    let request;
    let app;
    let superToken;
    let adminToken;
    const ids = {
        schoolA: randomUUID(),
        schoolB: randomUUID(),
        userA: randomUUID(),
        superUser: randomUUID(),
        adminSession: randomUUID(),
        superSession: randomUUID(),
        studentA: randomUUID(),
        studentB: randomUUID(),
        parentB: randomUUID(),
    };
    const suffix = randomUUID();
    const firstSchoolCode = 10000 + (Number.parseInt(suffix.slice(0, 8), 16) % 89998);

    beforeAll(async () => {
        process.env.DATABASE_URL = integrationDatabaseUrl;
        process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters';
        process.env.NODE_ENV = 'test';

        ({ prisma } = await import('../src/config/prisma.js'));
        ({ tenantContext } = await import('../src/config/tenant-context.js'));
        ({ FinanceService } = await import('../src/modules/finance/finance.service.js'));
        const { AuthService } = await import('../src/modules/auth/auth.service.js');
        ({ app } = await import('../src/app.js'));
        ({ default: request } = await import('supertest'));

        await prisma.school.createMany({
            data: [
                {
                    id: ids.schoolA,
                    name: 'Tenant policy school A',
                    slug: `tenant-a-${suffix}`,
                    schoolCode: String(firstSchoolCode),
                    motto: 'Learn',
                    vision: 'Grow',
                    mission: 'Teach',
                    phone: `+2547${suffix.replaceAll('-', '').slice(0, 8)}`,
                    email: `tenant-a-${suffix}@example.test`,
                },
                {
                    id: ids.schoolB,
                    name: 'Tenant policy school B',
                    slug: `tenant-b-${suffix}`,
                    schoolCode: String(firstSchoolCode + 1),
                    motto: 'Learn',
                    vision: 'Grow',
                    mission: 'Teach',
                    phone: `+2547${suffix.replaceAll('-', '').slice(8, 16)}`,
                    email: `tenant-b-${suffix}@example.test`,
                },
            ],
        });

        await prisma.user.create({
            data: {
                id: ids.userA,
                username: `tenant-admin-${suffix}`,
                email: `tenant-admin-${suffix}@example.test`,
                phone: `+2547${suffix.replaceAll('-', '').slice(16, 24)}`,
                passwordHash: 'not-used-by-this-test',
                mustChangePassword: false,
                role: 'ADMIN',
                schoolId: ids.schoolA,
                currentSessionId: ids.adminSession,
            },
        });
        await prisma.user.create({
            data: {
                id: ids.superUser,
                username: `platform-admin-${suffix}`,
                email: `platform-admin-${suffix}@example.test`,
                phone: `+2547${suffix.replaceAll('-', '').slice(4, 12)}`,
                passwordHash: 'not-used-by-this-test',
                mustChangePassword: false,
                role: 'SUPER_ADMIN',
                currentSessionId: ids.superSession,
            },
        });
        superToken = AuthService.signAccessToken(
            { id: ids.superUser, email: `platform-admin-${suffix}@example.test`, role: 'SUPER_ADMIN', schoolId: null },
            ids.superSession,
        );
        adminToken = AuthService.signAccessToken(
            { id: ids.userA, email: `tenant-admin-${suffix}@example.test`, role: 'ADMIN', schoolId: ids.schoolA },
            ids.adminSession,
        );

        await prisma.student.createMany({
            data: [
                {
                    id: ids.studentA,
                    schoolId: ids.schoolA,
                    admissionNo: `A-${suffix}`,
                    firstName: 'Tenant',
                    lastName: 'One',
                    nationalIdNumber: `NID-A-${suffix}`,
                    birthCertificateNumber: `BIRTH-A-${suffix}`,
                    dateOfBirth: new Date('2012-01-01'),
                    gender: 'OTHER',
                },
                {
                    id: ids.studentB,
                    schoolId: ids.schoolB,
                    admissionNo: `B-${suffix}`,
                    firstName: 'Tenant',
                    lastName: 'Two',
                    nationalIdNumber: `NID-B-${suffix}`,
                    birthCertificateNumber: `BIRTH-B-${suffix}`,
                    dateOfBirth: new Date('2012-01-01'),
                    gender: 'OTHER',
                },
            ],
        });

        await prisma.parent.create({
            data: {
                id: ids.parentB,
                schoolId: ids.schoolB,
                firstName: 'Parent',
                lastName: 'Two',
                phone: `+2547${suffix.replaceAll('-', '').slice(24, 32)}`,
                email: `tenant-parent-${suffix}@example.test`,
                relation: 'GUARDIAN',
                nationalIdNumber: `PARENT-NID-${suffix}`,
            },
        });
    });

    afterAll(async () => {
        if (!prisma) return;
        await prisma.auditLog.deleteMany({
            where: { schoolId: { in: [ids.schoolA, ids.schoolB] } },
        });
        await prisma.ledgerEntry.deleteMany({ where: { schoolId: ids.schoolA } });
        await prisma.payment.deleteMany({ where: { schoolId: ids.schoolA } });
        await prisma.studentParent.deleteMany({
            where: { studentId: { in: [ids.studentA, ids.studentB] } },
        });
        await prisma.parent.deleteMany({ where: { id: ids.parentB } });
        await prisma.student.deleteMany({ where: { id: { in: [ids.studentA, ids.studentB] } } });
        await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.superUser] } } });
        await prisma.school.deleteMany({ where: { id: { in: [ids.schoolA, ids.schoolB] } } });
        await prisma.$disconnect();
    });

    it('automatically scopes tenant model reads through AsyncLocalStorage', async () => {
        const visible = await tenantContext.run(
            { schoolId: ids.schoolA, actorId: ids.userA, role: 'ADMIN' },
            async () => prisma.student.findMany({
                where: { id: { in: [ids.studentA, ids.studentB] } },
                select: { id: true, schoolId: true },
            }),
        );

        expect(visible).toEqual([{ id: ids.studentA, schoolId: ids.schoolA }]);
    });

    it('requires platform operators to select a tenant and rejects ordinary tenant switching', async () => {
        const withoutTenant = await request(app)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${superToken}`);
        expect(withoutTenant.status).toBe(400);

        const selectedTenant = await request(app)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${superToken}`)
            .set('x-school-id', ids.schoolA);
        expect(selectedTenant.status).toBe(200);
        expect(selectedTenant.body.data.map((student) => student.id)).toEqual([ids.studentA]);

        const forbiddenSwitch = await request(app)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-school-id', ids.schoolB);
        expect(forbiddenSwitch.status).toBe(403);
    });

    it('installs a same-school guard for every current tenant foreign key', async () => {
        const [coverage] = await prisma.$queryRaw`
            SELECT
                COUNT(*)::integer AS eligible_count,
                (
                    SELECT COUNT(*)::integer
                    FROM pg_trigger trigger_row
                    JOIN pg_proc function_row ON function_row.oid = trigger_row.tgfoid
                    WHERE NOT trigger_row.tgisinternal
                      AND function_row.proname = 'enforce_same_school_reference'
                ) AS installed_count
            FROM pg_constraint constraint_row
            JOIN pg_class child_class ON child_class.oid = constraint_row.conrelid
            JOIN pg_namespace child_namespace ON child_namespace.oid = child_class.relnamespace
            JOIN pg_class parent_class ON parent_class.oid = constraint_row.confrelid
            JOIN pg_namespace parent_namespace ON parent_namespace.oid = parent_class.relnamespace
            JOIN pg_attribute child_attribute
              ON child_attribute.attrelid = child_class.oid
             AND child_attribute.attnum = constraint_row.conkey[1]
            WHERE constraint_row.contype = 'f'
              AND array_length(constraint_row.conkey, 1) = 1
              AND child_namespace.nspname = current_schema()
              AND parent_namespace.nspname = current_schema()
              AND child_attribute.attname <> 'schoolId'
              AND EXISTS (
                  SELECT 1 FROM pg_attribute attribute_row
                  WHERE attribute_row.attrelid = child_class.oid
                    AND attribute_row.attname = 'schoolId'
                    AND NOT attribute_row.attisdropped
              )
              AND EXISTS (
                  SELECT 1 FROM pg_attribute attribute_row
                  WHERE attribute_row.attrelid = parent_class.oid
                    AND attribute_row.attname = 'schoolId'
                    AND NOT attribute_row.attisdropped
              )
        `;

        expect(coverage.eligible_count).toBeGreaterThan(0);
        expect(coverage.installed_count).toBe(coverage.eligible_count);
    });

    it('rejects cross-tenant relations even when bypassing service ownership checks', async () => {
        await expect(
            prisma.payment.create({
                data: {
                    schoolId: ids.schoolA,
                    studentId: ids.studentB,
                    amount: '100.00',
                    method: 'CASH',
                    status: 'COMPLETED',
                },
            }),
        ).rejects.toThrow(/Tenant boundary violation/);

        await expect(
            prisma.studentParent.create({
                data: { studentId: ids.studentA, parentId: ids.parentB },
            }),
        ).rejects.toThrow(/Tenant boundary violation/);

        await expect(
            prisma.staffModuleAccess.create({
                data: {
                    schoolId: ids.schoolA,
                    userId: ids.superUser,
                    grantedById: ids.superUser,
                    module: 'STUDENTS',
                },
            }),
        ).rejects.toThrow(/must reference a tenant-owned record/);
    });

    it('rejects another school student before recording a payment', async () => {
        await expect(
            tenantContext.run(
                { schoolId: ids.schoolA, actorId: ids.userA, role: 'ADMIN' },
                () => FinanceService.recordPayment(
                    { studentId: ids.studentB, amount: 100, method: 'CASH' },
                    { id: ids.userA, role: 'ADMIN', schoolId: ids.schoolA },
                ),
            ),
        ).rejects.toThrow('Student not found in this school');
    });

    it('records a same-tenant payment and balanced ledger pair', async () => {
        const payment = await tenantContext.run(
            { schoolId: ids.schoolA, actorId: ids.superUser, role: 'SUPER_ADMIN' },
            async () => FinanceService.recordPayment(
                { studentId: ids.studentA, amount: 100, method: 'CASH' },
                { id: ids.superUser, role: 'SUPER_ADMIN', schoolId: ids.schoolA },
            ),
        );
        const entries = await prisma.ledgerEntry.findMany({
            where: { schoolId: ids.schoolA, reference: `Payment:${payment.id}` },
            orderBy: { direction: 'asc' },
        });

        expect(entries).toHaveLength(2);
        expect(entries.map((entry) => entry.direction).sort()).toEqual(['CREDIT', 'DEBIT']);
        expect(entries.every((entry) => entry.schoolId === ids.schoolA)).toBe(true);
    });
});
