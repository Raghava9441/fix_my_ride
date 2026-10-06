/**
 * Computes the AI-contribution percentage of a range of commits and logs it. Nothing is written
 * anywhere -- no Jira or other API calls are made, and the git-ai binary is NOT needed.
 *
 * It reproduces what `git ai stats <base>..<head>` does, using only plain git and the attribution
 * notes git-ai stores in refs/notes/ai:
 *   1. added lines   = `git diff --numstat base head` (the NET diff, so lines rewritten later in
 *                      the range count once), minus git-ai's default ignore patterns (lockfiles,
 *                      generated files, vendor dirs, .gitattributes linguist-generated, .git-ai-ignore)
 *   2. which commit  = `git blame` of every added line at head -> the commit that introduced it
 *   3. AI or human   = that commit's note (`git notes --ref=ai show <sha>`) lists AI line ranges per
 *                      file as of that commit; the blamed line is looked up in it
 * AI % = AI lines / added lines. Added lines with no matching attestation are "unknown".
 *
 * Pass the original pre-merge range, never a squash commit: a squashed commit is a new SHA with no
 * note, so every line reads as unknown. The guards below reject that rather than log a wrong value.
 *
 * Usage:
 *   node compute-and-update.mjs --base <sha> --head <sha>
 *   node compute-and-update.mjs --pr 499
 *   node compute-and-update.mjs --pr 499 --ticket MEW-1234   (ticket is optional, label only)
 *
 * Env:
 *   ALLOW_PARTIAL    "true" to warn instead of abort when some commits lack attribution
 *   GITHUB_OUTPUT    when set (GitHub Actions), ai_percent / rounded_percent are written to it
 */

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const ROUND_TO = 5; // report the percentage in 5% steps as well as the raw value

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PR = arg("pr");

const ALLOW_PARTIAL = process.env.ALLOW_PARTIAL === "true";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function notice(message) {
  console.log(`::notice::${message}`);
}

function warn(message) {
  console.log(`::warning::${message}`);
}

function git(args, allowFail = false) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", allowFail ? "ignore" : "inherit"],
    });
  } catch (error) {
    if (allowFail) return "";
    throw error;
  }
}

// Jira keys are uppercase. A case-insensitive [A-Za-z]+-[0-9]+ matches non-ticket noise that occurs
// in real branch names in this repo -- "revert-408" out of revert-408-MEW-7169-... -- so it is not used.
// The key is only a label in the log; the percentage does not depend on it.
const KEY_RE = /[A-Z]{2,10}-[0-9]+/;

/**
 * Resolves a PR into { ticket (may be empty), base, head } without the caller naming any of them.
 *
 * The ticket key is searched across four sources in priority order. Measured over the last 60
 * merged PRs in this repo, no single source is sufficient:
 *   branch name 55% | PR title 83% | PR body 77% | any of them 93%
 * The 7% with no key anywhere were genuinely ticketless. Keying off the branch name alone -- the
 * obvious approach -- would silently miss nearly half of all stories.
 *
 * base/head come from the PR's recorded SHAs, not its branches: after a merge the source branch is
 * usually deleted, and the merged commit carries no usable attribution (a squash is a fresh SHA with
 * no note, a merge commit is skipped by git-ai). refs/pull/<n>/head still resolves either way.
 */
