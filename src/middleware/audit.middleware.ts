// src/middleware/security/auditLogger.ts
import { Request, Response, NextFunction } from 'express';
import { getRequestContext } from './requestContext.middleware';
import { logger } from '../config/logger';
import { auditLogService } from '../services/audit.service';

// Sensitive fields to mask in audit logs
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  'apiKey',
  'creditCard',
  'cvv',
  'bankAccount'
];

// Mask sensitive data
const maskSensitiveData = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const masked = { ...data };
  
  for (const field of SENSITIVE_FIELDS) {
    if (masked[field]) {
      masked[field] = '********';
    }
  }
  
  return masked;
};

// Determine action type from HTTP method
const getActionType = (method: string): string => {
  const actionMap: Record<string, string> = {
    GET: 'READ',
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE'
  };
  return actionMap[method] || 'UNKNOWN';
};

// Determine entity type from URL. Checked before the generic pattern map
// below because this middleware is only actually mounted on /api/v1/admin,
// /api/v1/auth/change-password and /api/v1/accounts/*/status (see app.ts) —
// the generic map's keys ('vehicles', 'reminders', etc.) never match those
// prefixes and would otherwise always fall through to the fallback.
const SPECIFIC_PATTERNS: Array<[string, string]> = [
  ['/admin/tenants', 'Tenant'],
  ['/admin/users', 'Account'],
  ['/change-password', 'Account'],
  ['/accounts/', 'Account'],
];

// Determine entity type from URL
const getEntityType = (url: string): string => {
  for (const [pattern, entity] of SPECIFIC_PATTERNS) {
    if (url.includes(pattern)) {
      return entity;
    }
  }

  const patterns: Record<string, string> = {
    'vehicles': 'Vehicle',
    'owners': 'Owner',
    'service-centers': 'ServiceCenter',
    'service-records': 'ServiceRecord',
    'users': 'User',
    'staff': 'User',
    'reminders': 'Reminder',
    'invitations': 'Invitation',
    'appointments': 'Appointment',
    'invoices': 'Invoice',
    'payments': 'Payment',
    'subscriptions': 'Subscription',
    'notifications': 'Notification',
    'documents': 'Document',
    'reviews': 'Review'
  };

  for (const [pattern, entity] of Object.entries(patterns)) {
    if (url.includes(pattern)) {
      return entity;
    }
  }

  return 'System';
};

// Map to the AuditLog model's persisted entityType enum — the generic map
// above produces labels (e.g. 'User', 'Owner') that don't match the model's
// enum, so anything not in this allowlist is coerced to 'System' rather than
// failing the Mongoose validator.
const PERSISTABLE_ENTITY_TYPES = new Set([
  'Vehicle', 'ServiceRecord', 'Account', 'OwnerProfile', 'StaffProfile',
  'ServiceCenter', 'Tenant', 'System',
]);
const toPersistableEntityType = (entityType: string): string =>
  PERSISTABLE_ENTITY_TYPES.has(entityType) ? entityType : 'System';

// Audit log middleware
export const auditLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Store original send function
  const originalSend = res.json;
  let responseBody: any;
  
  // Override json method to capture response
  res.json = function(body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };
  
  // Log after response is sent
  res.on('finish', () => {
    // Skip logging for certain paths
    const skipPaths = ['/health', '/ready', '/live', '/api/v1/public'];
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return;
    }
    
    // Skip logging for successful GET requests (too verbose)
    if (req.method === 'GET' && res.statusCode < 400) {
      return;
    }
    
    // Determine if this is an auditable action
    const auditableActions = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const isAuditable = auditableActions.includes(req.method) || res.statusCode >= 400;
    
    if (!isAuditable) {
      return;
    }
    
    const context = getRequestContext();
    const tenantId = context.get('tenantId') || (req as any).tenantId;
    const userId = context.get('userId') || (req as any).userId;
    
    // Build audit log entry
    const auditEntry = {
      timestamp: new Date().toISOString(),
      requestId: (req as any).id,
      userId: userId || 'anonymous',
      userEmail: (req as any).userEmail,
      userRole: (req as any).userRole,
      tenantId: tenantId,
      action: getActionType(req.method),
      entityType: getEntityType(req.originalUrl),
      entityId: req.params.id || req.body?.id,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: res.statusCode,
      requestBody: maskSensitiveData(req.body),
      responseBody: res.statusCode >= 400 ? maskSensitiveData(responseBody) : undefined,
      duration: Date.now() - (req as any).startTime
    };
    
    // Log to audit logger
    logger.info({
      type: 'audit',
      ...auditEntry
    });

    // Persist to the AuditLog collection so /api/v1/audit-logs has something
    // to read back. entityId is a required field on the model; for create
    // requests where the new id isn't in req.params (e.g. POST /admin/tenants)
    // there's nothing valid to persist, so those stay winston-only above.
    const resolvedEntityId =
      req.params.id ||
      (req.originalUrl.includes('/change-password') ? userId : undefined);
    if ((req as any).user?.id && resolvedEntityId) {
      void auditLogService
        .create({
          tenantId,
          actorId: (req as any).user.id,
          actorRole: (req as any).user.role,
          actorEmail: (req as any).user.email,
          action: auditEntry.action as any,
          entityType: toPersistableEntityType(auditEntry.entityType) as any,
          entityId: resolvedEntityId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        })
        .catch((err) =>
          logger.error({ type: 'audit_persist_failed', error: (err as Error).message }),
        );
    }

    // For critical actions, also log to separate audit file
    const criticalActions = ['DELETE', 'UPDATE roles', 'UPDATE permissions', 'UPDATE subscription'];
    if (criticalActions.some(action => auditEntry.action === action || req.path.includes(action.toLowerCase()))) {
      logger.warn({
        type: 'critical_audit',
        ...auditEntry
      });
    }
  });
  
  next();
};

// Decorator for manual audit logging in controllers
export const logAudit = (action: string, entityType: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const req = args[0];
      const result = await originalMethod.apply(this, args);
      
      // Manual audit log entry
      logger.info({
        type: 'audit',
        timestamp: new Date().toISOString(),
        requestId: (req as any).id,
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        action,
        entityType,
        entityId: req.params.id || req.body?.id,
        method: req.method,
        path: req.originalUrl
      });
      
      return result;
    };
    
    return descriptor;
  };
};