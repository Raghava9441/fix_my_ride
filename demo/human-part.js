/**
 * Typed by a human, for the Git AI attribution test.
 * None of these lines should be reported as AI-authored.
 */

const { sum, average } = require("./ai-part");

function describe(label, values) {
  return {
    label,
    count: values.length,
    total: sum(values),
    mean: Number(average(values).toFixed(2)),
  };
}

function format(report) {
  return `${report.label}: ${report.count} values, total ${report.total}, mean ${report.mean}`;
}

module.exports = { describe, format };
