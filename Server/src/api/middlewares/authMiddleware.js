import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { UnauthorizedError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { tenantContext } from '../../config/tenant-context.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PASSWORD_EXEMPT_PATHS = ['/change-password', '/logout', '/reset-password'];

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
            throw new UnauthorizedError(
                'The school account associated with your profile is inactive',
            );
        }

        const isImpersonated = Boolean(decoded.isImpersonated);

        // For impersonated tokens, the "session owner" is the actor.
        // For normal tokens, it's the subject themselves.
        const sessionOwner = isImpersonated
            ? await prisma.user.findUnique({
                  where: { id: decoded.actorId ?? '' },
                  select: { id: true, currentSessionId: true, isActive: true },
              })
            : user;

        const expectedSessionId = isImpersonated ? decoded.actorSessionId : decoded.sessionId;

        if (
            !sessionOwner?.isActive ||
            !sessionOwner.currentSessionId ||
            sessionOwner.currentSessionId !== expectedSessionId
        ) {
            throw new UnauthorizedError('Session expired or invalid');
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
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
            throw new UnauthorizedError(
                'Password reset is required before accessing this resource',
            );
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
                schoolId: user.schoolId,
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
