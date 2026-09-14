import ExcelJS from 'exceljs';
import { parse } from '@fast-csv/parse';
import { Readable } from 'node:stream';
import { createInflateRaw } from 'node:zlib';
import { prisma, runTransaction } from '../../config/prisma.js';
import { bulkStudentRowSchema } from './students.bulk-validation.js';
import { recordAudit } from '../../shared/audit.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { nextAdmissionNo } from '../../shared/sequences.js';

const MAX_IMPORT_ROWS = 1_000;
const MAX_IMPORT_COLUMNS = 32;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_XLSX_ENTRIES = 100;
const MAX_XLSX_ENTRY_BYTES = 10 * 1024 * 1024;
const MAX_XLSX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

function findEndOfCentralDirectory(buffer) {
    const earliestOffset = Math.max(0, buffer.length - 22 - 0xffff);
    for (let offset = buffer.length - 22; offset >= earliestOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
    }
    return -1;
}

export function validateXlsxArchive(buffer) {
    if (buffer.length > MAX_FILE_BYTES) {
        throw new BadRequestError('The uploaded file exceeds the 5 MB limit');
    }
    if (buffer.length < 22 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        throw new BadRequestError('The uploaded XLSX file has an invalid signature');
    }

    const eocdOffset = findEndOfCentralDirectory(buffer);
    if (eocdOffset < 0) throw new BadRequestError('The uploaded XLSX archive is malformed');

    const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
    const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
    const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
    if (
        diskNumber !== 0 ||
        centralDirectoryDisk !== 0 ||
        entriesOnDisk === 0xffff ||
        entryCount === 0xffff ||
        centralDirectorySize === 0xffffffff ||
        centralDirectoryOffset === 0xffffffff
    ) {
        throw new BadRequestError('Multi-disk and ZIP64 XLSX archives are not supported');
    }
    if (entriesOnDisk !== entryCount) {
        throw new BadRequestError('Multi-disk XLSX archives are not supported');
    }
    if (entryCount > MAX_XLSX_ENTRIES) {
        throw new BadRequestError(`XLSX archives are limited to ${MAX_XLSX_ENTRIES} entries`);
    }
    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
    if (centralDirectoryEnd !== eocdOffset) {
        throw new BadRequestError('The uploaded XLSX central directory is malformed');
    }

    let offset = centralDirectoryOffset;
    let parsedEntries = 0;
    let totalUncompressedBytes = 0;
    const entries = [];
    while (offset < centralDirectoryEnd) {
        if (parsedEntries >= MAX_XLSX_ENTRIES) {
            throw new BadRequestError(`XLSX archives are limited to ${MAX_XLSX_ENTRIES} entries`);
        }
        if (offset + 46 > centralDirectoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new BadRequestError('The uploaded XLSX central directory is malformed');
        }

        const flags = buffer.readUInt16LE(offset + 8);
        const compressionMethod = buffer.readUInt16LE(offset + 10);
        const compressedBytes = buffer.readUInt32LE(offset + 20);
        const uncompressedBytes = buffer.readUInt32LE(offset + 24);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);

        if (flags & 0x1) throw new BadRequestError('Encrypted XLSX archives are not supported');
        if (![0, 8].includes(compressionMethod)) {
            throw new BadRequestError('The XLSX archive uses an unsupported compression method');
        }
        if (compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff) {
            throw new BadRequestError('ZIP64 XLSX entries are not supported');
        }
        if (uncompressedBytes > MAX_XLSX_ENTRY_BYTES) {
            throw new BadRequestError('An XLSX archive entry exceeds the 10 MB limit');
        }
        if (
            compressedBytes > 0 &&
            uncompressedBytes > 1024 * 1024 &&
            uncompressedBytes / compressedBytes > MAX_COMPRESSION_RATIO
        ) {
            throw new BadRequestError('The XLSX archive compression ratio is unsafe');
        }

        totalUncompressedBytes += uncompressedBytes;
        if (totalUncompressedBytes > MAX_XLSX_UNCOMPRESSED_BYTES) {
            throw new BadRequestError('The expanded XLSX archive exceeds the 25 MB limit');
        }

        if (
            localHeaderOffset + 30 > centralDirectoryOffset ||
            buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50
        ) {
            throw new BadRequestError('The uploaded XLSX local file header is malformed');
        }
        const localFlags = buffer.readUInt16LE(localHeaderOffset + 6);
        const localCompressionMethod = buffer.readUInt16LE(localHeaderOffset + 8);
        const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
        const dataEnd = dataStart + compressedBytes;
        if (
            localFlags & 0x1 ||
            localCompressionMethod !== compressionMethod ||
            dataStart > centralDirectoryOffset ||
            dataEnd > centralDirectoryOffset
        ) {
            throw new BadRequestError('The uploaded XLSX local file header is inconsistent');
        }
        entries.push({
            compressionMethod,
            compressedBytes,
            uncompressedBytes,
            dataStart,
            dataEnd,
        });
        offset += 46 + fileNameLength + extraLength + commentLength;
        parsedEntries += 1;
    }
    if (
        offset !== centralDirectoryEnd ||
        parsedEntries !== entriesOnDisk ||
        parsedEntries !== entryCount
    ) {
        throw new BadRequestError('The uploaded XLSX central directory is malformed');
    }
    return entries;
}

