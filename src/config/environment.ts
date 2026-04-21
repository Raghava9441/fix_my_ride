// src/config/environment.ts
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'test'
        ? '.env.test'
        : '.env.development';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') }); // Fallback

// Validate required environment variables
const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

export const config = {
    env: process.env.NODE_ENV || 'development',
    
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,

    db: {
        uri: process.env.MONGODB_URI!,
        name: process.env.MONGODB_NAME || 'fix_my_ride',
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2', 10),
        socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '30000', 10),
        connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000', 10),
    },

    jwt: {
        secret: process.env.JWT_SECRET!,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshSecret: process.env.JWT_REFRESH_SECRET!,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
    },

    email: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD,
        from: process.env.EMAIL_FROM || 'noreply@vehicleservice.com',
    },

    sms: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },

    storage: {
        provider: process.env.STORAGE_PROVIDER || 'local', // local, s3, cloudinary
        s3: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            bucket: process.env.AWS_S3_BUCKET,
            region: process.env.AWS_REGION,
        },
        cloudinary: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            apiSecret: process.env.CLOUDINARY_API_SECRET,
        },
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },

    cors: {
        allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info',
        prettyPrint: process.env.NODE_ENV !== 'production',
    },

    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },

    paypal: {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
    },

    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    },

    facebook: {
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackUrl: process.env.FACEBOOK_CALLBACK_URL,
    },

    maintenance: {
        enabled: process.env.MAINTENANCE_MODE === 'true',
        message: process.env.MAINTENANCE_MESSAGE || 'System is under maintenance. Please check back later.',
    },

    monitoring: {
        sentryDsn: process.env.SENTRY_DSN,
        newRelicKey: process.env.NEW_RELIC_LICENSE_KEY,
    },
};