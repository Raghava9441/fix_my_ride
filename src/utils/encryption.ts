import crypto from "crypto";

// ============================================
// Encryption Utilities
// ============================================

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

/**
 * Generate encryption key from secret
 */
export function generateKey(secret: string): Buffer {
  return crypto.scryptSync(secret, "salt", KEY_LENGTH);
}

/**
 * Generate random initialization vector
 */
export function generateIv(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Encrypt text using AES-256-CBC
 */
export function encrypt(text: string, key: Buffer): string {
  const iv = generateIv();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Return iv + encrypted data
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt text using AES-256-CBC
 */
export function decrypt(encryptedText: string, key: Buffer): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt with password-based key
 */
export function encryptWithPassword(text: string, password: string): string {
  const key = generateKey(password);
  return encrypt(text, key);
}

/**
 * Decrypt with password-based key
 */
export function decryptWithPassword(
  encryptedText: string,
  password: string,
): string {
  const key = generateKey(password);
  return decrypt(encryptedText, key);
}

/**
 * Hash data using SHA-256
 */
export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Hash data using SHA-512
 */
export function sha512(data: string): string {
  return crypto.createHash("sha512").update(data).digest("hex");
}

/**
 * Create HMAC signature
 */
export function createHmac(
  data: string,
  secret: string,
  algorithm: "sha256" | "sha512" = "sha256",
): string {
  return crypto.createHmac(algorithm, secret).update(data).digest("hex");
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
  const expected = createHmac(data, secret, algorithm);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Generate random salt
 */
export function generateSalt(length: number = 16): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate secure token
 */
export function secureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Encrypt buffer
 */
export function encryptBuffer(buffer: Buffer, key: Buffer): string {
  const iv = generateIv();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * Decrypt buffer
 */
export function decryptBuffer(encryptedText: string, key: Buffer): Buffer {
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const encrypted = Buffer.from(parts[1], "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted;
}

/**
 * Base64 encode
 */
export function base64Encode(data: string | Buffer): string {
  return Buffer.isBuffer(data)
    ? data.toString("base64")
    : Buffer.from(data).toString("base64");
}

/**
 * Base64 decode
 */
export function base64Decode(data: string): Buffer {
  return Buffer.from(data, "base64");
}

/**
 * Compute MD5 hash
 */
export function md5(data: string): string {
  return crypto.createHash("md5").update(data).digest("hex");
}

/**
 * Compute SHA-1 hash
 */
export function sha1(data: string): string {
  return crypto.createHash("sha1").update(data).digest("hex");
}
