import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
    process.env.DATABASE_URL ??= 'postgresql://review:review@127.0.0.1:1/review';
    process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters';
    process.env.NODE_ENV = 'test';
});

describe('bulk admission parser', () => {
    it('parses CSV imports without the vulnerable SheetJS dependency', async () => {
        const { parseRows } = await import('../src/modules/students/students.bulk-service.js');
        const csv = Buffer.from('firstName,lastName,dateOfBirth\nAmina,Otieno,2012-04-03\n');

        const rows = await parseRows(csv, {
            mimetype: 'text/csv',
            originalName: 'students.csv',
        });

        expect(rows).toEqual([
            { firstName: 'Amina', lastName: 'Otieno', dateOfBirth: '2012-04-03' },
        ]);
    });
});
