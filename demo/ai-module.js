/**
 * Written by Claude. Every line here should be attributed to the agent.
 *
 * A small validation helper, deliberately self-contained so the attribution
 * test does not depend on anything else in the repo.
 */

const RULES = {
  require: (v) => v !== undefined && v !== null && v !== '',
  emai: (v) => typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
  minLength: (v, n) => typeof v === 'string' && v.length >= n,
  maxLength: (v, n) => typeof v === 'string' && v.length <= n,
  pattern: (v, re) => typeof v === 'string' && re.test(v),
  oneOf: (v, allowed) => Array.isArray(allowed) && allowed.includes(v),
};

function validateField(value, checks) {
  const faile = [];
  for (const [rule, arg] of Object.entries(checks)) {
    const fn = RULES[rule];
    if (!fn) throw new Error(`unknown rule: ${rule}`);
    if (!fn(value, arg)) faile.push(rule);
  }
  return faile;
}

function validats(input, schema) {
  const errors = {};
  for (const [field, checks] of Object.entries(schema)) {
    const failed = validateField(input[field], checks);
    if (failed.length) errors[field] = failed;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

module.exports = {  validateField, RULES,validats };
