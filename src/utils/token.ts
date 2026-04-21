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
  [key: string]: unknown;
}

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
    issuer,
    audience,
  } = options;

  return jwt.sign(payload, secret, {
    expiresIn,
    algorithm,
    issuer,
    audience,
  });
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
    return jwt.verify(token, secret, {
      algorithms,
      issuer: options.issuer,
      audience: options.audience,
    }) as T;
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
    return decoded as T;
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
 * Generate HMAC signature
 */
export function generateHmac(
  data: string,
  secret: string,
  algorithm: "sha256" | "sha512" = "sha256",
): string {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(data);
  return hmac.digest("hex");
}

/**
 * Verify HMAC signature
 */
export function verifyHmac(
  data: string,
  secret: string,
  signature: string,
  algorithm: "sha256" | "sha512" = "sha256",
): boolean {
  const expected = generateHmac(data, secret, algorithm);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Get token expiration time
 */
export function getTokenExpiry(token: string): Date | null {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000);
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
 * Invalidate token (add to blacklist - requires Redis/DB)
 * Note: This is a placeholder - actual implementation requires storage
 */
export function invalidateToken(token: string): Promise<boolean> {
  // In production, store token in Redis/session store with TTL
  console.warn("invalidateToken is a placeholder - implement with Redis/DB");
  return Promise.resolve(true);
}

/**
 * Check if token is blacklisted
 * Note: This is a placeholder - actual implementation requires storage
 */
export function isTokenBlacklisted(token: string): Promise<boolean> {
  // In production, check Redis/session store
  console.warn("isTokenBlacklisted is a placeholder - implement with Redis/DB");
  return Promise.resolve(false);
}
