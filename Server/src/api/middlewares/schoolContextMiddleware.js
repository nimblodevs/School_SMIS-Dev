import { prisma } from '../../config/prisma.js';
import { tenantContext } from '../../config/tenant-context.js';
import {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/AppError.js';

function explicitSchoolIds(req) {
    const values = [
        req.get?.('x-school-id') ?? req.headers?.['x-school-id'],
        req.query?.schoolId,
        req.body?.schoolId,
    ].filter((value) => value !== undefined && value !== null && value !== '');

    if (values.some((value) => typeof value !== 'string' || !value.trim())) {
        throw new BadRequestError('School selection must be a single school ID');
    }

    const schoolIds = [...new Set(values.map((value) => value.trim()))];
    if (schoolIds.length > 1) {
        throw new BadRequestError('Conflicting school selections were provided');
    }
    return schoolIds[0] ?? null;
}

export async function resolveSchoolContext(req, res, next) {
    try {
        const actor = req.user;
        if (!actor) throw new ForbiddenError('Authentication is required to select a school');

        const requestedSchoolId = explicitSchoolIds(req);
        let schoolId;

        if (actor.role === 'SUPER_ADMIN') {
            schoolId = requestedSchoolId ?? actor.schoolId;
            if (!schoolId) {
                throw new BadRequestError('x-school-id is required for school-scoped operations');
            }

            const school = await prisma.school.findUnique({
                where: { id: schoolId },
                select: { id: true, isActive: true },
            });
            if (!school) throw new NotFoundError('Selected school was not found');
            if (!school.isActive) throw new ForbiddenError('Selected school is inactive');
        } else {
            if (!actor.schoolId) {
                throw new ForbiddenError('User is not associated with a school');
            }
            if (requestedSchoolId && requestedSchoolId !== actor.schoolId) {
                throw new ForbiddenError('You do not have access to the selected school');
            }
            schoolId = actor.schoolId;
        }

        req.selectedSchoolId = schoolId;
        req.user = { ...actor, schoolId };

        const currentContext = tenantContext.get() ?? {};
        return tenantContext.run(
            {
                ...currentContext,
                schoolId,
                actorId: req.user.isImpersonated ? req.user.actorId : req.user.id,
                role: req.user.role,
            },
            next,
        );
    } catch (error) {
        return next(error);
    }
}