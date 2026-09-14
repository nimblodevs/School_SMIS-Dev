import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
    process.env.DATABASE_URL ??= 'postgresql://review:review@127.0.0.1:1/review';
    process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters';
    process.env.NODE_ENV = 'test';
});

describe('API route graph', () => {
    it('loads every mounted router without import-time failures', async () => {
        const module = await import('../src/api/routes.js');
        expect(module.default).toBeDefined();
    });

    it('scopes both branches of tenant upserts without adding an invalid data argument', async () => {
        const { addTenantScope } = await import('../src/config/prisma.js');
        const scoped = addTenantScope(
            {
                where: { id: 'record-id' },
                create: { name: 'Created' },
                update: { name: 'Updated' },
            },
            'upsert',
            'school-id',
        );

        expect(scoped).toEqual({
            where: { id: 'record-id', schoolId: 'school-id' },
            create: { name: 'Created', schoolId: 'school-id' },
            update: { name: 'Updated', schoolId: 'school-id' },
        });
        expect(scoped).not.toHaveProperty('data');
    });

    it.each(['findUniqueOrThrow', 'findFirstOrThrow', 'updateManyAndReturn'])(
        'adds tenant ownership to %s operations',
        async (operation) => {
            const { addTenantScope } = await import('../src/config/prisma.js');
            const scoped = addTenantScope(
                { where: { id: 'record-id' }, ...(operation.startsWith('update') ? { data: { active: true } } : {}) },
                operation,
                'school-id',
            );

            expect(scoped.where).toEqual({ id: 'record-id', schoolId: 'school-id' });
            if (operation.startsWith('update')) {
                expect(scoped.data).toEqual({ active: true, schoolId: 'school-id' });
            }
        },
    );

    it('overrides caller-supplied tenant IDs for bulk creates', async () => {
        const { addTenantScope } = await import('../src/config/prisma.js');
        const scoped = addTenantScope(
            { data: [{ name: 'One', schoolId: 'other-school' }, { name: 'Two' }] },
            'createManyAndReturn',
            'school-id',
        );

        expect(scoped.data).toEqual([
            { name: 'One', schoolId: 'school-id' },
            { name: 'Two', schoolId: 'school-id' },
        ]);
    });

    it('registers every Prisma model containing schoolId for automatic scoping', async () => {
        const [{ Prisma }, { TENANT_MODELS }] = await Promise.all([
            import('@prisma/client'),
            import('../src/config/prisma.js'),
        ]);
        const schemaTenantModels = Prisma.dmmf.datamodel.models
            .filter((model) => model.fields.some((field) => field.name === 'schoolId'))
            .map((model) => model.name)
            .sort();

        expect([...TENANT_MODELS].sort()).toEqual(schemaTenantModels);
    });
});
