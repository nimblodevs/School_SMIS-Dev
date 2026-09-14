import { ForbiddenError } from '../../shared/errors/AppError.js';

// Default modules per role. Extended per-school via StaffModuleAccess for STAFF.
const ROLE_DEFAULT_MODULES = {
    TEACHER: ['STUDENTS', 'ATTENDANCE', 'TIMETABLE', 'EXAMS', 'CBC', 'REPORTS'],
    BURSAR: ['FEES', 'REPORTS', 'FINANCE'],
    MANAGER: [
        'STUDENTS',
        'ATTENDANCE',
        'TIMETABLE',
        'EXAMS',
        'CBC',
        'FEES',
        'REPORTS',
        'FINANCE',
        // No PAYROLL — MANAGER is explicitly excluded
    ],
    ADMIN: '*',
    SUPER_ADMIN: '*',
};

const MODULE_PERMISSIONS = {
    STUDENTS: ['students:read', 'students:create', 'students:update'],
    ATTENDANCE: ['attendance:read', 'attendance:create', 'attendance:update'],
    TIMETABLE: ['timetable:read', 'timetable:create', 'timetable:update'],
    EXAMS: ['exams:read', 'exams:create', 'exams:update'],
    CBC: ['cbc:read', 'cbc:create', 'cbc:update'],
    FEES: ['fees:read', 'fees:create', 'fees:update'],
    FINANCE: ['fees:read', 'fees:create', 'fees:refund'],
    REPORTS: ['reports:read'],
    PAYROLL: ['payroll:read', 'payroll:create', 'payroll:process'],
};

const ROLE_PERMISSIONS = {
    ADMIN: ['*'],
    SUPER_ADMIN: ['*'],
    MANAGER: [
        'students:read',
        'students:create',
        'students:update',
        'attendance:read',
        'attendance:create',
        'attendance:update',
        'timetable:read',
        'timetable:create',
        'timetable:update',
        'exams:read',
        'exams:create',
        'exams:update',
        'cbc:read',
        'cbc:create',
        'cbc:update',
        'fees:read',
        'fees:create',
        'fees:update',
        'reports:read',
    ],
    BURSAR: ['fees:read', 'fees:create', 'fees:update', 'fees:refund', 'reports:read'],
    TEACHER: [
        'students:read',
        'attendance:read',
        'attendance:create',
        'attendance:update',
        'timetable:read',
        'exams:read',
        'exams:create',
        'exams:update',
        'cbc:read',
        'cbc:create',
        'cbc:update',
        'reports:read',
    ],
    STAFF: [],
    STUDENT: ['students:read'],
    PARENT: ['students:read'],
};

function roleHasModule(role, module) {
    const allowed = ROLE_DEFAULT_MODULES[role];
    if (!allowed) return false;
    if (allowed === '*') return true;
    return allowed.includes(module);
}

export function userHasModuleAccess(user, module) {
    if (!user) return false;
    if (roleHasModule(user.role, module)) return true;
    return user.role === 'STAFF' && user.modulePermissions?.includes(module);
}

export function userHasPermission(user, permission) {
    if (!user || !permission) return false;
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    if (rolePermissions.includes('*') || rolePermissions.includes(permission)) return true;

    return (user.modulePermissions || []).some((module) =>
        (MODULE_PERMISSIONS[module] || []).includes(permission),
    );
}

export const requirePermission = (...requiredPermissions) => {
    if (requiredPermissions.length === 0) {
        throw new Error('requirePermission requires at least one permission');
    }

    return (req, res, next) => {
        if (!req.user) return next(new ForbiddenError('User context unauthenticated'));
        if (requiredPermissions.some((permission) => userHasPermission(req.user, permission))) {
            return next();
        }
        return next(new ForbiddenError('You do not have permission to perform this action'));
    };
};

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

        if (userHasModuleAccess(req.user, requiredModule)) return next();

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
