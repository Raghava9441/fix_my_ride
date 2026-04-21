// ============================================
// Utils Barrel Export
// ============================================

export * from "./asyncHandler";
export * from "./apiResponse";
export * from "./validators";
export * from "./number";
export * from "./string";
export * from "./date";
export * from "./password";
export * from "./token";
export * from "./encryption";
export * from "./pagination";

// Re-export commonly used items at top level
export {
  ApiResponse,
  ApiError,
  ResponseBuilder,
  HttpStatus,
  ErrorCodes,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createValidationError,
} from "./apiResponse";

export {
  validateEmail,
  validatePhone,
  validateUrl,
  validateUuid,
  validatePassword,
  isNumeric,
  isAlpha,
  isAlphanumeric,
  isInRange,
  isPastDate,
  isFutureDate,
} from "./validators";

export {
  formatNumber,
  formatCurrency,
  formatIndianCurrency,
  round,
  roundTo,
  clamp,
  randomInt,
  formatBytes,
} from "./number";

export {
  truncate,
  capitalize,
  titleCase,
  camelCase,
  snakeCase,
  kebabCase,
  randomString,
  escapeHtml,
  maskString,
  slugify,
} from "./string";

export {
  formatDate,
  formatDateIndian,
  formatDateTime,
  formatRelative,
  addDays,
  addMonths,
  diffInDays,
  isToday,
  isPast,
  isFuture,
} from "./date";

export {
  hashPassword,
  verifyPassword,
  generatePassword,
  validatePasswordStrength,
} from "./password";

export {
  generateToken,
  verifyToken,
  decodeToken,
  generateRefreshToken,
  generateAccessToken,
  generateApiKey,
  isTokenExpired,
} from "./token";

export {
  encrypt,
  decrypt,
  encryptWithPassword,
  decryptWithPassword,
  sha256,
  sha512,
  secureToken,
} from "./encryption";

export {
  calculatePagination,
  getOffset,
  parsePagination,
  buildPaginationQuery,
  cursorPagination,
  buildPaginationLinks,
} from "./pagination";
