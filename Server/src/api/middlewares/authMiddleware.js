import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { UnauthorizedError } from '../../shared/errors/AppError.js';
import { recordAudit } from '../../shared/audit.js';
import { tenantContext } from '../../config/tenant-context.js';

export const authenticate = async (req, res, next) => {
    try {
        let token = null;

        // 1. Check HTTP-Only Cookie first
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }
        // 2. Fallback to Authorization Header (Bearer token)
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            throw new UnauthorizedError('Authentication token missing');
        }

        const decoded = jwt.verify(token, env.JWT_SECRET, {
            issuer: env.JWT_ISSUER,
            audience: env.JWT_AUDIENCE,
        });

        // Fetch active session ID from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: {
                id: true,
                email: true,
                role: true,
                schoolId: true,
                isActive: true,
                currentSessionId: true, // Used for single-device session validation
                mustChangePassword: true,
                staffModuleAccess: {
                    select: { module: true },
                },
            },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedError('User account is invalid or deactivated');
        }

        const sessionOwner = decoded.isImpersonated === true
            ? await prisma.user.findUnique({ where: { id: decoded.actorId }, select: { id: true, currentSessionId: true, isActive: true } })
            : user;

        // Normal tokens belong to the subject. Support tokens belong to the
        // administrator session that created them and expire with that session.
        if (!sessionOwner?.isActive || !sessionOwner.currentSessionId || sessionOwner.currentSessionId !== (decoded.isImpersonated ? decoded.actorSessionId : decoded.sessionId)) {
            throw new UnauthorizedError('Your session has expired because a new login was detected on another device.');
        }

        // Attach tenant context and permissions to Request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
            modulePermissions: user.staffModuleAccess.map((a) => a.module),
            mustChangePassword: user.mustChangePassword,
            sessionId: decoded.sessionId,
            isImpersonated: decoded.isImpersonated === true,
            actorId: decoded.actorId || null,
            targetUserId: decoded.targetUserId || null,
        };

        if (user.mustChangePassword && !req.user.isImpersonated && !['/change-password', '/logout'].includes(req.path)) {
            throw new UnauthorizedError('Password reset is required before accessing this resource');
        }

        if (decoded.isImpersonated === true) {
            await recordAudit({
                action: 'IMPERSONATED_ACTION',
                actorId: decoded.actorId || null,
                schoolId: user.schoolId,
                entityType: 'User',
                entityId: user.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                metadata: { method: req.method, path: req.path, targetUserId: decoded.targetUserId },
            });
        }

        return tenantContext.run({ schoolId: user.schoolId, actorId: user.id, role: user.role }, next);
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            next(new UnauthorizedError('Session expired or token invalid'));
        } else {
            next(error);
        }
    }
};