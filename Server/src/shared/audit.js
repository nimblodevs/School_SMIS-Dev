import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { getActiveTraceId, recordAuditTrace } from '../config/tracing.js';

export async function recordAudit({
    action,
    actorId = null,
    schoolId = null,
    entityType = 'AUTH',
    entityId = null,
    ipAddress = null,
    userAgent = null,
    metadata = null,
}) {
    try {
        const traceId = getActiveTraceId();
        recordAuditTrace('audit.event', {
            'audit.action': action,
            'audit.entity_type': entityType,
            'audit.entity_id': entityId || '',
            'tenant.school_id': schoolId || '',
        });
        logger.info({ audit: { action, actorId, schoolId, entityType, entityId, traceId, metadata } }, 'Audit event');

        return await prisma.auditLog.create({
            data: {
                action,
                actorId,
                schoolId,
                entityType,
                entityId,
                ipAddress,
                userAgent,
                traceId,
                metadata,
            },
        });
    } catch (error) {
        logger.error({ err: error, action, actorId, entityType, entityId }, 'Audit event could not be persisted');
        throw error;
    }
}
