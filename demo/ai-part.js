/**
 * Written by Claude, for the Git AI attribution test.
 * Every line in this file should be reported as AI-authored.
 */

function add(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('add expects two numbers');
  }
  return a + b;
}

function sum(values) {
  return values.reduce((total, n) => add(total, n), 0);
}

function average(values) {
  if (!values.length) return 0;
  return sum(values) / values.length;
}

module.exports = { add, sum, average };
