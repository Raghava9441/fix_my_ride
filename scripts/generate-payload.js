// POC: computes what percentage of lines changed across git history came
// from commits authored by Claude Code — identified by the
// "Co-Authored-By: Claude" trailer this tool appends to its own commits —
// then builds a payload shaped like a real Jira issue-update request
// (PUT /rest/api/3/issue/{issueIdOrKey}, body: { fields: { <customfieldId>: value } }).
const { execFileSync } = require("child_process");
const fs = require("fs");


const CUSTOM_FIELD_ID = process.env.JIRA_CUSTOM_FIELD_ID || "customfield_10050";
const COMMIT_MARKER = "@@COMMIT@@";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 50 });
}

function getAiCommitShas() {
  let output;
  try {
    output = git([
      "log",
      "--no-merges",
      "-i",
      "--grep=Co-Authored-By:.*Claude",
      "--pretty=format:%H",
    ]);
  } catch {
    // git log --grep exits non-zero on some git versions when there are zero matches
    return new Set();
  }
  return new Set(output.split("\n").filter(Boolean));
}

function getLineChangesBySha() {
  const output = git([
    "log",
    "--no-merges",
    "--numstat",
    `--pretty=format:${COMMIT_MARKER}%H`,
  ]);

  const changes = {};
  let currentSha = null;
  for (const line of output.split("\n")) {
    if (line.startsWith(COMMIT_MARKER)) {
      currentSha = line.slice(COMMIT_MARKER.length);
      changes[currentSha] = 0;
      continue;
    }
    if (!currentSha || !line.trim()) continue;
    const [added, removed] = line.split("\t");
    const a = parseInt(added, 10);
    const r = parseInt(removed, 10);
    if (!Number.isNaN(a)) changes[currentSha] += a;
    if (!Number.isNaN(r)) changes[currentSha] += r;
  }
  return changes;
}

const aiShas = getAiCommitShas();
const changesBySha = getLineChangesBySha();

let aiLines = 0;
let totalLines = 0;
let aiCommitCount = 0;
for (const [sha, lines] of Object.entries(changesBySha)) {
  totalLines += lines;
  if (aiShas.has(sha)) {
    aiLines += lines;
    aiCommitCount += 1;
  }
}

const rawPercentage = totalLines === 0 ? 0 : (aiLines / totalLines) * 100;
const percentage = Math.min(100, Math.max(0, Math.round(rawPercentage / 5) * 5));

const payload = {
  fields: {
    [CUSTOM_FIELD_ID]: `${percentage}%`,
  },
  meta: {
    commitSha: process.env.GITHUB_SHA,
    ref: process.env.GITHUB_REF,
    actor: process.env.GITHUB_ACTOR,
    totalCommits: Object.keys(changesBySha).length,
    aiCommits: aiCommitCount,
    aiLinesChanged: aiLines,
    totalLinesChanged: totalLines,
    rawPercentage: Number(rawPercentage.toFixed(2)),
    generatedAt: new Date().toISOString(),
  },
};

fs.writeFileSync("payload.json", JSON.stringify(payload, null, 2));
console.log("Generated payload:");
console.log(JSON.stringify(payload, null, 2));
