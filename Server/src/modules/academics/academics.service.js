import { prisma, runTransaction } from '../../config/prisma.js';
import { recordAudit } from '../../shared/audit.js';
import {
    BadRequestError,
    NotFoundError,
    ConflictError,
} from '../../shared/errors/AppError.js';
import { assertOwnership, resolveSchoolId } from '../../shared/ownership.js';

const MAX_WORKLOAD_ASSIGNMENTS = 12;
const PROMOTION_BATCH_LIMIT = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUniqueError(err) {
    return err?.code === 'P2002';
}

function uniqueErrorMessage(err, fallback) {
    const target = err?.meta?.target;
    if (Array.isArray(target) && target.length) {
        return `${fallback} (unique constraint: ${target.join(', ')})`;
    }
    return fallback;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AcademicsService {
    // =========================================================================
    // ACADEMIC YEARS
    // =========================================================================

    static async createAcademicYear(input, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor, input.schoolId);

        try {
            const result = await runTransaction(async (tx) => {
                // Lock the school row so concurrent isCurrent:true writes serialize.
                await tx.$queryRaw`SELECT id FROM schools WHERE id = ${schoolId}::uuid FOR UPDATE`;

                if (input.isCurrent) {
                    await tx.academicYear.updateMany({
                        where: { schoolId, isCurrent: true },
                        data: { isCurrent: false },
                    });
                }

                const year = await tx.academicYear.create({
                    data: {
                        schoolId,
                        name: input.name,
                        startDate: new Date(`${input.startDate}T00:00:00Z`),
                        endDate: new Date(`${input.endDate}T00:00:00Z`),
                        isCurrent: input.isCurrent,
                    },
                });

                await recordAudit(
                    {
                        action: 'CREATE',
                        actorId: actor.id,
                        schoolId,
                        entityType: 'AcademicYear',
                        entityId: year.id,
                        metadata: { name: year.name, isCurrent: year.isCurrent },
                        ...ctx,
                    },
                    tx,
                );

                return year;
            });

            return result;
        } catch (err) {
            if (isUniqueError(err)) {
                throw new ConflictError(
                    uniqueErrorMessage(err, 'An academic year with this name already exists'),
                );
            }
            throw err;
        }
    }

    static async listAcademicYears(actor, { schoolId: explicit, page, pageSize }) {
        const schoolId = resolveSchoolId(actor, explicit);
        const where = { schoolId };

        const [items, total] = await Promise.all([
            prisma.academicYear.findMany({
                where,
                include: { terms: { orderBy: { startDate: 'asc' } } },
                orderBy: { startDate: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.academicYear.count({ where }),
        ]);

        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    // =========================================================================
    // TERMS
    // =========================================================================

    static async createTerm(input, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor, input.schoolId);

        try {
            return await runTransaction(async (tx) => {
                // Verify academic year belongs to this school AND get its range.
                const year = await tx.academicYear.findFirst({
                    where: { id: input.academicYearId, schoolId },
                    select: { id: true, startDate: true, endDate: true },
                });
                if (!year) {
                    throw new NotFoundError('Academic year not found in this school');
                }

                const termStart = new Date(`${input.startDate}T00:00:00Z`);
                const termEnd = new Date(`${input.endDate}T00:00:00Z`);
                if (termStart < year.startDate || termEnd > year.endDate) {
                    throw new BadRequestError(
                        `Term dates must fall within academic year (${year.startDate.toISOString().slice(0, 10)} → ${year.endDate.toISOString().slice(0, 10)})`,
                    );
                }

                const term = await tx.term.create({
                    data: {
                        schoolId,
                        academicYearId: year.id,
                        name: input.name,
                        startDate: termStart,
                        endDate: termEnd,
                    },
                });

                await recordAudit(
                    {
                        action: 'CREATE',
                        actorId: actor.id,
                        schoolId,
                        entityType: 'Term',
                        entityId: term.id,
                        metadata: { name: term.name, academicYearId: year.id },
                        ...ctx,
                    },
                    tx,
                );

                return term;
            });
        } catch (err) {
            if (isUniqueError(err)) {
                throw new ConflictError('A term with this name already exists for this academic year');
            }
            throw err;
        }
    }

    // =========================================================================
    // CLASS LEVELS
    // =========================================================================

    static async createClassLevel(input, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor, input.schoolId);

        try {
            return await runTransaction(async (tx) => {
                const classLevel = await tx.classLevel.create({
                    data: {
                        schoolId,
                        name: input.name,
                        curriculum: input.curriculum,
                    },
                });

                await recordAudit(
                    {
                        action: 'CREATE',
                        actorId: actor.id,
                        schoolId,
                        entityType: 'ClassLevel',
                        entityId: classLevel.id,
                        metadata: { name: classLevel.name, curriculum: classLevel.curriculum },
                        ...ctx,
                    },
                    tx,
                );

                return classLevel;
            });
        } catch (err) {
            if (isUniqueError(err)) {
                throw new ConflictError('A class level with this name already exists');
            }
            throw err;
        }
    }

    static async listClassLevels(actor, { schoolId: explicit, page, pageSize }) {
        const schoolId = resolveSchoolId(actor, explicit);
        const where = { schoolId };

        const [items, total] = await Promise.all([
            prisma.classLevel.findMany({
                where,
                include: { streams: { orderBy: { name: 'asc' } } },
                orderBy: { name: 'asc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.classLevel.count({ where }),
        ]);

        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    // =========================================================================
    // STREAMS
    // =========================================================================

    static async createStream(input, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor, input.schoolId);

        try {
            return await runTransaction(async (tx) => {
                await assertOwnership(tx, schoolId, [
                    { model: 'classLevel', id: input.classLevelId, label: 'Class level' },
                ]);

                const stream = await tx.stream.create({
                    data: {
                        schoolId,
                        classLevelId: input.classLevelId,
                        name: input.name,
                    },
                });

                await recordAudit(
                    {
                        action: 'CREATE',
                        actorId: actor.id,
                        schoolId,
                        entityType: 'Stream',
                        entityId: stream.id,
                        metadata: { name: stream.name, classLevelId: input.classLevelId },
                        ...ctx,
                    },
                    tx,
                );

                return stream;
            });
        } catch (err) {
            if (isUniqueError(err)) {
                throw new ConflictError('A stream with this name already exists in this class level');
            }
            throw err;
        }
    }

    // =========================================================================
    // SUBJECTS
    // =========================================================================

    static async createSubject(input, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor, input.schoolId);

        try {
            return await runTransaction(async (tx) => {
                const subject = await tx.subject.create({
                    data: {
                        schoolId,
                        name: input.name,
                        code: input.code, // already uppercased by Zod
                        curriculum: input.curriculum,
                    },
                });

                await recordAudit(
                    {
                        action: 'CREATE',
                        actorId: actor.id,
                        schoolId,
                        entityType: 'Subject',
                        entityId: subject.id,
                        metadata: { code: subject.code, name: subject.name },
                        ...ctx,
                    },
                    tx,
                );

                return subject;
            });
        } catch (err) {
            if (isUniqueError(err)) {
                throw new ConflictError('A subject with this code already exists');
            }
            throw err;
        }
    }

    static async listSubjects(actor, { schoolId: explicit, page, pageSize }) {
        const schoolId = resolveSchoolId(actor, explicit);
        const where = { schoolId };

        const [items, total] = await Promise.all([
            prisma.subject.findMany({
                where,
                orderBy: { code: 'asc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.subject.count({ where }),
        ]);

        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    // =========================================================================
    // ASSIGNMENTS
    // =========================================================================

    static async assignTeacherSubject(input, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor, input.schoolId);

        try {
            return await runTransaction(async (tx) => {
                await assertOwnership(tx, schoolId, [
                    { model: 'teacher', id: input.teacherId, label: 'Teacher' },
                    { model: 'subject', id: input.subjectId, label: 'Subject' },
                ]);

                const link = await tx.teacherSubject.create({
                    data: {
                        teacherId: input.teacherId,
                        subjectId: input.subjectId,
                    },
                });

                await recordAudit(
                    {
                        action: 'CREATE',
                        actorId: actor.id,
                        schoolId,
                        entityType: 'TeacherSubject',
                        entityId: `${input.teacherId}_${input.subjectId}`,
                        metadata: { teacherId: input.teacherId, subjectId: input.subjectId },
                        ...ctx,
                    },
                    tx,
                );

                return link;
            });
        } catch (err) {
            if (isUniqueError(err)) {
                throw new ConflictError('Teacher is already assigned to this subject');
            }
            throw err;
        }
    }

    static async assignClassSubject(input, actor, ctx = {}) {
        const schoolId = resolveSchoolId(actor, input.schoolId);
        const { streamId, subjectId, teacherId, enforceWorkload = false } = input;

        try {
            return await runTransaction(async (tx) => {
                await assertOwnership(tx, schoolId, [
                    { model: 'stream', id: streamId, label: 'Stream' },
                    { model: 'subject', id: subjectId, label: 'Subject' },
                    { model: 'teacher', id: teacherId, label: 'Teacher' },
                ]);

                // Serialize workload checks per teacher inside the transaction.
                await tx.$queryRaw`
          SELECT id FROM teachers WHERE id = ${teacherId}::uuid FOR UPDATE
        `;

                if (enforceWorkload) {
                    const count = await tx.classSubject.count({
                        where: { schoolId, teacherId },
                    });
                    if (count >= MAX_WORKLOAD_ASSIGNMENTS) {
                        throw new BadRequestError(
                            `Teacher already has ${count} class-subject assignments; limit is ${MAX_WORKLOAD_ASSIGNMENTS}`,
                        );
                    }
                }

                const classSubject = await tx.classSubject.create({
                    data: { schoolId, streamId, subjectId, teacherId },
                    include: {
                        stream: { select: { id: true, name: true } },
                        subject: { select: { id: true, code: true, name: true } },
                        teacher: { select: { id: true, firstName: true, lastName: true } },
                    },
                });

                await recordAudit(
                    {
                        action: 'CREATE',
                        actorId: actor.id,
                        schoolId,
                        entityType: 'ClassSubject',
                        entityId: classSubject.id,
                        metadata: { streamId, subjectId, teacherId, enforceWorkload },
                        ...ctx,
                    },
                    tx,
                );

                return classSubject;
            });
        } catch (err) {
            if (isUniqueError(err)) {
                throw new ConflictError('This subject is already assigned to this stream');
            }
            throw err;
        }
    }
}