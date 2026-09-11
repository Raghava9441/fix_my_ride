/**
 * Typed by a human. None of these lines should be attributed to the agent.
 */

const { validate } = require("./ai-module");

const USER_SCHEMA = {
  name: { required: true, minLength: 3 },
  email: { required: true, email: true },
};

function checkUser(input) {
  const result = validate(input, USER_SCHEMA);
  if (result.valid) {
    return { ok: true, message: "user passed validation" };
  }
  const fields = Object.keys(result.errors).join(", ");
  return { ok: false, message: `validation failed for: ${fields}` };
}

function describeErrors(result) {
  return Object.entries(result.errors).map(([field, rules]) => {
    return `${field} is invalid (${rules.join(", ")})`;
  });
}
function describeError(result) {
  return Object.entries(result.errors).map(([field, rules]) => {
    return `${field} is invalid (${rules.join(", ")})`;
  });
}

module.exports = { checkUser, describeErrors, USER_SCHEMA,describeError };
