import { AuditLog } from '../models/index.js';

/**
 * Log an audit event
 */
export async function logAudit({
    actor,
    action,
    entityType,
    entityId,
    details = {},
    req = null
}) {
    try {
        // Determine actor
        const actorId = actor ? actor.id : (req?.user?.id || null);
        const actorName = actor ?
            (actor.username || `${actor.first_name} ${actor.last_name}`) :
            (req?.user?.username || 'System');

        // Extract IP and User Agent from request if valid
        const ipAddress = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
        const userAgent = req ? req.headers['user-agent'] : null;

        await AuditLog.create({
            actor_id: actorId,
            actor_name: actorName,
            action,
            entity_type: entityType,
            entity_id: entityId ? String(entityId) : null,
            details,
            ip_address: ipAddress,
            user_agent: userAgent
        });

        console.log(`📝 Audit Log: [${action}] ${entityType} #${entityId} by ${actorName}`);
    } catch (error) {
        console.error('❌ Failed to create audit log:', error);
        // Don't throw error to prevent blocking main flow
    }
}

/**
 * Calculate changes between old and new state
 */
export function calculateChanges(oldData, newData, excludeFields = ['updated_at', 'updatedAt']) {
    const changes = {};

    // Normalize to plain objects
    const oldObj = oldData?.toJSON ? oldData.toJSON() : oldData || {};
    const newObj = newData?.toJSON ? newData.toJSON() : newData || {};

    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
        if (excludeFields.includes(key)) continue;

        const oldVal = oldObj[key];
        const newVal = newObj[key];

        // Simple strict equality check
        // For arrays/objects, we might want deep comparison, but strict is fast for now
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes[key] = {
                from: oldVal,
                to: newVal
            };
        }
    }

    return changes;
}
