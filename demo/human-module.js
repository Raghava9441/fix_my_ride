/**
 * Typed by a human. None of these lines should be attributed to the agent.
 */

const { validate } = require("./ai-module");

const USER_SCHEMA = {
  name: { required: true, minLength: 2 },
  email: { required: true, email: true },
};

function checkUser(input) {
  const result = validate(input, USER_SCHEMA);
  if (result.valid) {
    return { ok: true, message: "user is valid" };
  }
  const fields = Object.keys(result.errors).join(", ");
  return { ok: false, message: `invalid fields: ${fields}` };
}

function describeErrors(result) {
  return Object.entries(result.errors).map(([field, rules]) => {
    return `${field} failed: ${rules.join(" and ")}`;
  });
}

module.exports = { checkUser, describeErrors, USER_SCHEMA };
