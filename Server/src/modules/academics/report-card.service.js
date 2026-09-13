import { prisma } from '../../config/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AppError.js';

// Ordinal levels. We do NOT average these; we report distributions.
const CBC_LEVELS = [
    'EXCEEDING_EXPECTATION',
    'MEETING_EXPECTATION',
    'APPROACHING_EXPECTATION',
    'BELOW_EXPECTATION',
];

function average(values) {
    if (!values.length) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Sample SD (N-1). Returns null for fewer than 2 points.
function sampleStandardDeviation(values) {
    if (values.length < 2) return null;
    const mean = average(values);
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/**
 * Determines which students the actor is allowed to see in a report.
 * - ADMIN / MANAGER / TEACHER / BURSAR / SUPER_ADMIN: all students in school
 * - PARENT: only their linked students
 * - STUDENT: only themselves
 */
async function resolveVisibleStudentIds(actor, schoolId) {
    if (['ADMIN', 'MANAGER', 'TEACHER', 'BURSAR', 'SUPER_ADMIN'].includes(actor.role)) {
        return null; // no filter
    }

    if (actor.role === 'PARENT') {
        const parent = await prisma.parent.findFirst({
            where: { userId: actor.id, schoolId },
            select: { students: { select: { studentId: true } } },
        });
        if (!parent) return [];
        return parent.students.map((s) => s.studentId);
    }

    if (actor.role === 'STUDENT') {
        const student = await prisma.student.findFirst({
            where: { userId: actor.id, schoolId },
            select: { id: true },
        });
        return student ? [student.id] : [];
    }

    return []; // unknown role sees nothing
}

export class ReportCardService {
    /**
     * @param {string} termId
     * @param {object} actor
     * @param {object} [options]
     * @param {string|null} [options.studentId]  when provided, restrict to this student
     * @param {'STREAM'|'CLASS_LEVEL'} [options.rankBy='STREAM']
     */
    static async generateTermReports(termId, actor, options = {}) {
        const { studentId = null, rankBy = 'STREAM' } = options;
        const schoolId = actor.schoolId;
        if (!schoolId) throw new ForbiddenError('User is not associated with a school');

        const term = await prisma.term.findFirst({
            where: { id: termId, schoolId },
            include: { academicYear: true },
        });
        if (!term) throw new NotFoundError('Academic term not found');

        // ---- Role-scoped visibility ----
        const visibleStudentIds = await resolveVisibleStudentIds(actor, schoolId);
        if (visibleStudentIds !== null && studentId && !visibleStudentIds.includes(studentId)) {
            throw new ForbiddenError('You do not have access to this student');
        }
        const effectiveStudentIds =
            visibleStudentIds === null
                ? studentId
                    ? [studentId]
                    : null
                : studentId
                    ? [studentId]
                    : visibleStudentIds;

        // ---- Fetch enrollments ----
        const enrollmentWhere = {
            schoolId,
            academicYearId: term.academicYearId,
            status: { in: ['ACTIVE', 'COMPLETED'] }, // include those who finished mid-year
        };
        if (effectiveStudentIds !== null) {
            enrollmentWhere.studentId = { in: effectiveStudentIds };
        }

        const enrollments = await prisma.enrollment.findMany({
            where: enrollmentWhere,
            include: { student: true, stream: { include: { classLevel: true } } },
        });

        if (studentId && enrollments.length === 0) {
            throw new NotFoundError('Student is not enrolled in this academic year');
        }

        const enrollmentIds = enrollments.map((e) => e.id);
        if (enrollmentIds.length === 0) {
            return {
                term: { id: term.id, name: term.name, academicYear: term.academicYear.name },
                classSize: 0,
                reports: [],
            };
        }

        // ---- Fetch exam results + CBC assessments in parallel ----
        const [results, cbcAssessments] = await Promise.all([
            prisma.examResult.findMany({
                where: {
                    schoolId,
                    enrollmentId: { in: enrollmentIds },
                    exam: { termId },
                },
                include: { exam: { include: { subject: true } } },
            }),
            prisma.competencyAssessment.findMany({
                where: {
                    schoolId,
                    termId,
                    enrollmentId: { in: enrollmentIds },
                },
                orderBy: { assessedAt: 'desc' },
                include: {
                    subStrand: { include: { strand: { include: { learningArea: true } } } },
                },
            }),
        ]);

        // ---- Build per-student rows ----
        const rowsByStudent = new Map(
            enrollments.map((enrollment) => [
                enrollment.studentId,
                {
                    student: enrollment.student,
                    enrollment,
                    subjectScores: new Map(),
                    competencyHistory: [],
                },
            ]),
        );

        for (const result of results) {
            const row = rowsByStudent.get(result.studentId);
            if (!row) continue;
            const max = Number(result.exam.maxScore);
            const pct = max > 0 ? (Number(result.score) / max) * 100 : 0;
            const bucket = row.subjectScores.get(result.exam.subjectId) ?? {
                subject: result.exam.subject,
                scores: [],
            };
            bucket.scores.push(pct);
            row.subjectScores.set(result.exam.subjectId, bucket);
        }

        // Latest assessment per (student, subStrand)
        const seen = new Set();
        for (const assessment of cbcAssessments) {
            const key = `${assessment.studentId}:${assessment.subStrandId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            rowsByStudent.get(assessment.studentId)?.competencyHistory.push(assessment);
        }

        // ---- Shape reports ----
        const reports = [...rowsByStudent.values()].map((row) => {
            const subjects = [...row.subjectScores.values()].map((bucket) => ({
                subject: bucket.subject,
                average: average(bucket.scores),
                standardDeviation: sampleStandardDeviation(bucket.scores),
                assessmentCount: bucket.scores.length,
            }));

            const subjectAverages = subjects
                .map((s) => s.average)
                .filter((v) => v !== null);

            // CBC: report distribution, not a meaningless average of ordinals
            const cbcByLearningArea = new Map();
            for (const assessment of row.competencyHistory) {
                const area = assessment.subStrand.strand.learningArea;
                const summary = cbcByLearningArea.get(area.id) ?? {
                    learningArea: { id: area.id, name: area.name },
                    distribution: Object.fromEntries(CBC_LEVELS.map((l) => [l, 0])),
                    totalAssessments: 0,
                };
                summary.distribution[assessment.level] += 1;
                summary.totalAssessments += 1;
                cbcByLearningArea.set(area.id, summary);
            }

            return {
                student: row.student,
                enrollment: {
                    id: row.enrollment.id,
                    streamId: row.enrollment.streamId,
                    stream: row.enrollment.stream.name,
                    classLevel: row.enrollment.stream.classLevel.name,
                },
                subjects,
                overallAverage: average(subjectAverages),
                cbc: [...cbcByLearningArea.values()],
                // Rank populated in the next pass
                classRank: null,
                rankGroupSize: null,
            };
        });

        // ---- Ranking ----
        const groupKey = (report) =>
            rankBy === 'CLASS_LEVEL'
                ? report.enrollment.classLevel
                : report.enrollment.streamId;

        const groups = new Map();
        for (const report of reports) {
            const k = groupKey(report);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(report);
        }

        for (const group of groups.values()) {
            const rankable = group
                .filter((r) => r.overallAverage !== null)
                .sort((a, b) => b.overallAverage - a.overallAverage);

            // Everyone in the group gets rankGroupSize; unranked get null rank.
            for (const report of group) {
                report.rankGroupSize = group.length;
            }

            let lastAvg = null;
            let lastRank = 0;
            rankable.forEach((report, index) => {
                // Tie-aware: same average → same rank
                if (lastAvg !== null && report.overallAverage === lastAvg) {
                    report.classRank = lastRank;
                } else {
                    report.classRank = index + 1;
                    lastAvg = report.overallAverage;
                    lastRank = report.classRank;
                }
            });
        }

        // ---- Optional student filter for output ----
        const output = studentId
            ? reports.filter((r) => r.student.id === studentId)
            : reports;

        return {
            term: { id: term.id, name: term.name, academicYear: term.academicYear.name },
            rankBy,
            classSize: reports.length, // full population, not filtered
            reports: output,
        };
    }
}