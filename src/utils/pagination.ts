// ============================================
// Pagination Utilities
// ============================================

export interface PaginationOptions {
  page: number;
  limit: number;
  total: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  from: number;
  to: number;
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  options: PaginationOptions,
): PaginationMeta {
  const { page, limit, total } = options;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const normalizedPage = Math.max(1, Math.min(page, totalPages));

  const from = total === 0 ? 0 : (normalizedPage - 1) * limit + 1;
  const to = Math.min(normalizedPage * limit, total);

  return {
    page: normalizedPage,
    limit,
    total,
    totalPages,
    hasNext: normalizedPage < totalPages,
    hasPrevious: normalizedPage > 1,
    from,
    to,
  };
}

/**
 * Calculate offset for database query
 */
export function getOffset(page: number, limit: number): number {
  if (page < 1 || limit < 1) return 0;
  return (page - 1) * limit;
}

/**
 * Parse pagination from query parameters
 */
export function parsePagination(
  query: Record<string, unknown>,
  defaults: {
    page?: number;
    limit?: number;
    maxLimit?: number;
  } = {},
): PaginationOptions {
  const page = Math.max(
    1,
    parseInt(query.page as string, 10) || defaults.page || 1,
  );
  const maxLimit = defaults.maxLimit || 100;
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(query.limit as string, 10) || defaults.limit || 20),
  );

  return { page, limit, total: 0 }; // total to be set later
}

/**
 * Build pagination query for MongoDB/Mongoose
 */
export function buildPaginationQuery<T>(
  items: T[],
  page: number,
  limit: number,
): {
  data: T[];
  pagination: PaginationMeta;
} {
  const total = items.length;
  const meta = calculatePagination({ page, limit, total });

  const startIndex = getOffset(page, limit);
  const endIndex = Math.min(startIndex + limit, total);
  const data = items.slice(startIndex, endIndex);

  return { data, pagination: meta };
}

/**
 * Build cursor-based pagination query
 */
export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
}

export function cursorPagination<T>(
  items: T[],
  cursor: string | null,
  limit: number,
  cursorField: keyof T,
): CursorPaginationResult<T> {
  let startIndex = 0;

  if (cursor) {
    const cursorIndex = items.findIndex(
      (item) => String(item[cursorField]) === cursor,
    );
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  const endIndex = Math.min(startIndex + limit, items.length);
  const data = items.slice(startIndex, endIndex);

  const lastItem = data[data.length - 1];
  const nextCursor = lastItem ? String(lastItem[cursorField]) : undefined;

  return {
    data,
    nextCursor,
    hasMore: endIndex < items.length,
  };
}

/**
 * Build SQL pagination query (LIMIT/OFFSET)
 */
export function buildSqlPagination(
  page: number,
  limit: number,
  total: number,
): { limit: number; offset: number } {
  const offset = getOffset(page, limit);
  return { limit, offset };
}

/**
 * Build cursor-based where clause for SQL
 */
export function buildCursorWhere(
  cursorField: string,
  cursorValue: unknown,
  direction: "forward" | "backward" = "forward",
): string {
  const operator = direction === "forward" ? ">" : "<";
  return `${cursorField} ${operator} ${cursorValue}`;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  page: unknown,
  limit: unknown,
  maxLimit: number = 100,
): PaginationOptions | null {
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    return null;
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > maxLimit) {
    return null;
  }

  return { page: pageNum, limit: limitNum, total: 0 };
}

/**
 * Build pagination links (for HATEOAS/API responses)
 */
export interface PaginationLinks {
  first: string;
  last: string;
  next: string | null;
  prev: string | null;
  self: string;
}

export function buildPaginationLinks(
  baseUrl: string,
  pagination: PaginationMeta,
  queryParams: Record<string, string> = {},
): PaginationLinks {
  const buildUrl = (page: number): string => {
    const params = new URLSearchParams({
      ...queryParams,
      page: String(page),
      limit: String(pagination.limit),
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const links: PaginationLinks = {
    first: buildUrl(1),
    last: buildUrl(pagination.totalPages),
    self: buildUrl(pagination.page),
    next: pagination.hasNext ? buildUrl(pagination.page + 1) : null,
    prev: pagination.hasPrevious ? buildUrl(pagination.page - 1) : null,
  };

  return links;
}

/**
 * Format pagination response
 */
export function formatPaginationResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  links: PaginationLinks,
): {
  data: T[];
  pagination: PaginationMeta;
  links: PaginationLinks;
} {
  return {
    data,
    pagination,
    links,
  };
}

/**
 * Estimate total pages
 */
export function estimateTotalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

/**
 * Check if pagination is within bounds
 */
export function isWithinBounds(page: number, totalPages: number): boolean {
  return page >= 1 && page <= totalPages;
}

/**
 * Get items for current page
 */
export function getPageItems<T>(items: T[], page: number, limit: number): T[] {
  const start = (page - 1) * limit;
  const end = start + limit;
  return items.slice(start, end);
}
