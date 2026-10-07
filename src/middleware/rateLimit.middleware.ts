// src/middleware/rateLimit.middleware.ts
import rateLimit, { Options, RateLimitRequestHandler } from "express-rate-limit";
import { Request, Response } from "express";
import { logger } from "../config/logger";

interface LimiterOptions {
  windowMs: number;
  max: number;
  /** Short label used in logs and in the 429 message. */
  name: string;
}

/**
 * Per-route limiter factory, layered on top of the global `/api` limiter in
 * app.ts. Keyed by IP + the route's own `name`, so exhausting one limiter
 * (e.g. login attempts) doesn't consume the budget of another.
 */
export function createRateLimiter(opts: LimiterOptions): RateLimitRequestHandler {
  const options: Partial<Options> = {
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `${opts.name}:${req.ip}`,
    handler: (req: Request, res: Response) => {
      logger.warn({ type: "rate_limit_exceeded", limiter: opts.name, ip: req.ip, path: req.path });
      res.status(429).json({
        success: false,
        error: "Too many requests, please try again later.",
        retryAfter: Math.ceil(opts.windowMs / 1000),
      });
    },
  };
  return rateLimit(options);
}

// Credential-guessing surface: 10 attempts / 15 min / IP.
export const loginRateLimiter = createRateLimiter({
  name: "auth_login",
  windowMs: 15 * 60 * 1000,
  max: 10,
});

// Endpoints that send email or mint tokens: 5 / hour / IP.
export const sensitiveActionRateLimiter = createRateLimiter({
  name: "auth_sensitive",
  windowMs: 60 * 60 * 1000,
  max: 5,
});
