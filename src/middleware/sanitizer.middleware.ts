// src/middleware/security/sanitizer.ts
import { Request, Response, NextFunction } from 'express';
import { sanitize } from 'express-mongo-sanitize';
import xss from 'xss';

// Custom XSS filter optionsac
const xssOptions = {
    whiteList: {
        // Allow safe HTML tags for service descriptions
        p: ['class', 'style'],
        br: [],
        strong: [],
        b: [],
        em: [],
        i: [],
        u: [],
        ul: [],
        ol: [],
        li: [],
        a: ['href', 'title', 'target'],
        span: ['class', 'style'],
        div: ['class', 'style']
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'noscript', 'iframe', 'object', 'embed']
};

// Deep sanitize object recursively
const deepSanitize = (obj: any, level: number = 0): any => {
    // Prevent infinite recursion
    if (level > 10) return obj;

    if (!obj || typeof obj !== 'object') {
        // Sanitize strings
        if (typeof obj === 'string') {
            // Remove any HTML tags and escape
            return xss(obj, xssOptions).trim();
        }
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitize(item, level + 1));
    }

    // Handle objects
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
        // Skip sanitizing for certain fields that might contain code
        const skipSanitize = ['password', 'passwordHash', 'token', 'refreshToken'];
        if (skipSanitize.includes(key)) {
            sanitized[key] = value;
            continue;
        }

        sanitized[key] = deepSanitize(value, level + 1);
    }

    return sanitized;
};

// Main request sanitizer middleware
export const requestSanitizer = (req: Request, res: Response, next: NextFunction): void => {
    // Sanitize request body
    if (req.body) {
        try {
            // First, apply MongoDB sanitization (remove operators)
            req.body = sanitize(req.body);
            // Then apply XSS sanitization
            req.body = deepSanitize(req.body);
        } catch (error) {
            // If sanitization fails, continue but log
            console.error('Request sanitization failed:', error);
        }
    }

    // Sanitize query parameters
    if (req.query) {
        try {
            req.query = sanitize(req.query);
            req.query = deepSanitize(req.query);
        } catch (error) {
            console.error('Query sanitization failed:', error);
        }
    }

    // Sanitize URL parameters
    if (req.params) {
        try {
            req.params = sanitize(req.params);
            req.params = deepSanitize(req.params);
        } catch (error) {
            console.error('Params sanitization failed:', error);
        }
    }

    next();
};

// Helper to sanitize specific fields
export const sanitizeField = (value: any, options?: { allowHtml?: boolean }): any => {
    if (typeof value !== 'string') return value;

    if (options?.allowHtml) {
        // Allow limited HTML but still remove scripts
        return xss(value, xssOptions);
    }

    // Remove all HTML and trim
    return xss(value, { stripIgnoreTag: true }).trim();
};

// Helper to validate and sanitize email
export const sanitizeEmail = (email: string): string => {
    if (!email) return email;
    return email.toLowerCase().trim().replace(/[^\w@.-]/g, '');
};

// Helper to validate and sanitize phone number
export const sanitizePhone = (phone: string): string => {
    if (!phone) return phone;
    // Remove all non-digit characters except '+'
    return phone.replace(/[^\d+]/g, '');
};

// Helper to validate and sanitize VIN
export const sanitizeVIN = (vin: string): string => {
    if (!vin) return vin;
    // Convert to uppercase, remove spaces, keep only alphanumeric
    return vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
};

// Helper to validate and sanitize registration number
export const sanitizeRegNumber = (regNumber: string): string => {
    if (!regNumber) return regNumber;
    // Convert to uppercase, keep alphanumeric and spaces
    return regNumber.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
};