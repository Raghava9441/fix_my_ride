import jwt from "jsonwebtoken";
import crypto from "crypto";

// ============================================
// Token Utilities
// ============================================

// Default configuration
const DEFAULT_EXPIRY = "24h";
const DEFAULT_ALGORITHM = "HS256";

interface TokenPayload {
  userId?: string;
  email?: string;
  role?: string;
  tenantId?: string;
  jti?: string;
  [key: string]: unknown;
}

const DEFAULT_ISSUER = "fix-my-ride";
const DEFAULT_AUDIENCE = "fix-my-ride-clients";

/**
 * Generate JWT token
 */
export function generateToken(
  payload: TokenPayload,
  secret: string,
  options: {
    expiresIn?: string | number;
    algorithm?: string;
    issuer?: string;
    audience?: string | string[];
  } = {},
): string {
  const {
    expiresIn = DEFAULT_EXPIRY,
    algorithm = DEFAULT_ALGORITHM,
    issuer = DEFAULT_ISSUER,
    audience = DEFAULT_AUDIENCE,
  } = options;

  return jwt.sign(payload, secret, {
    expiresIn,
    algorithm,
    issuer,
    audience,
  } as jwt.SignOptions);
}

/**
 * Verify JWT token
 */
export function verifyToken<T extends TokenPayload = TokenPayload>(
  token: string,
  secret: string,
  options: {
    algorithms?: string[];
    issuer?: string;
    audience?: string | string[];
  } = {},
): T | null {
  try {
    const algorithms = options.algorithms || [DEFAULT_ALGORITHM];
    const verified = jwt.verify(token, secret, {
      algorithms: algorithms as jwt.Algorithm[],
      issuer: options.issuer || DEFAULT_ISSUER,
      audience: options.audience || DEFAULT_AUDIENCE,
    } as jwt.VerifyOptions);
    return verified as unknown as T;
  } catch {
    return null;
  }
}

/**
 * Decode JWT token without verification
 */
export function decodeToken<T extends TokenPayload = TokenPayload>(
  token: string,
): T | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as unknown as T;
  } catch {
    return null;
  }
}

/**
 * Generate refresh token (long-lived)
 */
export function generateRefreshToken(
  payload: TokenPayload,
  secret: string,
): string {
  return generateToken(payload, secret, {
    expiresIn: "7d", // 7 days
  });
}

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(
  payload: TokenPayload,
  secret: string,
): string {
  return generateToken(payload, secret, {
    expiresIn: DEFAULT_EXPIRY,
  });
}

/**
 * Generate API key
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate short token (for email verification, password reset, etc.)
 */
export function generateShortToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number = 32): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Get token expiration time
 */
export function getTokenExpiry(token: string): Date | null {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return null;
  return new Date(Number(decoded.exp) * 1000);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return new Date() > expiry;
}

/**
 * Get remaining time until token expires (in seconds)
 */
export function getTokenRemainingTime(token: string): number {
  const expiry = getTokenExpiry(token);
  if (!expiry) return 0;
  const remaining = expiry.getTime() - new Date().getTime();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Refresh token (issue new token with same payload)
 */
export function refreshToken(
  token: string,
  secret: string,
  newExpiry?: string | number,
): string | null {
  const decoded = decodeToken(token);
  if (!decoded) return null;

  const { exp, iat, ...payload } = decoded;
  return generateToken(payload, secret, {
    expiresIn: newExpiry || DEFAULT_EXPIRY,
  });
}

/**
 * Invalidate a token by adding its jti to a Redis denylist.
 * The denylist entry TTL equals the token's remaining lifetime so it
 * auto-expires. Requires the token to carry a `jti` claim and `exp`.
 */
export async function invalidateToken(
  token: string,
  opts: {
    getRedis: () => any;
    prefix?: string;
  },
): Promise<boolean> {
  try {
    const decoded = decodeToken(token);
    const jti = (decoded as any)?.jti;
    const exp = (decoded as any)?.exp;
    if (!jti || !exp) return false;

    const redis = opts.getRedis();
    const prefix = opts.prefix ?? "auth:revoked:";
    const ttlSeconds = Math.max(1, Math.floor(exp - Date.now() / 1000));
    await redis.set(`${prefix}${jti}`, "1", "EX", ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether a token's jti has been revoked via the Redis denylist.
 */
export async function isTokenBlacklisted(
  token: string,
  opts: {
    getRedis: () => any;
    prefix?: string;
  },
): Promise<boolean> {
  try {
    const jti = (decodeToken(token) as any)?.jti;
    if (!jti) return false;
    const redis = opts.getRedis();
    const prefix = opts.prefix ?? "auth:revoked:";
    const result = await redis.get(`${prefix}${jti}`);
    return result != null;
  } catch {
    return false;
  }
}


/* ------------------------------------------------------------------ */
/* Suspended-account marker                                            */
/* ------------------------------------------------------------------ */

const SUSPENDED_PREFIX = "auth:suspended:";

/** "15m" / "24h" / "7d" / "3600" -> seconds. Unparseable input falls back to a day. */
export function durationToSeconds(value: string | number | undefined, fallback = 86_400): number {
  if (typeof value === "number") return value > 0 ? Math.floor(value) : fallback;
  const match = /^(\d+)\s*([smhd]?)$/i.exec((value ?? "").trim());
  if (!match) return fallback;
  const n = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  return n * ({ s: 1, m: 60, h: 3600, d: 86_400 } as Record<string, number>)[unit];
}

/**
 * Marks an account suspended in Redis for as long as any access token issued
 * before now could still be alive.
 *
 * Suspending only flipped `status` in Mongo, and `authenticate` never reads
 * the account - it trusts the signed token. So a suspended user kept full
 * access until their token expired (login and refresh do refuse them, but a
 * token already in hand needs neither). This marker is what `authenticate`
 * checks, and it is cleared on re-activation.
 */
export async function markUserSuspended(
  redis: { set: (...args: any[]) => Promise<unknown> },
  userId: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(`${SUSPENDED_PREFIX}${userId}`, "1", "EX", Math.max(1, ttlSeconds));
}

export async function clearUserSuspended(
  redis: { del: (...args: any[]) => Promise<unknown> },
  userId: string,
): Promise<void> {
  await redis.del(`${SUSPENDED_PREFIX}${userId}`);
}

export async function isUserSuspended(
  redis: { get: (key: string) => Promise<string | null> },
  userId: string,
): Promise<boolean> {
  return (await redis.get(`${SUSPENDED_PREFIX}${userId}`)) != null;
}
