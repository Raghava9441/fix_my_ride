// types/response.types.ts

/**
 * Standard API Response Structure
 * All responses follow this format for consistency
 */

// Base Types and Interfaces

export interface ApiResponseMetadata {
    /** Pagination metadata */
    pagination?: PaginationMeta;
    /** Request ID for tracing */
    requestId?: string;
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** API version used */
    version?: string;
    /** Additional custom metadata */
    [key: string]: any;
}

export interface PaginationMeta {
    /** Current page number (1-indexed) */
    page: number;
    /** Items per page */
    limit: number;
    /** Total number of items */
    total: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there is a next page */
    hasNext: boolean;
    /** Whether there is a previous page */
    hasPrevious: boolean;
}

export interface ValidationErrorDetail {
    /** Field that caused the error */
    field: string;
    /** Error message */
    message: string;
    /** Error code/type */
    code?: string;
    /** Invalid value provided */
    value?: any;
    /** Additional error context */
    context?: Record<string, any>;
}

export interface ApiErrorResponse {
    success: false;
    statusCode: number;
    message: string;
    errors: ValidationErrorDetail[];
    timestamp: string;
    stack?: string;
    requestId?: string;
}

export interface ApiSuccessResponse<T = any> {
    success: true;
    statusCode: number;
    message: string;
    data: T | null;
    meta: ApiResponseMetadata | null;
    timestamp: string;
}

export type ApiResponseType<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ApiResponse Class

export class ApiResponse<T = any> {
    public readonly success: boolean;
    public readonly statusCode: number;
    public readonly message: string;
    public readonly data: T | null;
    public readonly meta: ApiResponseMetadata | null;
    public readonly timestamp: string;

    constructor(
        success: boolean,
        statusCode: number,
        message: string,
        data: T | null = null,
        meta: ApiResponseMetadata | null = null
    ) {
        this.success = success;
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.meta = meta;
        this.timestamp = new Date().toISOString();
    }

    public toJSON(): ApiSuccessResponse<T> | ApiErrorResponse {
        return {
            success: this.success as boolean,
            statusCode: this.statusCode,
            message: this.message,
            data: this.data,
            meta: this.meta,
            timestamp: this.timestamp
        } as ApiSuccessResponse<T> | ApiErrorResponse;
    }

    /**
     * Check if response is successful (type guard)
     */
    public isSuccess(): this is ApiResponse<T> & { success: true; data: T } {
        return this.success === true;
    }

    /**
     * Check if response is an error (type guard)
     */
    public isError(): this is ApiResponse<T> & { success: false } {
        return this.success === false;
    }
}

// ApiError Class

export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly errors: ValidationErrorDetail[];
    public readonly success: false = false;
    public readonly timestamp: string;
    public readonly requestId?: string;
    public readonly errorCode?: string;

    constructor(
        statusCode: number,
        message: string,
        errors: ValidationErrorDetail[] = [],
        stack: string = '',
        errorCode?: string
    ) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.errors = errors;
        this.timestamp = new Date().toISOString();
        this.errorCode = errorCode;
        this.name = 'ApiError';

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }

        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, ApiError.prototype);
    }

    public toJSON(): ApiErrorResponse {
        const response: ApiErrorResponse = {
            success: this.success,
            statusCode: this.statusCode,
            message: this.message,
            errors: this.errors,
            timestamp: this.timestamp
        };

        if (process.env.NODE_ENV === 'development') {
            response.stack = this.stack;
        }

        if (this.requestId) {
            response.requestId = this.requestId;
        }

        return response;
    }

    /**
     * Add a single validation error
     */
    public addError(field: string, message: string, code?: string, value?: any): this {
        this.errors.push({ field, message, code, value });
        return this;
    }

    /**
     * Add multiple validation errors
     */
    public addErrors(errors: ValidationErrorDetail[]): this {
        this.errors.push(...errors);
        return this;
    }

    /**
     * Check if there are any validation errors
     */
    public hasErrors(): boolean {
        return this.errors.length > 0;
    }

    /**
     * Get error by field name
     */
    public getFieldError(field: string): ValidationErrorDetail | undefined {
        return this.errors.find(e => e.field === field);
    }
}

