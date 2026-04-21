// ============================================
// String Utilities
// ============================================

/**
 * Truncate string with ellipsis
 */
export function truncate(
  str: string,
  maxLength: number,
  suffix: string = "...",
): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Capitalize each word
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Convert to camelCase
 */
export function camelCase(str: string): string {
  return str.toLowerCase().replace(/[-_](.)/g, (_, char) => char.toUpperCase());
}

/**
 * Convert to snake_case
 */
export function snakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Convert to kebab-case
 */
export function kebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate random string of given length
 */
export function randomString(length: number = 10): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random alphanumeric string
 */
export function randomAlphaNumeric(length: number = 10): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((byte) => chars[byte % chars.length])
    .join("");
}

/**
 * Generate random secure token
 */
export function randomToken(length: number = 32): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString("hex");
}

/**
 * Strip HTML tags from string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Unescape HTML special characters
 */
export function unescapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#039;": "'",
  };
  return str.replace(/&(amp|lt|gt|quot|#039);/g, (entity) => map[entity]);
}

/**
 * Convert string to byte array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert byte array to string
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Check if string is empty or whitespace only
 */
export function isBlank(str: string): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Check if string is not empty
 */
export function isPresent(str: string): boolean {
  return !isBlank(str);
}

/**
 * Pad string to length with given character
 */
export function pad(
  str: string,
  length: number,
  char: string = " ",
  direction: "left" | "right" | "both" = "left",
): string {
  const padLength = Math.max(0, length - str.length);

  switch (direction) {
    case "left":
      return char.repeat(padLength) + str;
    case "right":
      return str + char.repeat(padLength);
    case "both":
      const leftPad = Math.floor(padLength / 2);
      const rightPad = padLength - leftPad;
      return char.repeat(leftPad) + str + char.repeat(rightPad);
  }
}

/**
 * Reverse string
 */
export function reverse(str: string): string {
  return str.split("").reverse().join("");
}

/**
 * Count occurrences of substring
 */
export function countOccurrences(str: string, substr: string): number {
  return (
    str.match(new RegExp(substr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ||
    []
  ).length;
}

/**
 * Get character count
 */
export function charLength(str: string): number {
  return [...str].length; // Handles Unicode properly
}

/**
 * Get word count
 */
export function wordCount(str: string): number {
  return str
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Convert string to slug
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Split string into chunks of given size
 */
export function chunk(str: string, size: number): string[] {
  if (size <= 0) return [str];
  return str.match(new RegExp(`.{1,${size}}`, "g")) || [];
}

/**
 * Mask string (show only first and last N characters)
 */
export function maskString(
  str: string,
  visibleChars: number = 2,
  maskChar: string = "*",
): string {
  if (str.length <= visibleChars * 2) {
    return str;
  }
  const start = str.slice(0, visibleChars);
  const end = str.slice(-visibleChars);
  const mask = maskChar.repeat(str.length - visibleChars * 2);
  return start + mask + end;
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [username, domain] = email.split("@");
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  const maskedUser =
    username[0] +
    "*".repeat(username.length - 2) +
    username[username.length - 1];
  return `${maskedUser}@${domain}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string): string {
  if (phone.length < 10) return "*".repeat(phone.length);
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params = new URLSearchParams(queryString);
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

/**
 * Convert object to query string
 */
export function toQueryString(params: Record<string, unknown>): string {
  return new URLSearchParams(
    Object.entries(params).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) {
        acc.set(key, String(value));
      }
      return acc;
    }, new URLSearchParams()),
  ).toString();
}

/**
 * Convert to JSON safely
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}
