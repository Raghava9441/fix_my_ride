// src/middleware/tenant/requestContext.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id: string;
      tenantId?: string;
      userId?: string;
      userRole?: string;
      userModel?: string;
      startTime: number;
      context: Map<string, any>;
    }
  }
}

// AsyncLocalStorage for request context (for use across async operations)
import { AsyncLocalStorage } from 'async_hooks';
import { logger } from '../config/logger';
export const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.id = req.headers['x-request-id'] as string || uuidv4();
  
  // Set request start time for performance tracking
  req.startTime = Date.now();
  
  // Initialize context map
  req.context = new Map();
  
  // Extract tenant ID from various sources
  let tenantId: string | undefined;
  
  // Priority order for tenant identification:
  // 1. From JWT token (will be set by auth middleware)
  // 2. From header
  // 3. From subdomain
  // 4. From query parameter (for development)
  
  if (req.headers['x-tenant-id']) {
    tenantId = req.headers['x-tenant-id'] as string;
  } else if (req.headers['authorization']) {
    // Tenant will be extracted from JWT in auth middleware
    tenantId = undefined;
  } else if (req.headers['origin']) {
    // Could extract from subdomain if needed
    // const hostname = new URL(req.headers['origin']).hostname;
    // const subdomain = hostname.split('.')[0];
    // if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
    //   tenantId = subdomain;
    // }
  } else if (req.query.tenantId && process.env.NODE_ENV === 'development') {
    tenantId = req.query.tenantId as string;
  }
  
  // Store tenant ID in request
  if (tenantId) {
    req.tenantId = tenantId;
    req.context.set('tenantId', tenantId);
  }
  
  // Add response headers
  res.setHeader('X-Request-ID', req.id);
  if (tenantId) {
    res.setHeader('X-Tenant-ID', tenantId);
  }
  
  // Run in AsyncLocalStorage context for async operations
  asyncLocalStorage.run(req.context, () => {
    // Add request completion logging
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
      
      logger[logLevel]({
        type: 'request_complete',
        requestId: req.id,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        tenantId: req.tenantId,
        userId: req.userId,
        userAgent: req.get('user-agent'),
        ip: req.ip
      });
    });
    
    next();
  });
};

// Helper function to get request context
export const getRequestContext = (): Map<string, any> => {
  const store = asyncLocalStorage.getStore();
  if (!store) {
    return new Map();
  }
  return store;
};

// Helper to get tenant ID from context
export const getTenantId = (): string | undefined => {
  const context = getRequestContext();
  return context.get('tenantId');
};

// Helper to get user ID from context
export const getUserId = (): string | undefined => {
  const context = getRequestContext();
  return context.get('userId');
};