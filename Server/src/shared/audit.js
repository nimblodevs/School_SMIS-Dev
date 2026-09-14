import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { getOrCreateTraceId, recordAuditTrace } from '../config/tracing.js';

export async function recordAudit(entry, tx = prisma) {
    const {
        action,
        actorId = null,
        schoolId = null,
        entityType = 'AUTH',
        entityId = null,
        ipAddress = null,
        userAgent = null,
        metadata = null,
    } = entry;

    try {
        const traceId = getOrCreateTraceId();
        recordAuditTrace('audit.event', {
            'audit.action': action,
            'audit.entity_type': entityType,
            'audit.entity_id': entityId || '',
            'tenant.school_id': schoolId || '',
        });
        logger.info(
            {
                audit: {
                    action,
                    actorId,
                    schoolId,
                    entityType,
                    entityId,
                    traceId,
                    metadata,
                },
            },
            'Audit event',
        );

        return await tx.auditLog.create({
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
        logger.error(
            { err: error, action, actorId, entityType, entityId },
            'Audit event could not be persisted',
        );
        throw error;
    }
}
