export async function nextInvoiceNo(tx, schoolId) {
    const year = new Date().getUTCFullYear();
    const [row] = await tx.$queryRaw`
    INSERT INTO invoice_sequences (school_id, year, next_val)
    VALUES (${schoolId}, ${year}, 1)
    ON CONFLICT (school_id, year)
    DO UPDATE SET next_val = invoice_sequences.next_val + 1
    RETURNING next_val
  `;
    return `INV-${year}-${String(row.next_val).padStart(6, '0')}`;
}

export async function nextPayslipNo(tx, schoolId) {
    const year = new Date().getUTCFullYear();
    const [row] = await tx.$queryRaw`
    INSERT INTO payslip_sequences (school_id, year, next_val)
    VALUES (${schoolId}, ${year}, 1)
    ON CONFLICT (school_id, year)
    DO UPDATE SET next_val = payslip_sequences.next_val + 1
    RETURNING next_val
  `;
    return `PS-${year}-${String(row.next_val).padStart(6, '0')}`;
}

export async function nextCreditNoteNo(tx, schoolId) {
    const year = new Date().getUTCFullYear();
    const [row] = await tx.$queryRaw`
    INSERT INTO credit_note_sequences (school_id, year, next_val)
    VALUES (${schoolId}, ${year}, 1)
    ON CONFLICT (school_id, year)
    DO UPDATE SET next_val = credit_note_sequences.next_val + 1
    RETURNING next_val
  `;
    return `CN-${year}-${String(row.next_val).padStart(6, '0')}`;
}

export async function nextAdmissionNo(tx, schoolId, schoolCode) {
    const year = new Date().getUTCFullYear();
    const [row] = await tx.$queryRaw`
    INSERT INTO admission_sequences (school_id, year, next_val)
    VALUES (${schoolId}, ${year}, 1)
    ON CONFLICT (school_id, year)
    DO UPDATE SET next_val = admission_sequences.next_val + 1
    RETURNING next_val
  `;
    return `${schoolCode || 'SCH'}/${year}/${String(row.next_val).padStart(4, '0')}`;
}
