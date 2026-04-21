// ============================================
// Number Utilities
// ============================================

/**
 * Format number with commas as thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-IN");
}

/**
 * Format currency (Indian Rupees by default)
 */
export function formatCurrency(
  amount: number,
  currencySymbol: string = "₹",
  decimals: number = 2,
): string {
  return `${currencySymbol}${amount.toFixed(decimals).replace(/\d(?=(\d{3})+\.)/g, "$&,")}`;
}

/**
 * Format number as Indian currency format (lakhs, crores)
 */
export function formatIndianCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(2)} crores`;
  } else if (amount >= 100000) {
    return `${(amount / 100000).toFixed(2)} lakhs`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)}k`;
  }
  return amount.toString();
}

/**
 * Round to nearest integer
 */
export function round(num: number): number {
  return Math.round(num);
}

/**
 * Round to decimal places
 */
export function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Floor to decimal places
 */
export function floorTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(num * factor) / factor;
}

/**
 * Ceil to decimal places
 */
export function ceilTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(num * factor) / factor;
}

/**
 * Get random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random float between min and max
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Clamp number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Check if number is even
 */
export function isEven(num: number): boolean {
  return num % 2 === 0;
}

/**
 * Check if number is odd
 */
export function isOdd(num: number): boolean {
  return num % 2 !== 0;
}

/**
 * Check if number is integer
 */
export function isInteger(num: number): boolean {
  return Number.isInteger(num);
}

/**
 * Check if number is prime
 */
export function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;

  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

/**
 * Convert bytes to human readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
  );
}

/**
 * Convert kilometers to miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/**
 * Convert miles to kilometers
 */
export function milesToKm(miles: number): number {
  return miles * 1.60934;
}

/**
 * Calculate percentage
 */
export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}

/**
 * Calculate percentage value
 */
export function percentageValue(total: number, percent: number): number {
  return (total * percent) / 100;
}

/**
 * Generate array of numbers from start to end (inclusive)
 */
export function range(start: number, end: number, step: number = 1): number[] {
  const result: number[] = [];
  for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Sum of array elements
 */
export function sum(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0);
}

/**
 * Average of array elements
 */
export function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

/**
 * Median of array elements
 */
export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Standard deviation of array elements
 */
export function standardDeviation(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = average(arr);
  const squareDiffs = arr.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(sum(squareDiffs) / arr.length);
}

/**
 * Round to nearest multiple
 */
export function roundToMultiple(num: number, multiple: number): number {
  return Math.round(num / multiple) * multiple;
}

/**
 * Check if number is within range
 */
export function inRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

/**
 * Convert temperature Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

/**
 * Convert temperature Fahrenheit to Celsius
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}