async function validateXlsxInflation(buffer, entries) {
    let totalInflatedBytes = 0;

    for (const entry of entries) {
        let entryInflatedBytes = 0;
        const countOutput = (byteLength) => {
            entryInflatedBytes += byteLength;
            totalInflatedBytes += byteLength;
            if (entryInflatedBytes > MAX_XLSX_ENTRY_BYTES) {
                throw new BadRequestError('An XLSX archive entry exceeds the 10 MB limit');
            }
            if (totalInflatedBytes > MAX_XLSX_UNCOMPRESSED_BYTES) {
                throw new BadRequestError('The expanded XLSX archive exceeds the 25 MB limit');
            }
            if (
                entryInflatedBytes > 1024 * 1024 &&
                (entry.compressedBytes === 0 ||
                    entryInflatedBytes / entry.compressedBytes > MAX_COMPRESSION_RATIO)
            ) {
                throw new BadRequestError('The XLSX archive compression ratio is unsafe');
            }
        };

        const compressedData = buffer.subarray(entry.dataStart, entry.dataEnd);
        if (entry.compressionMethod === 0) {
            countOutput(compressedData.length);
        } else {
            const inflater = createInflateRaw();
            try {
                for await (const chunk of Readable.from([compressedData]).pipe(inflater)) {
                    countOutput(chunk.length);
                }
            } catch (error) {
                inflater.destroy();
                if (error instanceof BadRequestError) throw error;
                throw new BadRequestError('The uploaded XLSX archive contains invalid data');
            }
        }

        if (entryInflatedBytes !== entry.uncompressedBytes) {
            throw new BadRequestError('The uploaded XLSX entry size metadata is inconsistent');
        }
    }
}

function normalizeCellValue(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value !== 'object') return String(value).trim();
    if ('result' in value) return normalizeCellValue(value.result);
    if ('text' in value) return String(value.text).trim();
    if (Array.isArray(value.richText)) {
        return value.richText
            .map(({ text }) => text)
            .join('')
            .trim();
    }
    return '';
}

function validateHeaders(headers) {
    if (headers.length > MAX_IMPORT_COLUMNS) {
        throw new BadRequestError(`Bulk imports are limited to ${MAX_IMPORT_COLUMNS} columns`);
    }
    if (headers.some((header) => !header)) {
        throw new BadRequestError('Every import column must have a header');
    }
    if (new Set(headers).size !== headers.length) {
        throw new BadRequestError('Import column headers must be unique');
    }
}

function parseCsv(fileBuffer) {
    return new Promise((resolve, reject) => {
        let headers;
        const rows = [];
        let settled = false;
        const input = Readable.from([fileBuffer]);
        const parser = parse({ headers: false, ignoreEmpty: true, trim: true });

        const fail = (error) => {
            if (settled) return;
            settled = true;
            input.destroy();
            parser.destroy();
            reject(error);
        };

        parser.on('data', (values) => {
            try {
                if (!headers) {
                    headers = values.map(normalizeCellValue);
                    validateHeaders(headers);
                    return;
                }
                if (values.length > headers.length || values.length > MAX_IMPORT_COLUMNS) {
                    throw new BadRequestError(
                        'CSV rows cannot contain more columns than the header',
                    );
                }
                if (rows.length >= MAX_IMPORT_ROWS) {
                    throw new BadRequestError(
                        `Bulk imports are limited to ${MAX_IMPORT_ROWS} data rows`,
                    );
                }

                const record = Object.fromEntries(
                    headers.map((header, index) => [header, normalizeCellValue(values[index])]),
                );
                if (Object.values(record).some(Boolean)) rows.push(record);
            } catch (error) {
                fail(error);
            }
        });
        parser.on('error', (error) => {
            fail(
                error instanceof BadRequestError
                    ? error
                    : new BadRequestError('The uploaded CSV file is malformed'),
            );
        });
        parser.on('end', () => {
            if (settled) return;
            settled = true;
            resolve(rows);
        });
        input.on('error', fail);
        input.pipe(parser);
    });
}

