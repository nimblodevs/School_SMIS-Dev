import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';
import { tenantContext } from './tenant-context.js';
import { getOrCreateTraceId, recordAuditTrace, runWithTraceId } from './tracing.js';

const globalForPrisma = globalThis;
const TENANT_MODELS = new Set([
    'SchoolSettings',
    'User',
    'EmployeeNumber',
    'Teacher',
    'Staff',
    'Student',
    'Parent',
    'AcademicYear',
    'Term',
    'ClassLevel',
    'Stream',
    'Enrollment',
    'Subject',
    'ClassSubject',
    'TimetableSlot',
    'Attendance',
    'Exam',
    'ExamResult',
    'LearningArea',
    'Strand',
    'SubStrand',
    'CompetencyAssessment',
    'FeeStructure',
    'Invoice',
    'Payment',
    'StaffModuleAccess',
    'AuditLog',
    'FileUpload',
    'BackgroundJob',
    'JobGroup',
    'BankAccount',
    'LoanProvider',
    'EmployeeLoanRequest',
    'EmployeeSalaryLoan',
    'LoanRepayment',
    'AllowanceType',
    'SalaryStructure',
    'StatutoryDeduction',
    'StatutoryRateConfig',
    'CustomDeduction',
    'PayrollRun',
    'Payslip',
    'EmploymentContract',
    'LeaveType',
    'LeaveBalance',
    'LeaveRequest',
    'ResignationRecord',
]);

function addTenantScope(args, operation, schoolId) {
    const scopedArgs = { ...args };

    if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
        scopedArgs.where = { ...(scopedArgs.where || {}), schoolId };
    }

    if (operation === 'create' || operation === 'update' || operation === 'upsert') {
        scopedArgs.data = { ...(scopedArgs.data || {}), schoolId };
    }

    if (operation === 'createMany') {
        scopedArgs.data = scopedArgs.data.map((data) => ({ ...data, schoolId }));
    }

    return scopedArgs;
}

function createPrismaClient() {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    const prismaClient = new PrismaClient({
        adapter,
        log: [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
            ...(env.NODE_ENV === 'development'
                ? [{ emit: 'event', level: 'query' }]
                : []),
        ],
    });

    prismaClient.$on('error', (event) => {
        logger.error({ target: event.target, message: event.message }, 'Prisma error');
    });

    prismaClient.$on('warn', (event) => {
        logger.warn({ target: event.target, message: event.message }, 'Prisma warning');
    });

    if (env.NODE_ENV === 'development') {
        prismaClient.$on('query', (event) => {
            logger.debug(
                { durationMs: event.duration, target: event.target },
                'Prisma query completed',
            );
        });
    }

    return prismaClient.$extends({
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    const schoolId = tenantContext.get()?.schoolId;
                    if (!schoolId || !TENANT_MODELS.has(model)) return query(args);

                    return query(addTenantScope(args, operation, schoolId));
                },
            },
        },
    });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

export function runTransaction(operation, options) {
    const traceId = getOrCreateTraceId();
    return runWithTraceId(traceId, () => {
        recordAuditTrace('database.transaction', { 'transaction.trace_id': traceId });
        return prisma.$transaction(operation, options);
    });
}

if (env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export async function connectDatabase() {
    await prisma.$connect();
    logger.info('Database connection established');
}

export async function disconnectDatabase() {
    await prisma.$disconnect();
    logger.info('Database connection closed');
}
