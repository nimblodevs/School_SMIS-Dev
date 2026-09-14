import { describe, expect, it } from 'vitest';
import {
    createParentSchema,
    updateParentSchema,
} from '../src/modules/parents/parents.validation.js';
import { StudentService } from '../src/modules/students/students.service.js';

describe('application startup contracts', () => {
    it('imports the composed Express application', async () => {
        const { app } = await import('../src/app.js');
        expect(app).toBeDefined();
    });

    it('supports partial parent updates without weakening create validation', () => {
        const update = updateParentSchema.safeParse({ phone: '+254700000000' });
        expect(update.success).toBe(true);
        expect(update.data).not.toHaveProperty('relation');
        expect(updateParentSchema.safeParse({}).success).toBe(false);
        expect(createParentSchema.safeParse({ createPortalAccount: true }).success).toBe(false);
    });

    it('rejects student mutations from staff without module access', () => {
        expect(() =>
            StudentService.assertCanManage({ role: 'STAFF', modulePermissions: [] }),
        ).toThrow(/STUDENTS module/);
    });
});
