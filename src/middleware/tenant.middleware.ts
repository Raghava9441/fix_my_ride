// src/middleware/tenant/tenantIsolation.ts
import { logger } from '../config/logger';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthorizationError } from './error.middleware';

// List of collections that are shared across tenants (no tenant isolation)
const SHARED_COLLECTIONS = [
  'vehicles',
  'owners'
];

// List of collections that are tenant-specific (require isolation)
const TENANT_COLLECTIONS = [
  'users',
  'servicerecords',
  'reminders',
  'invitations',
  'appointments',
  'invoices',
  'payments',
  'servicetemplates',
  'reviews',
  'notifications',
  'documents',
  'parts',
  'inventory',
  'supporttickets'
];

// Middleware to add tenant filter to all database queries
export const tenantIsolation = (req: Request, res: Response, next: NextFunction): void => {
  // Skip tenant isolation for public routes and health checks
  const publicPaths = ['/health', '/ready', '/live', '/api/v1/public', '/api/v1/webhooks'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Skip for admin routes (admin can see all tenants)
  if (req.path.startsWith('/api/v1/admin') && (req as any).userRole === 'admin') {
    return next();
  }
  
  const tenantId = (req as any).tenantId;
  
  // For tenant-specific operations, tenant ID is required
  const isTenantOperation = TENANT_COLLECTIONS.some(collection => 
    req.path.includes(collection) || 
    req.baseUrl?.includes(collection)
  );
  
  if (isTenantOperation && !tenantId) {
    logger.warn({
      type: 'tenant_isolation',
      requestId: (req as any).id,
      path: req.path,
      message: 'Tenant ID required for this operation'
    });
    return next(new AuthorizationError('Tenant context required for this operation'));
  }
  
  // Store tenant filter in request for use in controllers
  (req as any).tenantFilter = tenantId ? { tenantId } : null;
  
  // Override mongoose query methods to automatically add tenant filter
  if (tenantId && isTenantOperation) {
    const originalFind = mongoose.Query.prototype.find;
    const originalFindOne = mongoose.Query.prototype.findOne;
    const originalFindById = mongoose.Model.findById;
    
    // Note: This is a simplified example. In production, use a more robust approach
    // like Mongoose plugins or repository pattern
    
    // Store original methods to avoid infinite recursion
    (req as any)._originalFind = originalFind;
    (req as any)._originalFindOne = originalFindOne;
  }
  
  next();
};

// Helper function to apply tenant filter to query
export const applyTenantFilter = (req: Request, query: any, collectionName: string): any => {
  // Skip for shared collections
  if (SHARED_COLLECTIONS.includes(collectionName)) {
    return query;
  }
  
  // Skip for admin
  if ((req as any).userRole === 'admin') {
    return query;
  }
  
  const tenantId = (req as any).tenantId;
  
  if (tenantId && TENANT_COLLECTIONS.includes(collectionName)) {
    // Apply tenant filter based on schema structure
    if (collectionName === 'users') {
      return { ...query, serviceCenterId: tenantId };
    }
    if (collectionName === 'servicerecords') {
      return { ...query, serviceCenterId: tenantId };
    }
    if (collectionName === 'appointments') {
      return { ...query, serviceCenterId: tenantId };
    }
    // Add more collection mappings as needed
    return { ...query, tenantId };
  }
  
  return query;
};

// Middleware to validate cross-tenant access
export const validateCrossTenantAccess = async (
  req: Request,
  resourceType: string,
  resourceId: string,
  requiredAccess: 'read' | 'write' = 'read'
): Promise<boolean> => {
  const tenantId = (req as any).tenantId;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  
  // Admin has full access
  if (userRole === 'admin') {
    return true;
  }
  
  // For vehicles (shared resource), check authorization
  if (resourceType === 'vehicle') {
    const Vehicle = mongoose.model('Vehicle');
    const vehicle = await Vehicle.findById(resourceId);
    
    if (!vehicle) {
      return false;
    }
    
    // Owner has full access
    if (vehicle.currentOwnerId.toString() === userId) {
      return true;
    }
    
    // Check if service center is authorized
    if (tenantId) {
      const isAuthorized = vehicle.authorizedServiceCenters?.some(
        (center: any) => 
          center.serviceCenterId.toString() === tenantId && 
          center.status === 'active'
      );
      
      if (isAuthorized) {
        return true;
      }
    }
  }
  
  return false;
};