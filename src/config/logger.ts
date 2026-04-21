// src/config/logger.ts
import winston from 'winston';
import morgan from 'morgan';
import { config } from './environment';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Format for console (development)
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`,
    ),
);

// Format for file (production)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.json(),
);

// Create logger instance
export const logger = winston.createLogger({
    level: config.logging.level,
    levels,
    transports: [
        // Console transport (always enabled)
        new winston.transports.Console({
            format: config.logging.prettyPrint ? consoleFormat : winston.format.simple(),
        }),
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/rejections.log' }),
    ],
});

// Add file transports in production
if (!config.logging.prettyPrint) {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }));

    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }));
}

// Morgan stream for HTTP logging
export const stream = {
    write: (message: string) => {
        logger.http(message.trim());
    },
};

// Create HTTP logger middleware
export const httpLogger = morgan('combined', { stream });