// Utility Types for Common Response Patterns

export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}

export interface CreatedResponse<T> {
    data: T;
    id: string | number;
}

export interface UpdatedResponse<T> {
    data: T;
    updatedAt: string;
}

export interface DeletedResponse {
    id: string | number;
    deleted: boolean;
    deletedAt: string;
}

export interface BulkOperationResponse {
    total: number;
    successful: number;
    failed: number;
    errors?: Array<{
        index: number;
        error: string;
        data?: any;
    }>;
}

// Response Builder Pattern

export class ResponseBuilder<T = any> {
    private statusCode: number = 200;
    private message: string = '';
    private data: T | null = null;
    private meta: ApiResponseMetadata = {};
    private errors: ValidationErrorDetail[] = [];

    /**
     * Set status code
     */
    public withStatusCode(code: number): this {
        this.statusCode = code;
        return this;
    }

    /**
     * Set response message
     */
    public withMessage(message: string): this {
        this.message = message;
        return this;
    }

    /**
     * Set response data
     */
    public withData(data: T): this {
        this.data = data;
        return this;
    }

    /**
     * Add metadata
     */
    public withMeta(meta: ApiResponseMetadata): this {
        this.meta = { ...this.meta, ...meta };
        return this;
    }

    /**
     * Add pagination metadata
     */
    public withPagination(page: number, limit: number, total: number): this {
        this.meta.pagination = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrevious: page > 1
        };
        return this;
    }

    /**
     * Add request ID for tracing
     */
    public withRequestId(requestId: string): this {
        this.meta.requestId = requestId;
        return this;
    }

    /**
     * Add processing time
     */
    public withProcessingTime(startTime: number): this {
        this.meta.processingTimeMs = Date.now() - startTime;
        return this;
    }

    /**
     * Add validation error
     */
    public withError(field: string, message: string, code?: string, value?: any): this {
        this.errors.push({ field, message, code, value });
        return this;
    }

    /**
     * Build success response
     */
    public buildSuccess(): ApiResponse<T> {
        return new ApiResponse<T>(
            true,
            this.statusCode,
            this.message,
            this.data,
            Object.keys(this.meta).length > 0 ? this.meta : null
        );
    }

    /**
     * Build error response
     */
    public buildError(): ApiError {
        return new ApiError(
            this.statusCode || 500,
            this.message || 'An error occurred',
            this.errors
        );
    }
}

// Type Guards

/**
 * Type guard to check if a response is successful
 */
export function isApiSuccess<T>(response: any): response is ApiSuccessResponse<T> {
    return response && response.success === true;
}

/**
 * Type guard to check if a response is an error
 */
export function isApiError(response: any): response is ApiErrorResponse {
    return response && response.success === false;
}

/**
 * Type guard to check if an error is an ApiError instance
 */
export function isApiErrorInstance(error: any): error is ApiError {
    return error instanceof ApiError;
}

// Express Response Extensions

/**
 * Extended Express Response interface with custom methods
 */
export interface ExtendedResponse<T = any> {

    success: (data?: T | null, message?: string, statusCode?: number, meta?: ApiResponseMetadata | null) => void;


    created: (data?: T | null, message?: string) => void;

    accepted: (data?: T | null, message?: string) => void;


    noContent: () => void;

    paginated: (data: T[], page: number, limit: number, total: number, message?: string) => void;


    bulkOperation: (result: BulkOperationResponse, message?: string) => void;
}

// HTTP Status Code Constants with Types

