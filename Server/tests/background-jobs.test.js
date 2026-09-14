import { describe, expect, it } from 'vitest';
import {
    JOB_TYPES,
    normalizePersistedJobPayload,
    validateJobPayload,
} from '../src/shared/background-jobs.js';

const actorId = '00000000-0000-4000-8000-000000000001';

describe('background job payloads', () => {
    it('accepts normalized payroll periods', () => {
        expect(
            validateJobPayload(JOB_TYPES.PAYROLL_RUN, { year: 2026, month: 9, actorId }),
        ).toEqual({ year: 2026, month: 9, actorId });
    });

    it('rejects the legacy payroll string payload', () => {
        expect(() =>
            validateJobPayload(JOB_TYPES.PAYROLL_RUN, { month: '2026-09', actorId }),
        ).toThrow();
    });

    it('normalizes already-persisted legacy payroll jobs before execution', () => {
        expect(
            normalizePersistedJobPayload(JOB_TYPES.PAYROLL_RUN, {
                month: '2026-09',
                actorId,
            }),
        ).toEqual({ year: 2026, month: 9, actorId });
    });
});
