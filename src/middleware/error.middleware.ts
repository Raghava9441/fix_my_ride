// src/middleware/error/errorHandler.ts
import { config } from '../config/environment';
import { logger } from '../config/logger';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

// Custom error classes
export class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    code?: string;
    details?: any;

    constructor(message: string, statusCode: number, code?: string, details?: any) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.code = code;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT_ERROR');
    }
}

export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests, please try again later') {
        super(message, 429, 'RATE_LIMIT_ERROR');
    }
}

// Handle Mongoose duplicate key error
const handleDuplicateKeyError = (err: any): AppError => {
    const field = Object.keys(err.keyPattern)[0];
    const value = err.keyValue[field];
    const message = `Duplicate value '${value}' for field '${field}'. Please use another value.`;
    return new AppError(message, 409, 'DUPLICATE_KEY_ERROR', { field, value });
};

// Handle Mongoose validation error
const handleValidationError = (err: mongoose.Error.ValidationError): AppError => {
    const errors = Object.values(err.errors).map((e: any) => ({
        field: e.path,
        message: e.message,
        value: e.value
    }));
    return new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors);
};

// Handle Mongoose CastError (invalid ObjectId)
const handleCastError = (err: mongoose.Error.CastError): AppError => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400, 'INVALID_ID_ERROR', { field: err.path, value: err.value });
};

// Handle JWT errors
const handleJWTError = (): AppError => {
    return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN_ERROR');
};

const handleJWTExpiredError = (): AppError => {
    return new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED_ERROR');
};

// Send error response for development
const sendErrorDev = (err: AppError, res: Response): void => {
    logger.error({
        type: 'error',
        statusCode: err.statusCode,
        message: err.message,
        stack: err.stack,
        code: err.code,
        details: err.details
    });

    res.status(err.statusCode).json({
        success: false,
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
        code: err.code,
        details: err.details
    });
};

// Send error response for production
const sendErrorProd = (err: AppError, res: Response): void => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            message: err.message,
            code: err.code,
            ...(err.details && { details: err.details })
        });
    } else {
        // Programming or other unknown error: don't leak error details
        logger.error('ERROR 💥', {
            error: err.message,
            stack: err.stack,
            statusCode: err.statusCode
        });

        res.status(500).json({
            success: false,
            status: 'error',
            message: 'Something went wrong. Please try again later.'
        });
    }
};

// Main error handler middleware
export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Log error with request context
    logger.error({
        type: 'error',
        requestId: (req as any).id,
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code,
            statusCode: err.statusCode
        }
    });

    // Set default values
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Handle specific Mongoose errors
    if (err instanceof mongoose.Error.ValidationError) {
        err = handleValidationError(err);
    }

    if (err instanceof mongoose.Error.CastError) {
        err = handleCastError(err);
    }

    if (err.code === 11000) {
        err = handleDuplicateKeyError(err);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        err = handleJWTError();
    }

    if (err.name === 'TokenExpiredError') {
        err = handleJWTExpiredError();
    }

    // Handle custom AppError instances
    if (err instanceof AppError) {
        if (config.env === 'development') {
            sendErrorDev(err, res);
        } else {
            sendErrorProd(err, res);
        }
        return;
    }

    // Handle unknown errors
    const unknownError = new AppError(
        err.message || 'Internal server error',
        err.statusCode || 500
    );

    if (config.env === 'development') {
        sendErrorDev(unknownError, res);
    } else {
        sendErrorProd(unknownError, res);
    }
};