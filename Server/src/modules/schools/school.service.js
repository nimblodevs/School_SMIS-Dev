import { prisma, runTransaction } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';

const schoolSelect = {
    id: true,
    name: true,
    slug: true,
    schoolCode: true,
    motto: true,
    vision: true,
    mission: true,
    address: true,
    city: true,
    county: true,
    postalCode: true,
    phone: true,
    email: true,
    website: true,
    isActive: true,
    createdAt: true,
    nextTeacherSequence: true,
    nextStaffSequence: true,
    _count: {
        select: {
            users: true,
            teachers: true,
            staff: true,
            students: true,
            parents: true,
        },
    },
};

function isUniqueConstraintError(error) {
    return error?.code === 'P2002';
}

export class SchoolService {
    static async create(input, actor, { ipAddress, userAgent } = {}) {
        try {
            const school = await runTransaction(async (transaction) => {
                const sequence = await transaction.systemSequence.upsert({
                    where: { key: 'SCHOOL_CODE' },
                    update: { nextSchoolCode: { increment: 1 } },
                    create: { key: 'SCHOOL_CODE', nextSchoolCode: 2 },
                    select: { nextSchoolCode: true },
                });
                const schoolCodeNumber = sequence.nextSchoolCode - 1;
                if (schoolCodeNumber > 99999) throw new BadRequestError('The five-digit school code range is exhausted');
                return transaction.school.create({
                    data: {
                        name: input.name.toUpperCase(),
                        slug: input.slug,
                        schoolCode: String(schoolCodeNumber).padStart(5, '0'),
                        motto: input.motto,
                        vision: input.vision,
                        mission: input.mission,
                        address: input.address,
                        city: input.city,
                        county: input.county,
                        postalCode: input.postalCode,
                        phone: input.phone,
                        email: input.email,
                        website: input.website,
                    },
                    select: schoolSelect,
                });
            });

            await recordAudit({
                action: 'CREATE',
                actorId: actor.id,
                entityType: 'School',
                entityId: school.id,
                metadata: { name: school.name, slug: school.slug, schoolCode: school.schoolCode },
                ipAddress,
                userAgent,
            });
            return school;
        } catch (error) {
            if (isUniqueConstraintError(error)) throw new BadRequestError('School name identifiers or code already exist');
            throw error;
        }
    }

    static async list({ page = 1, pageSize = 50, search, isActive } = {}) {
        const where = {
            ...(typeof isActive === 'boolean' ? { isActive } : {}),
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { slug: { contains: search, mode: 'insensitive' } },
                    { schoolCode: { contains: search } },
                ],
            } : {}),
        };
        const [schools, total] = await Promise.all([
            prisma.school.findMany({ where, select: schoolSelect, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
            prisma.school.count({ where }),
        ]);
        return { schools, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    static async getById(schoolId, actor) {
        if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) {
            throw new ForbiddenError('You do not have access to this school');
        }
        const school = await prisma.school.findUnique({ where: { id: schoolId }, select: schoolSelect });
        if (!school) throw new NotFoundError('School not found');
        return school;
    }

    static async update(schoolId, input, actor, { ipAddress, userAgent } = {}) {
        if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) {
            throw new ForbiddenError('You do not have access to this school');
        }
        const normalizedInput = { ...input, ...(input.name ? { name: input.name.toUpperCase() } : {}) };
        const editableProfileFields = ['motto', 'vision', 'mission', 'address', 'city', 'county', 'postalCode', 'website'];
        const data = actor.role === 'SUPER_ADMIN'
            ? normalizedInput
            : Object.fromEntries(Object.entries(normalizedInput).filter(([field]) => editableProfileFields.includes(field)));
        if (Object.keys(data).length === 0) throw new ForbiddenError('Only super admins can change the school name, email, phone, slug, or active status');
        try {
            const school = await prisma.school.update({ where: { id: schoolId }, data, select: schoolSelect });
            await recordAudit({
                action: 'UPDATE',
                actorId: actor.id,
                schoolId,
                entityType: 'School',
                entityId: schoolId,
                metadata: { fields: Object.keys(data) },
                ipAddress,
                userAgent,
            });
            return school;
        } catch (error) {
            if (error?.code === 'P2025') throw new NotFoundError('School not found');
            if (isUniqueConstraintError(error)) throw new BadRequestError('School slug or payment identifier already exists');
            throw error;
        }
    }

    static async getSettings(schoolId, actor) {
        await this.getById(schoolId, actor);
        return prisma.schoolSettings.upsert({
            where: { schoolId },
            update: {},
            create: { schoolId },
            select: { schoolId: true, mpesaShortcode: true, mpesaEnabled: true, createdAt: true, updatedAt: true },
        });
    }

    static async updateSettings(schoolId, input, actor, { ipAddress, userAgent } = {}) {
        await this.getById(schoolId, actor);
        if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) throw new ForbiddenError('You do not have access to this school');
        const settings = await prisma.schoolSettings.upsert({
            where: { schoolId },
            update: input,
            create: { schoolId, ...input },
            select: { schoolId: true, mpesaShortcode: true, mpesaEnabled: true, createdAt: true, updatedAt: true },
        });
        await recordAudit({ action: 'UPDATE', actorId: actor.id, schoolId, entityType: 'SchoolSettings', entityId: schoolId, metadata: { fields: Object.keys(input) }, ipAddress, userAgent });
        return settings;
    }
}
