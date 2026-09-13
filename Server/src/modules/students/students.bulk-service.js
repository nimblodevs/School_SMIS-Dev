import * as XLSX from 'xlsx';
import { prisma } from '../../config/prisma.js';
import { bulkStudentRowSchema } from './students.bulk-validation.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class BulkAdmissionService {
    /**
     * Parses file buffer, validates each row against the schema and existing DB constraints,
     * then atomically admits valid records.
     */
    static async processBulkAdmission(fileBuffer, mimetype, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

        // 1. Parse Excel / CSV File Buffer
        const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });

        if (!rawData.length) {
            throw new BadRequestError('Uploaded file contains no data rows');
        }

        const validationErrors = [];
        const validRows = [];

        // Pre-fetch existing unique IDs in school to optimize validation
        const existingStudents = await prisma.student.findMany({
            where: { schoolId },
            select: { nationalIdNumber: true, birthCertificateNumber: true },
        });

        const existingNationalIds = new Set(existingStudents.map((s) => s.nationalIdNumber));
        const existingBirthCerts = new Set(existingStudents.map((s) => s.birthCertificateNumber));

        // 2. Validate Row-by-Row
        for (let index = 0; index < rawData.length; index++) {
            const rowNum = index + 2; // Row 1 is header
            const row = rawData[index];

            // Structural Validation via Zod
            const parsed = bulkStudentRowSchema.safeParse(row);
            if (!parsed.success) {
                const fieldErrors = parsed.error.flatten().fieldErrors;
                validationErrors.push({
                    row: rowNum,
                    errors: Object.entries(fieldErrors).map(([field, msgs]) => `${field}: ${msgs.join(', ')}`),
                });
                continue;
            }

            const data = parsed.data;
            const rowErrors = [];

            // Duplicate Check against Database
            if (existingNationalIds.has(data.nationalIdNumber)) {
                rowErrors.push(`National ID '${data.nationalIdNumber}' already exists in database`);
            }
            if (existingBirthCerts.has(data.birthCertificateNumber)) {
                rowErrors.push(`Birth Cert '${data.birthCertificateNumber}' already exists in database`);
            }

            if (rowErrors.length > 0) {
                validationErrors.push({ row: rowNum, errors: rowErrors });
            } else {
                // Track unique values locally to prevent duplicates within the same upload file
                existingNationalIds.add(data.nationalIdNumber);
                existingBirthCerts.add(data.birthCertificateNumber);
                validRows.push({ data, rowNum });
            }
        }

        // 3. Reject entire file if errors exist
        if (validationErrors.length > 0) {
            return {
                success: false,
                totalRows: rawData.length,
                failedRows: validationErrors.length,
                passedRows: 0,
                errors: validationErrors,
            };
        }

        // 4. Atomic Database Insert
        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { schoolCode: true },
        });

        const currentYear = new Date().getFullYear();
        const startSequence = await prisma.student.count({ where: { schoolId } });

        const createdStudents = await prisma.$transaction(async (tx) => {
            const results = [];

            for (let i = 0; i < validRows.length; i++) {
                const { data } = validRows[i];
                const sequenceNo = startSequence + i + 1;
                const admissionNo = `${school.schoolCode || 'SCH'}/${currentYear}/${String(sequenceNo).padStart(4, '0')}`;

                // Create Student
                const student = await tx.student.create({
                    data: {
                        schoolId,
                        admissionNo,
                        firstName: data.firstName,
                        middleName: data.middleName,
                        lastName: data.lastName,
                        gender: data.gender,
                        dateOfBirth: new Date(data.dateOfBirth),
                        nationalIdNumber: data.nationalIdNumber,
                        birthCertificateNumber: data.birthCertificateNumber,
                        passportNumber: data.passportNumber,
                    },
                });

                // Create Initial Active Enrollment
                await tx.enrollment.create({
                    data: {
                        schoolId,
                        studentId: student.id,
                        streamId: data.streamId,
                        academicYearId: data.academicYearId,
                        status: 'ACTIVE',
                    },
                });

                // Optionally link parent if Parent National ID is provided
                if (data.parentNationalId) {
                    const parent = await tx.parent.findFirst({
                        where: { schoolId, nationalIdNumber: data.parentNationalId },
                        select: { id: true },
                    });

                    if (parent) {
                        await tx.studentParent.create({
                            data: { studentId: student.id, parentId: parent.id },
                        });
                    }
                }

                results.push(student);
            }

            return results;
        });

        await recordAudit({
            action: 'CREATE',
            actorId: actor.id,
            schoolId,
            entityType: 'Student',
            entityId: schoolId,
            metadata: { bulkCount: createdStudents.length },
            ipAddress,
            userAgent,
        });

        return {
            success: true,
            totalRows: rawData.length,
            admittedCount: createdStudents.length,
            students: createdStudents.map((s) => ({ id: s.id, admissionNo: s.admissionNo, name: `${s.firstName} ${s.lastName}` })),
        };
    }
}