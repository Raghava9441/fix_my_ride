// Computes what share of a change was written by an AI agent, using the
// line-level attribution Git AI stores in refs/notes/ai.
//
// This supersedes generate-payload.js, which inferred authorship from the
// "Co-Authored-By: Claude" commit trailer. That approach marks an entire
// commit as AI even when a human wrote most of it, and misses AI code in a
// commit without the trailer. Git AI records which individual lines an agent
// produced, so the number here is measured rather than inferred.
//
// Usage:
//   node scripts/ai-percentage.js --pr 2
//   node scripts/ai-percentage.js --pr 1,2,3
//   node scripts/ai-percentage.js --range <base-sha>..<head-sha>
//   node scripts/ai-percentage.js --commit HEAD
//   node scripts/ai-percentage.js --pr 2 --json
//   node scripts/ai-percentage.js --pr 2 --github-output   (writes to $GITHUB_OUTPUT)
//
// Set GITHUB_TOKEN for private repositories or to avoid API rate limits.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// A PR whose commits are not all attributed produces a misleadingly low
// percentage, because unattributed lines land in "unknown" rather than
// "human". Callers can act on this instead of publishing a wrong number.
const EXIT_INCOMPLETE_ATTRIBUTION = 3;

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
    windowsHide: true,
    ...opts,
  });
}

function git(args) {
  return run("git", args);
}

function gitQuiet(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

// The installer edits shell profiles, so the binary is often absent from PATH
// in CI steps and non-login shells. Fall back to its known install location.
function resolveGitAi() {
  if (process.env.GIT_AI_BIN) return process.env.GIT_AI_BIN;
  try {
    run("git-ai", ["version"], { stdio: "pipe" });
    return "git-ai";
  } catch {
    /* not on PATH */
  }
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  for (const name of ["git-ai.exe", "git-ai"]) {
    const candidate = path.join(home, ".git-ai", "bin", name);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "git-ai not found. Install it from https://usegitai.com, or set GIT_AI_BIN."
  );
}

function parseArgs(argv) {
  const opts = { format: "text" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pr") opts.prs = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--range") opts.range = argv[++i];
    else if (a === "--commit") opts.commit = argv[++i];
    else if (a === "--repo") opts.repo = argv[++i];
    else if (a === "--json") opts.format = "json";
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--github-output") opts.githubOutput = true;
    else if (a === "--no-fetch") opts.noFetch = true;
    else if (a === "--help" || a === "-h") opts.help = true;
  }
  return opts;
}

/** owner/repo, from --repo, GITHUB_REPOSITORY, or the origin remote. */
function resolveRepo(explicit) {
  if (explicit) return explicit;
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = (gitQuiet(["remote", "get-url", "origin"]) || "").trim();
  const m = url.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) throw new Error(`cannot determine owner/repo from origin: ${url || "(no remote)"}`);
  return `${m[1]}/${m[2]}`;
}

