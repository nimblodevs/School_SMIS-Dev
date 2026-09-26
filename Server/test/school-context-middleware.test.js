import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ schoolFindUnique: vi.fn() }));

vi.mock('../src/config/prisma.js', () => ({
    prisma: { school: { findUnique: mocks.schoolFindUnique } },
}));

import { resolveSchoolContext } from '../src/api/middlewares/schoolContextMiddleware.js';
import { authenticate } from '../src/api/middlewares/authMiddleware.js';
import { tenantContext } from '../src/config/tenant-context.js';

const schoolA = '00000000-0000-4000-8000-000000000001';
const schoolB = '00000000-0000-4000-8000-000000000002';

function makeRequest({ role = 'ADMIN', schoolId = schoolA, headers = {}, query = {}, body = {} } = {}) {
    const req = {
        authenticated: true,
        user: { id: 'actor-id', role, schoolId, isImpersonated: false },
        headers,
        query,
        body,
    };
    req.get = (name) => req.headers[name.toLowerCase()];
    return req;
}

async function invoke(req) {
    let error;
    let context;
    await resolveSchoolContext(req, {}, (nextError) => {
        error = nextError;
        context = tenantContext.get();
    });
    return { error, context };
}

beforeEach(() => mocks.schoolFindUnique.mockReset());

describe('school context middleware', () => {
    it('uses a tenant user’s assigned school and preserves it through nested authentication', async () => {
        const req = makeRequest();
        let nestedContext;

        await resolveSchoolContext(req, {}, async () => {
            await authenticate(req, {}, () => {
                nestedContext = tenantContext.get();
            });
        });

        expect(req.user.schoolId).toBe(schoolA);
        expect(nestedContext.schoolId).toBe(schoolA);
        expect(mocks.schoolFindUnique).not.toHaveBeenCalled();
    });

    it('rejects a tenant user selecting another school', async () => {
        const req = makeRequest({ headers: { 'x-school-id': schoolB } });
        const { error } = await invoke(req);

        expect(error?.message).toBe('You do not have access to the selected school');
    });

    it('rejects conflicting school selections', async () => {
        const req = makeRequest({
            role: 'SUPER_ADMIN',
            schoolId: null,
            headers: { 'x-school-id': schoolA },
            query: { schoolId: schoolB },
        });
        const { error } = await invoke(req);

        expect(error?.message).toBe('Conflicting school selections were provided');
        expect(mocks.schoolFindUnique).not.toHaveBeenCalled();
    });

    it('requires a selected active school for platform administrator routes', async () => {
        const req = makeRequest({ role: 'SUPER_ADMIN', schoolId: null });
        const { error } = await invoke(req);
        expect(error?.message).toBe('x-school-id is required for school-scoped operations');

        mocks.schoolFindUnique.mockResolvedValue({ id: schoolA, isActive: true });
        const selectedReq = makeRequest({
            role: 'SUPER_ADMIN',
            schoolId: null,
            headers: { 'x-school-id': schoolA },
        });
        const selected = await invoke(selectedReq);
        expect(selected.error).toBeUndefined();
        expect(selectedReq.user.schoolId).toBe(schoolA);
        expect(selected.context.schoolId).toBe(schoolA);
    });

    it('rejects inactive platform-selected schools', async () => {
        mocks.schoolFindUnique.mockResolvedValue({ id: schoolA, isActive: false });
        const req = makeRequest({
            role: 'SUPER_ADMIN',
            schoolId: null,
            headers: { 'x-school-id': schoolA },
        });
        const { error } = await invoke(req);

        expect(error?.message).toBe('Selected school is inactive');
    });
});