function resolvePr(spec) {
  const number = spec.match(/\/pull\/(\d+)/)?.[1] ?? spec.match(/^#?(\d+)$/)?.[1];
  if (!number) fail(`Could not read a PR number from "${spec}". Pass a number or a .../pull/<n> URL.`);

  let info;
  try {
    info = JSON.parse(
      execFileSync("gh", ["pr", "view", number, "--json", "baseRefOid,headRefOid,headRefName,title,body,number,url,state"], {
        encoding: "utf8",
      })
    );
  } catch (error) {
    fail(`gh pr view ${number} failed. Is the GitHub CLI authenticated for this repo?\n${error.message}`);
  }

  git(["fetch", "--no-tags", "origin", `refs/pull/${number}/head`], true);

  // Never force-fetch notes: on a developer machine the local ref is usually ahead, holding
  // attribution for unpushed commits, and overwriting it makes those commits read as unknown.
  if (git(["rev-parse", "--verify", "--quiet", "refs/notes/ai"], true).trim() === "") {
    git(["fetch", "--no-tags", "origin", "refs/notes/ai:refs/notes/ai"], true);
  }

  const commitSubjects = git(["log", "--format=%s", `${info.baseRefOid}..${info.headRefOid}`], true);
  const sources = [
    ["branch name", info.headRefName],
    ["PR title", info.title],
    ["commit message", commitSubjects],
    ["PR body", info.body],
  ];

  let ticket = "";
  let source = "";
  for (const [label, text] of sources) {
    const match = (text ?? "").match(KEY_RE);
    if (match) {
      ticket = match[0];
      source = label;
      break;
    }
  }

  console.log(`PR #${info.number} (${info.state}) ${info.title}`);
  console.log(`  branch ${info.headRefName}`);

  if (ticket) console.log(`  ticket ${ticket} (resolved from: ${source})`);

  return { ticket, base: info.baseRefOid, head: info.headRefOid };
}

const pr = PR ? resolvePr(PR) : null;

// Explicit flags always win, so a wrong lookup can be overridden without editing the PR.
const TICKET = arg("ticket", pr?.ticket) ?? "";
const BASE = arg("base", pr?.base);
const HEAD = arg("head", pr?.head);

if (!BASE || !HEAD) {
  fail(
    "Need either:\n" +
      "  --pr <number|url>        (resolves base and head from the PR)\n" +
      "  --base <sha> --head <sha>\n" +
      "Tip for a local branch: git merge-base HEAD origin/main"
  );
}

// ---------------------------------------------------------------- 1. read attribution

// ---- ignore patterns (same defaults and matching as git-ai)

const DEFAULT_IGNORE_PATTERNS = [
  "*.lock", "Cargo.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "go.sum", "Gemfile.lock",
  "poetry.lock", "composer.lock", "Pipfile.lock", "shrinkwrap.yaml",
  "*.generated.*", "*.min.js", "*.min.css", "*.map", "**/__snapshots__/**", "**/*.snap", "**/drizzle/meta/**",
  "**/vendor/**", "**/node_modules/**",
  "*.pbobjc.h", "*.pbobjc.m", "*.pb.go", "*_pb2.py", "*_pb2_grpc.py", "*.pb.swift", "*.pb.dart", "*.pb.cc", "*.pb.h",
];

function readRepoFile(name) {
  return git(["show", `${HEAD}:${name}`], true);
}

function effectiveIgnorePatterns() {
  const patterns = [...DEFAULT_IGNORE_PATTERNS];
  for (const line of readRepoFile(".gitattributes").split("\n")) {
    if (line.includes("linguist-generated") && !line.includes("linguist-generated=false")) {
      const pattern = line.trim().split(/\s+/)[0];
      if (pattern && !pattern.startsWith("#")) patterns.push(pattern);
    }
  }
  for (const line of readRepoFile(".git-ai-ignore").split("\n")) {
    const pattern = line.trim();
    if (pattern && !pattern.startsWith("#")) patterns.push(pattern);
  }
  return [...new Set(patterns)];
}

// Glob semantics of the Rust `glob` crate with default options: `*` and `?` cross "/" too.
function globToRegex(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      i++;
      if (glob[i + 1] === "/") {
        i++;
        out += "(?:.*/)?";
      } else out += ".*";
    } else if (c === "*") out += ".*";
    else if (c === "?") out += ".";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

const ignoreRegexes = effectiveIgnorePatterns().map(globToRegex);
function isIgnored(path) {
  const filename = path.split("/").pop();
  return ignoreRegexes.some((re) => re.test(path) || re.test(filename));
}

// ---- notes

// A note is an attestation section, a "---" line, then a JSON metadata section:
//   src/a.ts                          <- file path (not indented)
//     s_4746e0::t_4d3002 1-33,40      <- "<session>::<turn> <line ranges>" (indented)
//   ---
//   { "sessions": { "s_4746e0": { "agent_id": { "tool": "claude", "model": "..." } } }, ... }
// Line numbers are those of the file as of the commit the note is attached to. Ids starting "h_"
// are known-human lines; every other id (a session, or a legacy prompt hash) is AI.
function parseRanges(text) {
  return text
    .split(",")
    .map((part) => part.trim().split("-").map(Number))
    .filter(([from]) => Number.isFinite(from))
    .map(([from, to]) => [from, Number.isFinite(to) ? to : from]);
}

const noteCache = new Map();
function loadNote(sha) {
  if (noteCache.has(sha)) return noteCache.get(sha);

  const text = git(["notes", "--ref=ai", "show", sha], true);
  if (text.trim() === "") {
    noteCache.set(sha, null);
    return null;
  }

  const sep = text.indexOf("\n---");
  let meta = {};
  try {
    if (sep !== -1) meta = JSON.parse(text.slice(sep + 4));
  } catch {
    // Unreadable metadata only costs the per-tool breakdown; line classification still works.
  }

  const files = new Map(); // path -> [{ id, ranges }]
  let current = null;
  for (const line of (sep === -1 ? text : text.slice(0, sep)).split("\n")) {
    if (!line.trim()) continue;
    const entry = line.match(/^\s+(\S+)\s+([\d,\-\s]+)$/);
    if (entry && current) {
      current.push({ id: entry[1].split("::")[0], ranges: parseRanges(entry[2]) });
    } else if (!/^\s/.test(line)) {
      const path = line.trim().replace(/^"(.*)"$/, "$1");
      current = files.get(path) ?? [];
      files.set(path, current);
    }
  }

  const note = { files, agents: { ...(meta.prompts ?? {}), ...(meta.sessions ?? {}) } };
  noteCache.set(sha, note);
  return note;
}

// -> { kind: "ai" | "human" | "unknown", tool }
function classify(sha, path, line) {
  const note = loadNote(sha);
  const entries = note?.files.get(path);
  if (!entries) return { kind: "unknown" };

  for (const { id, ranges } of entries) {
    if (!ranges.some(([from, to]) => line >= from && line <= to)) continue;
    if (id.startsWith("h_")) return { kind: "human" };
    const agent = note.agents[id]?.agent_id;
    return { kind: "ai", tool: agent ? `${agent.tool}::${agent.model}` : "unknown::unknown" };
  }
  return { kind: "unknown" };
}

// ---- the net diff

// path -> line numbers added at HEAD, from the `git diff -U0` hunk headers.
function addedLinesByFile() {
  const byFile = new Map();
  let path = null;
  for (const row of git(["diff", "-U0", "--no-renames", "--no-color", "--no-textconv", BASE, HEAD]).split("\n")) {
    if (row.startsWith("+++ ")) {
      path = row.startsWith("+++ b/") ? row.slice(6) : null; // "+++ /dev/null" = deleted file
    } else if (path && row.startsWith("@@")) {
      const m = row.match(/\+(\d+)(?:,(\d+))?/);
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      if (!byFile.has(path)) byFile.set(path, []);
      for (let n = start; n < start + count; n++) byFile.get(path).push(n);
    }
  }
  return byFile;
}

// final line number -> { sha, origLine, origPath } for every line of `path` at HEAD.
function blameFile(path) {
  const out = git(["blame", "--line-porcelain", `${BASE}..${HEAD}`, "--", path], true);
  const lines = new Map();
  let cur = null;
  for (const row of out.split("\n")) {
    const header = row.match(/^([0-9a-f]{40}) (\d+) (\d+)/);
    if (header) {
      cur = { sha: header[1], origLine: Number(header[2]), origPath: path };
      lines.set(Number(header[3]), cur);
    } else if (cur && row.startsWith("filename ")) {
      cur.origPath = row.slice(9);
    }
  }
  return lines;
}

const commitSet = new Set(git(["rev-list", `${BASE}..${HEAD}`], true).split("\n").filter(Boolean));
const nonMerge = git(["rev-list", "--no-merges", `${BASE}..${HEAD}`], true).split("\n").filter(Boolean);
const withoutNote = nonMerge.filter((sha) => loadNote(sha) === null);

let added = 0;
let ai = 0;
let human = 0;
const breakdown = {};

for (const [path, addedLines] of addedLinesByFile()) {
  if (isIgnored(path)) continue;
  added += addedLines.length;

  const blame = blameFile(path);
  for (const line of addedLines) {
    const origin = blame.get(line);
    // A line blamed outside the range cannot have been written in it, so it has no attribution here.
    if (!origin || !commitSet.has(origin.sha)) continue;

    const result = classify(origin.sha, origin.origPath, origin.origLine);
    if (result.kind === "ai") {
      ai++;
      breakdown[result.tool] = (breakdown[result.tool] ?? 0) + 1;
    } else if (result.kind === "human") human++;
  }
}

const unknown = added - ai - human;

console.log(`Range ${BASE}..${HEAD} (${nonMerge.length} non-merge commits)`);
console.log(`  added=${added} ai=${ai} human=${human} unknown=${unknown}`);
console.log(`  tools=${JSON.stringify(breakdown)}`);

// ---------------------------------------------------------------- 2. guards
// Each of these corresponds to a failure mode reproduced during MEW-7490 validation. A green job
// that writes a confidently wrong number is worse than a job that refuses to write.

if (added === 0) {
  fail(
    "The range has 0 added lines. It is empty, or contains only merge commits (which carry no " +
      "attribution). Pass the pre-merge base..head range."
  );
}

if (unknown === added) {
  fail(
    `All ${added} added lines are unattributed. This is the signature of attribution lost to a ` +
      "squash/rebase merge, or of notes that were never fetched. Refusing to report 0%."
  );
}

if (withoutNote.length > 0) {
  const message = `${withoutNote.length} of ${nonMerge.length} commits carry no attribution data; the percentage is computed over partial data.`;
  if (ALLOW_PARTIAL) warn(message);
  else fail(`${message} Set ALLOW_PARTIAL=true to report anyway.`);
}

// Not fatal, but the number is less defensible: ::unknown means lines no agent positively claimed
// were still counted as AI. Seen when a human edits outside an IDE that reports known-human saves.
const unknownModels = Object.keys(breakdown).filter((key) => key.endsWith("::unknown"));
if (unknownModels.length > 0) {
  warn(
    `Attribution includes unresolved model(s) ${unknownModels.join(", ")} -- these lines were not ` +
      "positively claimed by any agent and may be human edits made outside a supported IDE. Treat as low confidence."
  );
}

// ---------------------------------------------------------------- 3. percentage

const rawPercent = (ai / added) * 100;
const rounded = Math.min(100, Math.max(0, Math.round(rawPercent / ROUND_TO) * ROUND_TO));
const label = TICKET ? ` (ticket ${TICKET})` : "";
notice(`AI contribution${label}: ${rawPercent.toFixed(1)}% (rounded to ${ROUND_TO}%: ${rounded}%)`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `ai_percent=${rawPercent.toFixed(1)}\nrounded_percent=${rounded}\n`);
}