async function fetchPr(repo, number) {
  const headers = { "User-Agent": "ai-percentage", Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${number}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for PR #${number}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * The notes ref is not part of the default fetch refspec, so a fresh clone has
 * no attribution at all and every line would read as unknown. Fetching the PR
 * head matters too: after a squash merge the original commits survive only as
 * refs/pull/N/head.
 */
function fetchAttribution(prNumbers) {
  gitQuiet(["fetch", "--force", "--quiet", "origin", "+refs/notes/ai:refs/notes/ai"]);
  for (const n of prNumbers || []) {
    gitQuiet(["fetch", "--force", "--quiet", "origin", `pull/${n}/head`]);
  }
  return gitQuiet(["rev-parse", "--verify", "--quiet", "refs/notes/ai"]) !== null;
}

/**
 * Single-commit output puts the counters at the top level; range output nests
 * them under range_stats and adds authorship_stats. Normalize both into one
 * shape so callers do not have to care which was used.
 */
function normalize(raw) {
  const stats = raw.range_stats || raw;
  const authorship = raw.authorship_stats || null;
  const added = stats.git_diff_added_lines || 0;

  const pct = (n) => (added === 0 ? 0 : Math.round((n / added) * 1000) / 10);

  return {
    ai: stats.ai_additions || 0,
    aiAccepted: stats.ai_accepted || 0,
    human: stats.human_additions || 0,
    unknown: stats.unknown_additions || 0,
    added,
    deleted: stats.git_diff_deleted_lines || 0,
    // Percentages are taken against every added line, never against ai+human.
    // Dividing by ai+human hides the unknown bucket and inflates the AI share
    // on any repo with commits made before Git AI was installed.
    aiPct: pct(stats.ai_additions || 0),
    humanPct: pct(stats.human_additions || 0),
    unknownPct: pct(stats.unknown_additions || 0),
    byModel: stats.tool_model_breakdown || {},
    commits: authorship ? authorship.total_commits : 1,
    commitsAttributed: authorship ? authorship.commits_with_authorship : null,
    unattributed: authorship ? authorship.commits_without_authorship_with_authors || [] : [],
  };
}

function rangeHead(spec) {
  const m = spec.match(/\.\.\.?(.+)$/);
  return (m ? m[1] : spec).trim();
}

/** True when `sha` is contained in the history of the current checkout. */
function isReachableFromHead(sha) {
  return gitQuiet(["merge-base", "--is-ancestor", sha, "HEAD"]) !== null;
}

function currentRef() {
  const branch = gitQuiet(["symbolic-ref", "--quiet", "--short", "HEAD"]);
  return branch ? branch.trim() : git(["rev-parse", "HEAD"]).trim();
}

/**
 * git ai stats resolves a range against the checked-out branch, not against
 * the object database, so scoring a PR from a different branch fails with
 * "not reachable from refname ...". Detaching to the range head for the
 * duration of the call is enough, and the original ref is restored after.
 *
 * This rarely triggers in CI, where the checkout already contains the PR head.
 */
function statsFor(gitAi, spec) {
  const head = rangeHead(spec);
  const needsDetach = !isReachableFromHead(head);
  let restoreTo = null;

  if (needsDetach) {
    restoreTo = currentRef();
    try {
      git(["checkout", "--quiet", "--detach", head]);
    } catch (err) {
      throw new Error(
        `cannot reach ${head.slice(0, 8)} from the current checkout, and detaching failed. ` +
          `Commit or stash your changes, or run this from the PR branch.\n${err.message}`
      );
    }
  }

  try {
    return normalize(JSON.parse(run(gitAi, ["stats", spec, "--json"])));
  } finally {
    if (restoreTo) gitQuiet(["checkout", "--quiet", restoreTo]);
  }
}

function renderText(entry) {
  const { label, spec, result } = entry;
  const r = result;
  const row = (name, n, p) =>
    `  ${name.padEnd(9)}${String(n).padStart(8)} lines  ${String(p).padStart(6)}%`;

  const lines = [
    "",
    `  ${label}`,
    `  ${spec}`,
    "  " + "-".repeat(46),
    row("AI", r.ai, r.aiPct),
    row("Human", r.human, r.humanPct),
    row("Unknown", r.unknown, r.unknownPct),
    "  " + "-".repeat(46),
    `  ${r.added} added / ${r.deleted} deleted across ${r.commits} commit(s)`,
  ];

  if (r.commitsAttributed !== null) {
    lines.push(`  attribution present on ${r.commitsAttributed} of ${r.commits} commit(s)`);
  }
  for (const [model, v] of Object.entries(r.byModel)) {
    lines.push(`  ${model} -> ${v.ai_additions} added, ${v.ai_accepted} surviving`);
  }
  if (r.unattributed.length) {
    lines.push("");
    lines.push(`  WARNING: ${r.unattributed.length} commit(s) carry no attribution.`);
    lines.push(`  ${r.unknown} line(s) are unknown rather than human. Those authors need Git AI installed.`);
    for (const [sha, who] of r.unattributed.slice(0, 10)) {
      lines.push(`    ${String(sha).slice(0, 8)}  ${who}`);
    }
    if (r.unattributed.length > 10) lines.push(`    ... and ${r.unattributed.length - 10} more`);
  }
  lines.push("");
  return lines.join("\n");
}

function writeGithubOutput(result) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const pairs = {
    ai_pct: result.aiPct,
    human_pct: result.humanPct,
    unknown_pct: result.unknownPct,
    ai: result.ai,
    human: result.human,
    unknown: result.unknown,
    added: result.added,
    missing_commits: result.unattributed.length,
  };
  fs.appendFileSync(
    file,
    Object.entries(pairs).map(([k, v]) => `${k}=${v}`).join("\n") + "\n"
  );
}

const HELP = `
ai-percentage - AI contribution share from Git AI notes

  --pr <n[,n...]>   score one or more pull requests
  --range <a..b>    score an explicit commit range
  --commit <sha>    score a single commit
  --repo <o/r>      owner/repo (default: origin remote)
  --json            machine-readable output
  --out <file>      also write the JSON to a file
  --github-output   append results to $GITHUB_OUTPUT
  --no-fetch        skip fetching notes (assume they are local)

Exit ${EXIT_INCOMPLETE_ATTRIBUTION} means some commits lacked attribution, so the
percentage understates AI and should not be published.
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const gitAi = resolveGitAi();
  const entries = [];

  if (opts.prs) {
    const repo = resolveRepo(opts.repo);
    if (!opts.noFetch) fetchAttribution(opts.prs);
    for (const n of opts.prs) {
      const pr = await fetchPr(repo, n);
      const spec = `${pr.base.sha}..${pr.head.sha}`;
      entries.push({
        label: `PR #${pr.number}  ${pr.title}`,
        spec,
        pr: pr.number,
        merged: pr.merged,
        result: statsFor(gitAi, spec),
      });
    }
  } else if (opts.range || opts.commit) {
    if (!opts.noFetch) fetchAttribution([]);
    const spec = opts.range || opts.commit;
    entries.push({ label: opts.range ? "range" : "commit", spec, result: statsFor(gitAi, spec) });
  } else {
    process.stderr.write("Nothing to score. Pass --pr, --range or --commit.\n" + HELP);
    return 2;
  }

  const payload = entries.length === 1 ? entries[0] : entries;

  if (opts.format === "json") {
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  } else {
    for (const e of entries) process.stdout.write(renderText(e));
  }

  // Lets CI print the readable block AND keep the JSON without paying for a
  // second stats run, which is the slow part on any sizable range.
  if (opts.out) fs.writeFileSync(opts.out, JSON.stringify(payload, null, 2) + "\n");

  if (opts.githubOutput && entries.length === 1) writeGithubOutput(entries[0].result);

  // Non-zero when any scored change had commits without attribution.
  return entries.some((e) => e.result.unattributed.length) ? EXIT_INCOMPLETE_ATTRIBUTION : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`ai-percentage: ${err.message}\n`);
    process.exit(1);
  });
