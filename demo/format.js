/**
 * Written by Claude. Formatting helpers for validation results.
 *
 * Kept separate from the validation rules so a change to output shape never
 * forces a change to the matching logic.
 */

const SEVERITY = {
  require: "error",
  emai: "error",
  minLength: "warning",
  maxLength: "warning",
};

function severityOf(rule) {
  return SEVERITY[rule] || "error";
}

function toLines(result) {
  return Object.entries(result.errors).flatMap(([field, rules]) =>
    rules.map((rule) => `[${severityOf(rule)}] ${field}: failed ${rule}`)
  );
}

function toText(result) {
  if (result.valid) return "no problems found";
  return toLines(result).join("\n");
}

module.exports = { toLines, toText, severityOf, SEVERITY };