export async function parseSpreadsheet(fileBuffer, mimetype) {
    if (fileBuffer.length > MAX_FILE_BYTES) {
        throw new BadRequestError('The uploaded file exceeds the 5 MB limit');
    }
    if (mimetype === 'text/csv') {
        return parseCsv(fileBuffer);
    }

    const entries = validateXlsxArchive(fileBuffer);
    await validateXlsxInflation(fileBuffer, entries);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.actualRowCount < 2) return [];
    if (worksheet.actualRowCount - 1 > MAX_IMPORT_ROWS) {
        throw new BadRequestError(`Bulk imports are limited to ${MAX_IMPORT_ROWS} data rows`);
    }
    if (worksheet.actualColumnCount > MAX_IMPORT_COLUMNS) {
        throw new BadRequestError(`Bulk imports are limited to ${MAX_IMPORT_COLUMNS} columns`);
    }

    const headerRow = worksheet.getRow(1);
    const headers = Array.from({ length: worksheet.actualColumnCount }, (_, index) =>
        normalizeCellValue(headerRow.getCell(index + 1).value),
    );
    validateHeaders(headers);

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record = Object.fromEntries(
            headers.map((header, index) => [
                header,
                normalizeCellValue(row.getCell(index + 1).value),
            ]),
        );
        if (Object.values(record).some(Boolean)) rows.push(record);
    });
    return rows;
}

export class BulkAdmissionService {
    /**
     * Parses file buffer, validates each row against the schema and existing DB constraints,
     * then atomically admits valid records.
     */
    static async processBulkAdmission(fileBuffer, mimetype, actor, { ipAddress, userAgent } = {}) {
        const schoolId = actor.schoolId;
        if (!schoolId) throw new BadRequestError('User context must belong to a school');

        // 1. Parse Excel / CSV File Buffer
        const rawData = await parseSpreadsheet(fileBuffer, mimetype);

        if (!rawData.length) {
            throw new BadRequestError('Uploaded file contains no data rows');
        }

        const validationErrors = [];
        const validRows = [];

        // Pre-fetch existing unique IDs in school to optimize validation
        const existingStudents = await prisma.student.findMany({
            where: { schoolId },
            select: { nationalIdNumber: true, birthCertificateNumber: true, passportNumber: true },
        });

        const existingNationalIds = new Set(existingStudents.map((s) => s.nationalIdNumber));
        const existingBirthCerts = new Set(existingStudents.map((s) => s.birthCertificateNumber));
        const existingPassports = new Set(
            existingStudents.map((s) => s.passportNumber).filter(Boolean),
        );

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
                    errors: Object.entries(fieldErrors).map(
                        ([field, msgs]) => `${field}: ${msgs.join(', ')}`,
                    ),
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
                rowErrors.push(
                    `Birth Cert '${data.birthCertificateNumber}' already exists in database`,
                );
            }
            if (data.passportNumber && existingPassports.has(data.passportNumber)) {
                rowErrors.push(`Passport '${data.passportNumber}' already exists in database`);
            }

            if (rowErrors.length > 0) {
                validationErrors.push({ row: rowNum, errors: rowErrors });
            } else {
                // Track unique values locally to prevent duplicates within the same upload file
                existingNationalIds.add(data.nationalIdNumber);
                existingBirthCerts.add(data.birthCertificateNumber);
                if (data.passportNumber) existingPassports.add(data.passportNumber);
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

        const createdStudents = await runTransaction(async (tx) => {
            const results = [];

            const placementIds = validRows.reduce(
                (ids, { data }) => {
                    ids.streamIds.add(data.streamId);
                    ids.academicYearIds.add(data.academicYearId);
                    return ids;
                },
                { streamIds: new Set(), academicYearIds: new Set() },
            );
            const [streams, academicYears] = await Promise.all([
                tx.stream.findMany({
                    where: { schoolId, id: { in: [...placementIds.streamIds] } },
                    select: { id: true },
                }),
                tx.academicYear.findMany({
                    where: { schoolId, id: { in: [...placementIds.academicYearIds] } },
                    select: { id: true },
                }),
            ]);
            if (
                streams.length !== placementIds.streamIds.size ||
                academicYears.length !== placementIds.academicYearIds.size
            ) {
                throw new BadRequestError(
                    'Bulk placement contains a stream or academic year from another school',
                );
            }

            for (let i = 0; i < validRows.length; i++) {
                const { data } = validRows[i];
                const admissionNo = await nextAdmissionNo(tx, schoolId, school.schoolCode);

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
            students: createdStudents.map((s) => ({
                id: s.id,
                admissionNo: s.admissionNo,
                name: `${s.firstName} ${s.lastName}`,
            })),
        };
    }
}
