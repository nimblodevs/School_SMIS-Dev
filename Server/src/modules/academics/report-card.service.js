import { NotFoundError } from '../../shared/errors/AppError.js';
import { prisma } from '../../config/prisma.js';

const competencyWeight = {
    EXCEEDING_EXPECTATION: 4,
    MEETING_EXPECTATION: 3,
    APPROACHING_EXPECTATION: 2,
    BELOW_EXPECTATION: 1,
};

function average(values) {
    if (!values.length) return null;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values) {
    if (values.length < 2) return 0;
    const mean = average(values);
    return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

export class ReportCardService {
    static async generateTermReports(termId, actor, studentId = null) {
        const schoolId = actor.schoolId;
        const term = await prisma.term.findFirst({
            where: { id: termId, schoolId },
            include: { academicYear: true },
        });
        if (!term) throw new NotFoundError('Academic term not found');

        const enrollments = await prisma.enrollment.findMany({
            where: {
                schoolId,
                academicYearId: term.academicYearId,
            },
            include: { student: true, stream: { include: { classLevel: true } } },
        });
        if (studentId && !enrollments.some((enrollment) => enrollment.studentId === studentId)) {
            throw new NotFoundError('Student is not enrolled in this academic year');
        }

        const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
        const exams = await prisma.exam.findMany({
            where: { schoolId, termId },
            include: { subject: true },
        });
        const examIds = exams.map((exam) => exam.id);
        const results = examIds.length
            ? await prisma.examResult.findMany({
                where: { schoolId, examId: { in: examIds }, enrollmentId: { in: enrollmentIds } },
                include: { exam: { include: { subject: true } }, student: true },
            })
            : [];

        const cbcAssessments = enrollmentIds.length
            ? await prisma.competencyAssessment.findMany({
                where: { schoolId, termId, enrollmentId: { in: enrollmentIds } },
                orderBy: { assessedAt: 'desc' },
                include: {
                    student: true,
                    subStrand: { include: { strand: { include: { learningArea: true } } } },
                },
            })
            : [];

        const rowsByStudent = new Map(enrollments.map((enrollment) => [enrollment.studentId, {
            student: enrollment.student,
            enrollment,
            subjectScores: new Map(),
            competencyHistory: [],
        }]));

        for (const result of results) {
            const row = rowsByStudent.get(result.studentId);
            if (!row) continue;
            const percentage = Number(result.exam.maxScore) > 0
                ? (Number(result.score) / Number(result.exam.maxScore)) * 100
                : 0;
            const subject = row.subjectScores.get(result.exam.subjectId) || {
                subject: result.exam.subject,
                scores: [],
            };
            subject.scores.push(percentage);
            row.subjectScores.set(result.exam.subjectId, subject);
        }

        const latestBySubStrand = new Set();
        for (const assessment of cbcAssessments) {
            const key = `${assessment.studentId}:${assessment.subStrandId}`;
            if (latestBySubStrand.has(key)) continue;
            latestBySubStrand.add(key);
            rowsByStudent.get(assessment.studentId)?.competencyHistory.push(assessment);
        }

        const reports = [...rowsByStudent.values()].map((row) => {
            const subjects = [...row.subjectScores.values()].map((subject) => ({
                subject: subject.subject,
                average: average(subject.scores),
                standardDeviation: standardDeviation(subject.scores),
                assessmentCount: subject.scores.length,
            }));
            const subjectAverages = subjects.map((subject) => subject.average).filter((value) => value !== null);
            const cbcByLearningArea = new Map();
            for (const assessment of row.competencyHistory) {
                const area = assessment.subStrand.strand.learningArea;
                const summary = cbcByLearningArea.get(area.id) || { learningArea: area, levels: {}, scores: [] };
                summary.levels[assessment.level] = (summary.levels[assessment.level] || 0) + 1;
                summary.scores.push(competencyWeight[assessment.level]);
                cbcByLearningArea.set(area.id, summary);
            }

            return {
                student: row.student,
                enrollment: row.enrollment,
                subjects,
                overallAverage: average(subjectAverages),
                cbc: [...cbcByLearningArea.values()].map((summary) => ({
                    ...summary,
                    averageLevel: average(summary.scores),
                    historyCount: summary.scores.length,
                    scores: undefined,
                })),
            };
        });

        const rankGroups = new Map();
        for (const report of reports) {
            const group = rankGroups.get(report.enrollment.streamId) || [];
            group.push(report);
            rankGroups.set(report.enrollment.streamId, group);
        }
        for (const group of rankGroups.values()) {
            const rankable = group.filter((report) => report.overallAverage !== null)
                .sort((left, right) => right.overallAverage - left.overallAverage);
            rankable.forEach((report, index) => {
                report.classRank = index > 0 && report.overallAverage === rankable[index - 1].overallAverage
                    ? rankable[index - 1].classRank
                    : index + 1;
                report.classSize = group.length;
            });
        }

        return {
            term: { id: term.id, name: term.name, academicYear: term.academicYear.name },
            classSize: reports.length,
            reports: studentId ? reports.filter((report) => report.student.id === studentId) : reports,
        };
    }
}
