import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
    parseSpreadsheet,
    validateXlsxArchive,
} from '../src/modules/students/students.bulk-service.js';

describe('bulk spreadsheet parser', () => {
    it('reads a bounded XLSX worksheet without evaluating formulas', async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students');
        worksheet.addRow(['firstName', 'lastName', 'dateOfBirth']);
        worksheet.addRow(['Ada', 'Lovelace', new Date('2012-01-02T00:00:00Z')]);
        const buffer = await workbook.xlsx.writeBuffer();

        await expect(
            parseSpreadsheet(
                Buffer.from(buffer),
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ),
        ).resolves.toEqual([{ firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '2012-01-02' }]);
    });

    it('rejects an XLSX entry that expands beyond the archive limit', async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.addWorksheet('Students').addRow(['firstName']);
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        const centralHeader = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
        expect(centralHeader).toBeGreaterThanOrEqual(0);
        buffer.writeUInt32LE(11 * 1024 * 1024, centralHeader + 24);

        expect(() => validateXlsxArchive(buffer)).toThrow(/entry exceeds/);
    });

    it('rejects an XLSX archive whose directory entry count is under-reported', async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.addWorksheet('Students').addRow(['firstName']);
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
        const eocdOffset = buffer.lastIndexOf(endSignature);
        expect(eocdOffset).toBeGreaterThanOrEqual(0);
        buffer.writeUInt16LE(1, eocdOffset + 8);
        buffer.writeUInt16LE(1, eocdOffset + 10);

        expect(() => validateXlsxArchive(buffer)).toThrow(/central directory/);
    });

    it('rejects XLSX entries whose actual output disagrees with size metadata', async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.addWorksheet('Students').addRow(['firstName']);
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        const centralHeader = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
        expect(centralHeader).toBeGreaterThanOrEqual(0);
        const declaredSize = buffer.readUInt32LE(centralHeader + 24);
        buffer.writeUInt32LE(declaredSize + 1, centralHeader + 24);

        await expect(
            parseSpreadsheet(
                buffer,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ),
        ).rejects.toThrow(/size metadata is inconsistent/);
    });

    it('stops parsing CSV data after the configured row limit', async () => {
        const csv = ['firstName,lastName'];
        for (let row = 0; row <= 1_000; row += 1) csv.push(`Student${row},Example`);

        await expect(parseSpreadsheet(Buffer.from(csv.join('\n')), 'text/csv')).rejects.toThrow(
            /1000 data rows/,
        );
    });

    it('preserves blank interior XLSX headers for validation', async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students');
        worksheet.addRow(['firstName', '', 'lastName']);
        worksheet.addRow(['Ada', '', 'Lovelace']);
        const buffer = await workbook.xlsx.writeBuffer();

        await expect(
            parseSpreadsheet(
                Buffer.from(buffer),
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ),
        ).rejects.toThrow(/must have a header/);
    });
});
