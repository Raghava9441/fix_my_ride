/**
 * Written by Claude. Every line here should be attributed to the agent.
 *
 * A small validation helper, deliberately self-contained so the attribution
 * test does not depend on anything else in the repo.
 */

const RULES = {
  required: (v) => v !== undefined && v !== null && v !== '',
  email: (v) => typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
  minLength: (v, n) => typeof v === 'string' && v.length >= n,
};

function validateField(value, checks) {
  const failed = [];
  for (const [rule, arg] of Object.entries(checks)) {
    const fn = RULES[rule];
    if (!fn) throw new Error(`unknown rule: ${rule}`);
    if (!fn(value, arg)) failed.push(rule);
  }
  return failed;
}

function validate(input, schema) {
  const errors = {};
  for (const [field, checks] of Object.entries(schema)) {
    const failed = validateField(input[field], checks);
    if (failed.length) errors[field] = failed;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

module.exports = { validate, validateField, RULES };
