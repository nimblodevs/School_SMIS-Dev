import { describe, expect, it } from 'vitest';
import { addTenantScope } from '../src/config/prisma.js';

const schoolId = '00000000-0000-4000-8000-000000000001';

describe('tenant query scoping', () => {
    it('scopes reads and regular writes', () => {
        expect(addTenantScope({ where: { id: 'record' } }, 'findFirst', schoolId)).toEqual({
            where: { id: 'record', schoolId },
        });
        expect(addTenantScope({ data: { name: 'Updated' } }, 'updateMany', schoolId)).toEqual({
            where: { schoolId },
            data: { name: 'Updated', schoolId },
        });
    });

    it('scopes both branches of an upsert using valid Prisma arguments', () => {
        expect(
            addTenantScope(
                {
                    where: { id: 'record' },
                    create: { name: 'Created' },
                    update: { name: 'Updated' },
                },
                'upsert',
                schoolId,
            ),
        ).toEqual({
            where: { id: 'record', schoolId },
            create: { name: 'Created', schoolId },
            update: { name: 'Updated', schoolId },
        });
    });

    it('supports both single and array createMany payloads', () => {
        expect(addTenantScope({ data: { name: 'One' } }, 'createMany', schoolId).data).toEqual({
            name: 'One',
            schoolId,
        });
        expect(addTenantScope({ data: [{ name: 'One' }] }, 'createMany', schoolId).data).toEqual([
            { name: 'One', schoolId },
        ]);
    });
});
