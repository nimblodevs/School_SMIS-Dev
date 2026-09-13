import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { StorageService } from './storage.service.js';
import { ReportCardService } from '../academics/report-card.service.js';
import { NotFoundError } from '../../shared/errors/AppError.js';

function makePdf(title, lines) {
    return new Promise((resolve) => {
        const document = new PDFDocument({ margin: 48 });
        const chunks = [];
        document.on('data', (chunk) => chunks.push(chunk));
        document.on('end', () => resolve(Buffer.concat(chunks)));
        document.fontSize(18).text(title).moveDown();
        document.fontSize(10);
        for (const line of lines) document.text(line);
        document.end();
    });
}

export class DocumentService {
    static async processImage(fileUploadId, actor) {
        const file = await prisma.fileUpload.findFirst({ where: { id: fileUploadId, schoolId: actor.schoolId } });
        if (!file) throw new NotFoundError('File upload not found');
        const source = await StorageService.downloadFile(file.storageKey, actor.schoolId);
        const resized = await sharp(source).resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        return StorageService.uploadGeneratedFile({
            storageKey: `${actor.schoolId}/processed/${file.id}.jpg`,
            originalName: `${file.originalName.replace(/\.[^.]+$/, '')}.jpg`,
            mimeType: 'image/jpeg',
            body: resized,
            relatedType: file.relatedType,
            relatedId: file.relatedId,
        }, actor);
    }

    static async generateReportCardPdf({ termId, studentId }, actor) {
        const report = await ReportCardService.generateTermReports(termId, actor, studentId);
        const item = report.reports[0];
        if (!item) throw new NotFoundError('Report card data not found');
        const lines = [
            `Student: ${item.student.firstName} ${item.student.lastName}`,
            `Admission number: ${item.student.admissionNo}`,
            `Term: ${report.term.name} (${report.term.academicYear})`,
            `Class rank: ${item.classRank || 'Not ranked'}/${report.classSize}`,
            `Overall average: ${item.overallAverage?.toFixed(2) || 'N/A'}%`,
            '',
            ...item.subjects.map((subject) => `${subject.subject.name}: ${subject.average?.toFixed(2) || 'N/A'}% (SD ${subject.standardDeviation.toFixed(2)})`),
            '',
            ...item.cbc.map((area) => `CBC ${area.learningArea.name}: level ${area.averageLevel.toFixed(2)} across ${area.historyCount} historical assessments`),
        ];
        const body = await makePdf('School SMIS Term Report Card', lines);
        return StorageService.uploadGeneratedFile({
            storageKey: `${actor.schoolId}/reports/${termId}/${studentId}-${randomUUID()}.pdf`,
            originalName: `${item.student.admissionNo}-${report.term.name}-report-card.pdf`,
            mimeType: 'application/pdf',
            body,
            relatedType: 'REPORT_CARD',
            relatedId: studentId,
        }, actor);
    }

    static async generatePayslipPdf(payslipId, actor) {
        const payslip = await prisma.payslip.findFirst({
            where: { id: payslipId, schoolId: actor.schoolId },
            include: { payrollRun: true, teacher: { include: { user: true } }, staff: { include: { user: true } } },
        });
        if (!payslip) throw new NotFoundError('Payslip not found');
        const profile = payslip.teacher || payslip.staff;
        const body = await makePdf('School SMIS Payslip', [
            `Employee: ${profile.firstName} ${profile.lastName}`,
            `Payroll month: ${payslip.payrollRun.month}`,
            `Employee key: ${payslip.employeeKey}`,
            `Basic pay: ${payslip.basicPay}`,
            `Gross pay: ${payslip.grossPay}`,
            `Deductions: ${payslip.totalDeductions}`,
            `Net pay: ${payslip.netPay}`,
        ]);
        return StorageService.uploadGeneratedFile({
            storageKey: `${actor.schoolId}/payslips/${payslip.payrollRun.month}/${payslip.employeeKey}-${randomUUID()}.pdf`,
            originalName: `${payslip.employeeKey}-${payslip.payrollRun.month}-payslip.pdf`,
            mimeType: 'application/pdf',
            body,
            relatedType: 'PAYSLIP',
            relatedId: payslip.id,
        }, actor);
    }
}
