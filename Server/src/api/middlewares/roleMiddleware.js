import { ForbiddenError } from '../../shared/errors/AppError.js';

// Default modules per role. Extended per-school via StaffModuleAccess for STAFF.
const ROLE_DEFAULT_MODULES = {
    TEACHER: ['STUDENTS', 'ATTENDANCE', 'TIMETABLE', 'EXAMS', 'CBC', 'REPORTS'],
    BURSAR: ['FEES', 'REPORTS', 'FINANCE'],
    MANAGER: [
        'STUDENTS', 'ATTENDANCE', 'TIMETABLE', 'EXAMS', 'CBC', 'FEES', 'REPORTS', 'FINANCE',
        // No PAYROLL — MANAGER is explicitly excluded
    ],
    ADMIN: '*',
    SUPER_ADMIN: '*',
};

function roleHasModule(role, module) {
    const allowed = ROLE_DEFAULT_MODULES[role];
    if (!allowed) return false;
    if (allowed === '*') return true;
    return allowed.includes(module);
}

export const authorizeRoles = (...allowedRoles) => {
    if (allowedRoles.length === 0) {
        throw new Error('authorizeRoles requires at least one role');
    }
    const set = new Set(allowedRoles);

    return (req, res, next) => {
        if (!req.user) return next(new ForbiddenError('User context unauthenticated'));
        if (req.user.role === 'SUPER_ADMIN') return next();
        if (!set.has(req.user.role)) {
            return next(new ForbiddenError('You do not have permission to access this resource'));
        }
        return next();
    };
};

export const authorizeModule = (requiredModule) => {
    return (req, res, next) => {
        if (!req.user) return next(new ForbiddenError('User context unauthenticated'));

        const { role, modulePermissions } = req.user;

        // Explicit SUPER_ADMIN / ADMIN bypass.
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') return next();

        // Role-default modules.
        if (roleHasModule(role, requiredModule)) return next();

        // STAFF: check explicit grants.
        if (role === 'STAFF' && modulePermissions?.includes(requiredModule)) {
            return next();
        }

        return next(new ForbiddenError(`Access denied to the ${requiredModule} module`));
    };
};

export const isSuperAdmin = (req, res, next) => {
    if (!req.user) return next(new ForbiddenError('User context unauthenticated'));
    if (req.user.role !== 'SUPER_ADMIN') {
        return next(new ForbiddenError('This action requires platform operator privileges'));
    }
    return next();
};