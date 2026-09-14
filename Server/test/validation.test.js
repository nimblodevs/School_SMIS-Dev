import { describe, expect, it } from 'vitest';
import { loginSchema } from '../src/modules/auth/auth.validation.js';
import {
    createParentSchema,
    updateParentSchema,
} from '../src/modules/parents/parents.validation.js';
import { executePayrollSchema } from '../src/modules/payroll/payroll.validation.js';
import { resolveSchoolId } from '../src/shared/ownership.js';
import { userHasPermission } from '../src/api/middlewares/roleMiddleware.js';

describe('authentication validation', () => {
    it('accepts email and password', () => {
        expect(
            loginSchema.safeParse({
                email: 'admin@example.com',
                password: 'long-enough-password',
            }).success,
        ).toBe(true);
    });

    it('rejects username-only login', () => {
        expect(
            loginSchema.safeParse({
                username: 'admin',
                password: 'long-enough-password',
            }).success,
        ).toBe(false);
    });

    it('rejects login without an email', () => {
        expect(loginSchema.safeParse({ password: 'long-enough-password' }).success).toBe(false);
    });
});

describe('parent validation', () => {
    const parent = {
        firstName: 'Amina',
        lastName: 'Otieno',
        nationalIdNumber: '12345678',
        phone: '+254700000001',
    };

    it('allows a parent without a portal account', () => {
        expect(createParentSchema.safeParse(parent).success).toBe(true);
    });

    it('requires email when creating a portal account', () => {
        expect(createParentSchema.safeParse({ ...parent, createPortalAccount: true }).success).toBe(
            false,
        );
    });

    it('supports partial, non-empty parent updates', () => {
        expect(updateParentSchema.safeParse({ phone: '+254700000002' }).success).toBe(true);
        expect(updateParentSchema.safeParse({}).success).toBe(false);
    });
});

describe('payroll validation', () => {
    it('normalizes YYYY-MM into the service contract', () => {
        expect(executePayrollSchema.parse({ month: '2026-09' })).toEqual({
            year: 2026,
            month: 9,
        });
    });

    it('rejects impossible months', () => {
        expect(executePayrollSchema.safeParse({ month: '2026-13' }).success).toBe(false);
    });
});

describe('school ownership', () => {
    it('uses the authenticated school and rejects tenant overrides', () => {
        const actor = { role: 'ADMIN', schoolId: 'school-a' };
        expect(resolveSchoolId(actor)).toBe('school-a');
        expect(() => resolveSchoolId(actor, 'school-b')).toThrow('access to this school');
    });

    it('requires platform operators to select a school explicitly', () => {
        expect(() => resolveSchoolId({ role: 'SUPER_ADMIN', schoolId: null })).toThrow(
            'schoolId is required',
        );
    });

    it('uses the platform operator selected tenant and rejects a conflicting override', () => {
        const actor = { role: 'SUPER_ADMIN', schoolId: 'school-a' };
        expect(resolveSchoolId(actor)).toBe('school-a');
        expect(resolveSchoolId(actor, 'school-a')).toBe('school-a');
        expect(() => resolveSchoolId(actor, 'school-b')).toThrow('differs from the selected tenant');
    });
});

describe('permissions', () => {
    it('maps role permissions to resource actions', () => {
        expect(userHasPermission({ role: 'BURSAR' }, 'fees:refund')).toBe(true);
        expect(userHasPermission({ role: 'BURSAR' }, 'payroll:process')).toBe(false);
        expect(userHasPermission({ role: 'MANAGER' }, 'payroll:process')).toBe(false);
    });

    it('expands explicit staff module access into permissions', () => {
        expect(
            userHasPermission({ role: 'STAFF', modulePermissions: ['STUDENTS'] }, 'students:create'),
        ).toBe(true);
        expect(
            userHasPermission({ role: 'STAFF', modulePermissions: ['STUDENTS'] }, 'fees:create'),
        ).toBe(false);
    });
});
