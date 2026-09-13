import { prisma, runTransaction } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';

export class AcademicsService {
    // --- ACADEMIC YEARS ---

    static async createAcademicYear(input, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User must belong to a school');

        const result = await runTransaction(async (tx) => {
            if (input.isCurrent) {
                await tx.academicYear.updateMany({
                    where: { schoolId, isCurrent: true },
                    data: { isCurrent: false },
                });
            }

            return tx.academicYear.create({
                data: {
                    schoolId,
                    name: input.name,
                    startDate: new Date(input.startDate),
                    endDate: new Date(input.endDate),
                    isCurrent: input.isCurrent,
                },
            });
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'AcademicYear',
            entityId: result.id,
            metadata: { name: result.name },
            ipAddress,
            userAgent,
        });

        return result;
    }

    static async listAcademicYears(schoolId) {
        return prisma.academicYear.findMany({
            where: { schoolId },
            include: { terms: true },
            orderBy: { startDate: 'desc' },
        });
    }

    // --- TERMS ---

    static async createTerm(input, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;

        const term = await prisma.term.create({
            data: {
                schoolId,
                academicYearId: input.academicYearId,
                name: input.name,
                startDate: new Date(input.startDate),
                endDate: new Date(input.endDate),
            },
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Term',
            entityId: term.id,
            metadata: { name: term.name },
            ipAddress,
            userAgent,
        });

        return term;
    }

    // --- CLASS LEVELS & STREAMS ---

    static async createClassLevel(input, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;

        const classLevel = await prisma.classLevel.create({
            data: {
                schoolId,
                name: input.name,
                curriculum: input.curriculum,
            },
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'ClassLevel',
            entityId: classLevel.id,
            metadata: { name: classLevel.name, curriculum: classLevel.curriculum },
            ipAddress,
            userAgent,
        });

        return classLevel;
    }

    static async listClassLevels(schoolId) {
        return prisma.classLevel.findMany({
            where: { schoolId },
            include: { streams: true },
            orderBy: { name: 'asc' },
        });
    }

    static async createStream(input, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;

        const stream = await prisma.stream.create({
            data: {
                schoolId,
                classLevelId: input.classLevelId,
                name: input.name,
            },
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Stream',
            entityId: stream.id,
            metadata: { name: stream.name },
            ipAddress,
            userAgent,
        });

        return stream;
    }

    // --- SUBJECTS & ASSIGNMENTS ---

    static async createSubject(input, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;

        const subject = await prisma.subject.create({
            data: {
                schoolId,
                name: input.name,
                code: input.code,
                curriculum: input.curriculum,
            },
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Subject',
            entityId: subject.id,
            metadata: { code: subject.code, name: subject.name },
            ipAddress,
            userAgent,
        });

        return subject;
    }

    static async listSubjects(schoolId) {
        return prisma.subject.findMany({
            where: { schoolId },
            orderBy: { code: 'asc' },
        });
    }

    static async assignTeacherSubject({ teacherId, subjectId }) {
        return prisma.teacherSubject.create({
            data: { teacherId, subjectId },
        });
    }

    static async assignClassSubject({ streamId, subjectId, teacherId }, actor) {
        const schoolId = actor.schoolId;

        return prisma.classSubject.create({
            data: {
                schoolId,
                streamId,
                subjectId,
                teacherId,
            },
            include: {
                stream: true,
                subject: true,
                teacher: true,
            },
        });
    }

    static async assignClassSubjectWithWorkloadCheck({ streamId, subjectId, teacherId }, actor) {
        const schoolId = actor.schoolId;

        // Check how many subjects teacher currently handles in active streams
        const activeAssignments = await prisma.classSubject.count({
            where: { schoolId, teacherId },
        });

        const MAX_RECOMMENDED_WORKLOAD = 10; // Max class-subject contact allocations
        if (activeAssignments >= MAX_RECOMMENDED_WORKLOAD) {
            throw new BadRequestError(`Teacher exceeds recommended contact allocation ceiling (${MAX_RECOMMENDED_WORKLOAD} classes)`);
        }

        return prisma.classSubject.create({
            data: { schoolId, streamId, subjectId, teacherId },
            include: { stream: true, subject: true, teacher: true },
        });
    }
}

