// src/config/rate-limit.ts
import { RateLimitRequestHandler } from 'express-rate-limit';
import { logger } from './logger';
import { config } from './environment';

export const rateLimitConfig = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
    },
    statusCode: 429,
    headers: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req: any) => {
        // Use tenant ID + IP as key for better isolation
        const tenantId = req.headers['x-tenant-id'] || 'public';
        const ip = req.ip || req.connection.remoteAddress;
        return `${tenantId}:${ip}`;
    },
    handler: (req: any, res: any) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}, Tenant: ${req.headers['x-tenant-id']}`);
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.',
            retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
        });
    },
    skip: (req: any) => {
        // Skip rate limiting for webhooks and health checks
        const skipPaths = ['/health', '/ready', '/live', '/api/v1/webhooks'];
        return skipPaths.some(path => req.path.startsWith(path));
    },
};