/**
 * Computes the AI-contribution percentage of a range of commits from git-ai line attribution and
 * logs it. Nothing is written anywhere -- no Jira or other API calls are made.
 *
 * Percentage source: git ai stats <base>..<head> --json, which reads line-level attribution from
 * the refs/notes/ai git-notes ref. git-ai pushes that ref automatically alongside the branch, and
 * a fresh clone reproduces identical numbers once the ref is fetched.
 *
 * MUST be given the original pre-merge range, never a squash/merge commit:
 *   - a squashed commit is a new SHA with no note -> every line reads as unknown
 *   - a true merge commit is skipped entirely by git-ai -> all counters return 0
 * Both cases would silently yield 0%. The guards below reject them rather than logging a wrong value.
 *
 * Usage:
 *   node compute-and-update.mjs --base <sha> --head <sha>
 *   node compute-and-update.mjs --pr 499
 *   node compute-and-update.mjs --pr 499 --ticket MEW-1234   (ticket is optional, label only)
 *
 * Env:
 *   GIT_AI_BIN       default "git-ai" from PATH
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

const GIT_AI_BIN = process.env.GIT_AI_BIN ?? "git-ai";
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
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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

  // git ai stats <range> resolves the range against the CURRENTLY CHECKED-OUT branch, and fails
  // with "Commit <sha> is not reachable from refname refs/heads/<branch>" if the range sits on a
  // different line of history. Fetching the PR ref is not enough, and neither is creating a local
  // ref for it -- only the checked-out branch counts. Detect it here so the message names the fix
  // instead of surfacing git-ai's internal one.
  const headReachable = (() => {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", info.headRefOid, "HEAD"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  if (!headReachable) {
    const current = git(["rev-parse", "--abbrev-ref", "HEAD"], true).trim();
    fail(
      `PR #${number}'s head (${info.headRefOid.slice(0, 8)}) is not reachable from the checked-out branch ` +
        `"${current}", and git-ai resolves ranges against the current branch only.\n` +
        `Run this from the PR's branch:  git checkout ${info.headRefName}`
    );
  }

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

let raw;
try {
  raw = execFileSync(GIT_AI_BIN, ["stats", `${BASE}..${HEAD}`, "--json"], { encoding: "utf8" });
} catch (error) {
  fail(`git-ai stats failed for ${BASE}..${HEAD}: ${error.message}`);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  fail(`git-ai returned unparseable JSON: ${raw.slice(0, 300)}`);
}

// A single commit returns the stats object directly; a range nests it under range_stats and adds a
// per-commit coverage audit under authorship_stats.
const stats = parsed.range_stats ?? parsed;
const audit = parsed.authorship_stats ?? null;

const added = stats.git_diff_added_lines ?? 0;
const ai = stats.ai_additions ?? 0;
const human = stats.human_additions ?? 0;
const unknown = stats.unknown_additions ?? 0;
const breakdown = stats.tool_model_breakdown ?? {};

console.log(`Range ${BASE}..${HEAD}`);
console.log(`  added=${added} ai=${ai} human=${human} unknown=${unknown}`);
console.log(`  tools=${JSON.stringify(breakdown)}`);

// ---------------------------------------------------------------- 2. guards
// Each of these corresponds to a failure mode reproduced during MEW-7490 validation. A green job
// that writes a confidently wrong number is worse than a job that refuses to write.

if (added === 0) {
  fail(
    "git-ai reports 0 added lines. This is the signature of being handed a merge commit " +
      "(git-ai skips commits with >1 parent) or an empty range. Pass the pre-merge base..head range."
  );
}

if (unknown === added) {
  fail(
    `All ${added} added lines are unattributed. This is the signature of attribution lost to a ` +
      "squash/rebase merge, or of notes that were never fetched. Refusing to report 0%."
  );
}

if (audit && Array.isArray(audit.commits_without_authorship) && audit.commits_without_authorship.length > 0) {
  const missing = audit.commits_without_authorship.length;
  const total = audit.total_commits ?? "?";
  const message = `${missing} of ${total} commits carry no attribution data; the percentage is computed over partial data.`;
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
