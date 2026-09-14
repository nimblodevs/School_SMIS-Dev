import { BadRequestError, ForbiddenError, NotFoundError } from './errors/AppError.js';

export function resolveSchoolId(actor, explicitSchoolId) {
    if (actor.role === 'SUPER_ADMIN') {
        const selectedSchoolId = explicitSchoolId || actor.schoolId;
        if (!selectedSchoolId) {
            throw new BadRequestError('schoolId is required for platform-level operations');
        }
        if (explicitSchoolId && actor.schoolId && explicitSchoolId !== actor.schoolId) {
            throw new ForbiddenError('The requested school differs from the selected tenant');
        }
        return selectedSchoolId;
    }

    if (!actor.schoolId) {
        throw new ForbiddenError('User is not associated with a school');
    }
    if (explicitSchoolId && explicitSchoolId !== actor.schoolId) {
        throw new ForbiddenError('You do not have access to this school');
    }
    return actor.schoolId;
}

export async function assertOwnership(transaction, schoolId, resources) {
    for (const { model, id, label = 'Resource', optional = false } of resources) {
        if (optional && !id) continue;
        const delegate = transaction[model];
        if (!delegate || typeof delegate.findFirst !== 'function') {
            throw new TypeError(`Unknown Prisma model delegate: ${model}`);
        }
        const owned = await delegate.findFirst({
            where: { id, schoolId },
            select: { id: true },
        });
        if (!owned) throw new NotFoundError(`${label} not found in this school`);
    }
}
