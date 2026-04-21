import bcrypt from "bcryptjs";

// ============================================
// Password Utilities
// ============================================

const SALT_ROUNDS = 12;

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if password needs rehashing (based on salt rounds)
 */
export async function needsRehash(hash: string): Promise<boolean> {
  return bcrypt.getSaltRounds(hash) < SALT_ROUNDS;
}

/**
 * Generate password hash synchronously
 */
export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Verify password synchronously
 */
export function verifyPasswordSync(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

/**
 * Generate random password
 */
export function generatePassword(
  length: number = 12,
  options: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  } = {},
): string {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
  const numberChars = "0123456789";
  const symbolChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  let charset = "";
  if (uppercase) charset += uppercaseChars;
  if (lowercase) charset += lowercaseChars;
  if (numbers) charset += numberChars;
  if (symbols) charset += symbolChars;

  if (charset === "") {
    throw new Error("At least one character type must be enabled");
  }

  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return password;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
  } = {},
): { isValid: boolean; errors: string[] } {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSymbols = false,
  } = options;

  const errors: string[] = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (requireNumbers && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (requireSymbols && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Mask password (show only first and last characters)
 */
export function maskPassword(password: string): string {
  if (password.length <= 2) {
    return "*".repeat(password.length);
  }
  return (
    password[0] +
    "*".repeat(password.length - 2) +
    password[password.length - 1]
  );
}

/**
 * Check if two passwords match
 */
export function passwordsMatch(password1: string, password2: string): boolean {
  return password1 === password2;
}

/**
 * Estimate password strength (0-100)
 */
export function estimatePasswordStrength(password: string): number {
  let strength = 0;

  // Length score
  strength += Math.min(password.length * 4, 40);

  // Character variety score
  if (/[a-z]/.test(password)) strength += 10;
  if (/[A-Z]/.test(password)) strength += 10;
  if (/[0-9]/.test(password)) strength += 10;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

  // Deduct for repetitive characters
  const repeatRegex = /(.)\1{2,}/;
  if (repeatRegex.test(password)) {
    strength -= 10;
  }

  // Deduct for sequential characters
  const sequentialRegex =
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i;
  if (sequentialRegex.test(password)) {
    strength -= 10;
  }

  return Math.max(0, Math.min(100, strength));
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(
  strength: number,
): "weak" | "fair" | "good" | "strong" {
  if (strength < 30) return "weak";
  if (strength < 50) return "fair";
  if (strength < 75) return "good";
  return "strong";
}

/**
 * Common password patterns (for checking against known weak passwords)
 */
const COMMON_PASSWORDS = [
  "password",
  "123456",
  "123456789",
  "qwerty",
  "abc123",
  "password123",
  "admin",
  "letmein",
  "welcome",
  "monkey",
];

/**
 * Check if password is commonly used (weak)
 */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.some(
    (common) => common.toLowerCase() === password.toLowerCase(),
  );
}
