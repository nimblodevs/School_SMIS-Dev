import { BadRequestError, ForbiddenError, NotFoundError } from './errors/AppError.js';

export function resolveSchoolId(actor, explicitSchoolId) {
    if (actor.role === 'SUPER_ADMIN') {
        if (actor.schoolId && explicitSchoolId && explicitSchoolId !== actor.schoolId) {
            throw new ForbiddenError('The selected tenant differs from the selected tenant');
        }

        const selectedSchoolId = explicitSchoolId ?? actor.schoolId;
        if (!selectedSchoolId) {
            throw new BadRequestError('schoolId is required for platform-level operations');
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

export async function assertOwnership(tx, schoolId, references) {
    await Promise.all(
        references.map(async ({ model, id, label }) => {
            const delegate = tx[model];
            if (!delegate?.findFirst) {
                throw new Error(`Unsupported ownership model: ${model}`);
            }
            const record = await delegate.findFirst({
                where: { id, schoolId },
                select: { id: true },
            });
            if (!record) {
                throw new NotFoundError(`${label} not found in this school`);
            }
        }),
    );
}
