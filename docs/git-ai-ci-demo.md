# Git AI CI demo

Proves that AI attribution (`refs/notes/ai`) survives a **squash merge** on GitHub.
Reference: https://usegitai.com/docs/team-usage/ci-workflows

## Why CI is needed
GitHub creates the squash/rebase commit server-side, where git-ai does not run, so the
new commit has no note. `git ai ci github run` (run on `pull_request: closed`, merged only,
with `contents: write`) rewrites the authorship notes onto the new commit.

## Pieces in this repo
- `.github/workflows/ai-contribution.yml` – installs git-ai, runs `git ai ci github run`,
  scores the PR with `scripts/ai-percentage.js`, writes a job summary + `report.json` artifact.
- `.github/workflows/ai-percentage-on-push.yml` – log-only percentage on every push.

## Run the demo
1. Branch `demo/git-ai-ci`: make 2-3 commits with an AI agent plus 1 hand-written commit.
2. `git push -u origin demo/git-ai-ci` then `git push origin refs/notes/ai`.
3. Open a PR and **Squash and merge**.
4. Watch the `AI contribution` run: summary should show AI% > 0 and 0 unattributed commits.
5. Verify locally:
   ```bash
   git fetch origin main refs/notes/ai:refs/notes/ai
   git ai stats <merge-sha>^..<merge-sha> --json
   node scripts/ai-percentage.js --pr <n>
   ```
   Expected: non-zero `ai_additions` and `human_additions`; the number matches the CI summary.
6. Negative control (optional): disable the "Repair attribution" step, repeat, and
   observe the squash commit has no note and stats report 0 AI.