export const HttpStatus = {
    // 2xx Success
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,

    // 3xx Redirection
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    NOT_MODIFIED: 304,

    // 4xx Client Errors
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    GONE: 410,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,

    // 5xx Server Errors
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
} as const;

export type HttpStatusCode = typeof HttpStatus[keyof typeof HttpStatus];

// ============================================
// Status Messages
// ============================================

export const StatusMessages: Record<HttpStatusCode, string> = {
    // Success Messages
    [HttpStatus.OK]: 'Request processed successfully',
    [HttpStatus.CREATED]: 'Resource created successfully',
    [HttpStatus.ACCEPTED]: 'Request accepted for processing',
    [HttpStatus.NO_CONTENT]: 'No content',

    // Redirection Messages
    [HttpStatus.MOVED_PERMANENTLY]: 'Resource moved permanently',
    [HttpStatus.FOUND]: 'Resource found',
    [HttpStatus.NOT_MODIFIED]: 'Resource not modified',

    // Client Error Messages
    [HttpStatus.BAD_REQUEST]: 'Invalid request parameters',
    [HttpStatus.UNAUTHORIZED]: 'Authentication required',
    [HttpStatus.PAYMENT_REQUIRED]: 'Payment required',
    [HttpStatus.FORBIDDEN]: 'Access denied to this resource',
    [HttpStatus.NOT_FOUND]: 'Requested resource not found',
    [HttpStatus.METHOD_NOT_ALLOWED]: 'HTTP method not allowed',
    [HttpStatus.CONFLICT]: 'Resource conflict occurred',
    [HttpStatus.GONE]: 'Resource is no longer available',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'Validation failed',
    [HttpStatus.TOO_MANY_REQUESTS]: 'Rate limit exceeded',

    // Server Error Messages
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred',
    [HttpStatus.NOT_IMPLEMENTED]: 'Feature not implemented',
    [HttpStatus.BAD_GATEWAY]: 'Bad gateway',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
    [HttpStatus.GATEWAY_TIMEOUT]: 'Gateway timeout'
};

// Error Code Constants

export const ErrorCodes = {
    // Validation Errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    REQUIRED_FIELD: 'REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',

    // Authentication/Authorization Errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Resource Errors
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',
    RESOURCE_LOCKED: 'RESOURCE_LOCKED',

    // Database Errors
    DATABASE_ERROR: 'DATABASE_ERROR',
    DUPLICATE_KEY: 'DUPLICATE_KEY',
    TRANSACTION_FAILED: 'TRANSACTION_FAILED',

    // External Service Errors
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    TIMEOUT: 'TIMEOUT',

    // Rate Limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

    // Business Logic Errors
    BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
    INVALID_STATE: 'INVALID_STATE',
    OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Helper Functions


export function createSuccessResponse<T>(
    data: T,
    message: string = 'Success',
    statusCode: number = HttpStatus.OK,
    meta: ApiResponseMetadata | null = null
): ApiResponse<T> {
    return new ApiResponse<T>(true, statusCode, message, data, meta);
}


export function createErrorResponse(
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    errors: ValidationErrorDetail[] = [],
    errorCode?: ErrorCode
): ApiError {
    return new ApiError(statusCode, message, errors, '', errorCode);
}


export function createPaginatedResponse<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Data retrieved successfully'
): ApiResponse<T[]> {
    const meta: ApiResponseMetadata = {
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrevious: page > 1
        }
    };

    return new ApiResponse<T[]>(true, HttpStatus.OK, message, data, meta);
}


export function createValidationError(
    errors: ValidationErrorDetail[],
    message: string = 'Validation failed'
): ApiError {
    return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, message, errors);
}


export default {
    ApiResponse,
    ApiError,
    ResponseBuilder,
    HttpStatus,
    StatusMessages,
    ErrorCodes,
    isApiSuccess,
    isApiError,
    isApiErrorInstance,
    createSuccessResponse,
    createErrorResponse,
    createPaginatedResponse,
    createValidationError
};