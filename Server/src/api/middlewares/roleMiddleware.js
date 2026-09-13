import { ForbiddenError } from '../../shared/errors/AppError.js';

/**
 * Authorize access based on high-level system Roles
 * @param  {...string} allowedRoles
 */
export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ForbiddenError('User context unauthenticated'));
        }

        if (req.user.role === 'SUPER_ADMIN') {
            return next(); // Super admin bypasses role checks
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError('You do not have permission to access this resource'));
        }

        next();
    };
};

/**
 * Authorize granular module access for non-admin/staff profiles
 * @param {string} requiredModule - Enum StaffModule (e.g. 'FEES', 'ATTENDANCE', 'EXAMS')
 */
export const authorizeModule = (requiredModule) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ForbiddenError('User context unauthenticated'));
        }

        const { role, modulePermissions } = req.user;

        // Full administrative roles bypass module-level checks
        if (['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
            return next();
        }

        // For generic STAFF, verify presence in StaffModuleAccess list
        if (role === 'STAFF') {
            if (modulePermissions && modulePermissions.includes(requiredModule)) {
                return next();
            }
        }

        return next(new ForbiddenError(`Access denied to the ${requiredModule} module`));
    };
};