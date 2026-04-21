// ============================================
// Date Utilities
// ============================================

/**
 * Format date to ISO string
 */
export function formatISO(date: Date): string {
  return date.toISOString();
}

/**
 * Format date to local string
 */
export function formatLocal(date: Date): string {
  return date.toLocaleString();
}

/**
 * Format date to UTC string
 */
export function formatUTC(date: Date): string {
  return date.toUTCString();
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format date as DD/MM/YYYY (Indian format)
 */
export function formatDateIndian(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date as MM/DD/YYYY
 */
export function formatDateUS(date: Date): string {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format date and time as DD/MM/YYYY HH:mm:ss
 */
export function formatDateTime(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format time as HH:mm:ss
 */
export function formatTime(date: Date): string {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelative(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - new Date(date).getTime()) / 1000,
  );

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? "month" : "months"} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} ${diffInYears === 1 ? "year" : "years"} ago`;
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of week (Sunday)
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

/**
 * Get end of week (Saturday)
 */
export function endOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + (6 - day));
  return d;
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

/**
 * Get end of month
 */
export function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  d.setMonth(d.getMonth() + 1, 0);
  return d;
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add hours to date
 */
export function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

/**
 * Add minutes to date
 */
export function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Add months to date
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Add years to date
 */
export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/**
 * Difference in days between two dates
 */
export function diffInDays(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Difference in hours between two dates
 */
export function diffInHours(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60));
}

/**
 * Difference in minutes between two dates
 */
export function diffInMinutes(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60));
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date): boolean {
  return new Date(date) < new Date();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date): boolean {
  return new Date(date) > new Date();
}

/**
 * Check if date is a weekday
 */
export function isWeekday(date: Date): boolean {
  const day = new Date(date).getDay();
  return day >= 1 && day <= 5;
}

/**
 * Check if date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

/**
 * Get day of week name
 */
export function getDayName(date: Date): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[new Date(date).getDay()];
}

/**
 * Get month name
 */
export function getMonthName(date: Date): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[new Date(date).getMonth()];
}

/**
 * Get quarter of year (1-4)
 */
export function getQuarter(date: Date): number {
  return Math.floor(new Date(date).getMonth() / 3) + 1;
}

/**
 * Get age from birth date
 */
export function getAge(birthDate: Date): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get days in month
 */
export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Clone date
 */
export function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

/**
 * Check if date is valid
 */
export function isValidDate(date: unknown): boolean {
  if (
    !(date instanceof Date) &&
    typeof date !== "string" &&
    typeof date !== "number"
  ) {
    return false;
  }
  const d = new Date(date);
  return !isNaN(d.getTime());
}

/**
 * Parse date from string with fallback
 */
export function parseDate(
  dateString: string,
  fallback: Date = new Date(),
): Date {
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? fallback : date;
}
