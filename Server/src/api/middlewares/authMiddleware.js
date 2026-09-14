import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import {
    BadRequestError,
    ForbiddenError,
    UnauthorizedError,
} from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { tenantContext } from '../../config/tenant-context.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PASSWORD_EXEMPT_PATHS = ['/change-password', '/logout', '/reset-password'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractToken(req) {
    if (req.cookies?.token) return { token: req.cookies.token, source: 'cookie' };
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return { token: header.slice(7), source: 'bearer' };
    return { token: null, source: null };
}

function pathMatches(req, suffixes) {
    const fullPath = `${req.baseUrl ?? ''}${req.path ?? ''}`;
    return suffixes.some((s) => fullPath.endsWith(s));
}

function requestedTenantId(req) {
    const value = req.headers['x-school-id'];
    if (value === undefined) return null;
    if (Array.isArray(value) || !UUID_PATTERN.test(value.trim())) {
        throw new BadRequestError('x-school-id must be a valid school UUID');
    }
    return value.trim();
}

export const authenticate = async (req, res, next) => {
    try {
        const { token } = extractToken(req);
        if (!token) throw new UnauthorizedError('Authentication token missing');

        let decoded;
        try {
            decoded = jwt.verify(token, env.JWT_SECRET, {
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
            });
        } catch {
            throw new UnauthorizedError('Session expired or token invalid');
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: {
                id: true,
                email: true,
                role: true,
                schoolId: true,
                isActive: true,
                currentSessionId: true,
                mustChangePassword: true,
                staffModuleAccess: { select: { module: true } },
                school: { select: { id: true, isActive: true } },
            },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedError('User account is invalid or deactivated');
        }
        if (user.schoolId && !user.school?.isActive) {
            throw new UnauthorizedError('The school account associated with your profile is inactive');
        }

        const isImpersonated = Boolean(decoded.isImpersonated);

        // For impersonated tokens, the "session owner" is the actor.
        // For normal tokens, it's the subject themselves.
        const sessionOwner = isImpersonated
            ? await prisma.user.findUnique({
                where: { id: decoded.actorId ?? '' },
                select: {
                    id: true,
                    role: true,
                    schoolId: true,
                    currentSessionId: true,
                    isActive: true,
                },
            })
            : user;

        const expectedSessionId = isImpersonated
            ? decoded.actorSessionId
            : decoded.sessionId;

        if (
            !sessionOwner?.isActive ||
            !sessionOwner.currentSessionId ||
            sessionOwner.currentSessionId !== expectedSessionId
        ) {
            throw new UnauthorizedError('Session expired or invalid');
        }

        if (isImpersonated) {
            const actorCanImpersonate =
                sessionOwner.role === 'SUPER_ADMIN' ||
                (sessionOwner.role === 'ADMIN' && sessionOwner.schoolId === user.schoolId);
            if (
                !actorCanImpersonate ||
                decoded.actorId !== sessionOwner.id ||
                decoded.targetUserId !== user.id
            ) {
                throw new UnauthorizedError('Impersonation authorization is no longer valid');
            }
        }

        const requestedSchoolId = requestedTenantId(req);
        let effectiveSchoolId = user.schoolId;
        if (user.role === 'SUPER_ADMIN' && !isImpersonated) {
            effectiveSchoolId = requestedSchoolId;
            if (effectiveSchoolId) {
                const selectedSchool = await prisma.school.findUnique({
                    where: { id: effectiveSchoolId },
                    select: { isActive: true },
                });
                if (!selectedSchool?.isActive) {
                    throw new ForbiddenError('Selected school does not exist or is inactive');
                }
            }
        } else if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
            throw new ForbiddenError('You cannot select a different school');
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: effectiveSchoolId,
            homeSchoolId: user.schoolId,
            modulePermissions: user.staffModuleAccess.map((a) => a.module),
            mustChangePassword: user.mustChangePassword,
            sessionId: decoded.sessionId,
            isImpersonated,
            actorId: decoded.actorId ?? null,
            targetUserId: decoded.targetUserId ?? null,
        };

        if (
            user.mustChangePassword &&
            !isImpersonated &&
            !pathMatches(req, PASSWORD_EXEMPT_PATHS)
        ) {
            throw new UnauthorizedError('Password reset is required before accessing this resource');
        }

        // Impersonation audit: only for state-changing requests.
        // Reads are covered by the IMPERSONATION_STARTED row + session duration.
        if (isImpersonated && STATE_CHANGING_METHODS.has(req.method)) {
            await recordAudit({
                action: 'IMPERSONATED_ACTION',
                actorId: decoded.actorId ?? null,
                schoolId: user.schoolId,
                entityType: 'User',
                entityId: user.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                metadata: {
                    method: req.method,
                    path: req.path,
                    targetUserId: decoded.targetUserId,
                },
            });
        }

        return tenantContext.run(
            {
                schoolId: effectiveSchoolId,
                actorId: req.user.isImpersonated ? req.user.actorId : user.id,
                role: user.role,
            },
            next,
        );
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Session expired or token invalid'));
        }
        return next(error);
    }
};
