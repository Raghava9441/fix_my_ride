// src/config/cors.ts
import { CorsOptions } from 'cors';
import { logger } from './logger';
import { config } from './environment';

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) {
            return callback(null, true);
        }

        // Check if origin is allowed
        const allowedOrigins = config.cors.allowedOrigins;
        const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');

        if (isAllowed) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Tenant-ID',
        'X-Request-ID',
        'X-API-Key',
    ],
    exposedHeaders: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
    ],
    maxAge: 86400, // 24 hours
};