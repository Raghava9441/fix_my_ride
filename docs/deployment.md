# Deployment

Quick-start commands are in [README.md](../README.md) — this doc covers the same system in more depth for anyone (human or Claude) working on the pipeline itself.

## Container image

`Dockerfile` is a 4-stage build:
1. `deps` — `npm ci` with full (dev+prod) dependencies, cached independently of source changes.
2. `build` — copies source + `deps`' `node_modules`, runs `npm run build` (`tsc` → `dist/`).
3. `prod-deps` — a **separate** `npm ci --omit=dev`, so the final image's `node_modules` never contains dev tooling (ts-node, eslint, jest, etc.).
4. `runtime` — copies only `dist/` + prod `node_modules` + `package.json`, runs as a non-root `nodejs` user, creates `uploads/` with correct ownership, exposes port 5000, and has a `HEALTHCHECK` against `GET /live` (the liveness probe — deliberately not `/health`, which also checks Mongo/Redis and would flap the container healthy/unhealthy on transient dependency issues rather than reflecting whether the process itself is alive).

`.dockerignore` excludes `node_modules`, `.git`, `.env*` (except `.env.example`), build output, and the Docker/CI files themselves from the build context.

## Compose stack

`docker-compose.yml` runs `app` + `mongo` (7) + `mongo-init` + `redis` (7-alpine), each with a healthcheck and a named volume (`mongo-data`, `redis-data`, `uploads-data`). Details worth knowing:
- The `app` service's `MONGODB_URI`/`REDIS_HOST` are **overridden** to point at the `mongo`/`redis` service names (Docker's internal DNS) even though `.env.development` (loaded via `env_file` for everything else) points at `localhost` — that's intentional, `localhost` inside the `app` container would mean the container itself, not the sibling `mongo` container.
- The `app` service declares both `build:` (used for local `docker-compose up --build`) **and** `image: ${IMAGE_NAME:-fix-my-ride-app}:${IMAGE_TAG:-latest}` (used on a server via `docker compose pull`, once CI has pushed a real image there). Don't remove either half — they serve different environments off the same file.
- **`mongo` runs as a single-node replica set (`rs0`)**, not a plain standalone `mongod` — `mongo-init` is a one-shot container that runs `rs.initiate()` once (idempotent, safe on every `up`), and `app` waits for it (`condition: service_completed_successfully`) before starting. This is required, not cosmetic: Mongoose transactions (`mongoose.startSession()`) — used by the org-onboarding signup flow and `src/seeds/admin.seed.ts`, both of which create several documents atomically — throw immediately against a standalone `mongod`. `MONGODB_URI` for the `app` service includes `?replicaSet=rs0` accordingly.
- **If you run MongoDB natively instead of via this compose file** (`npm run dev` against a locally-installed `mongod`, not `docker-compose up`), you need to initiate a replica set yourself for the same reason — a stock `brew install mongodb-community` / `apt install mongodb` setup is standalone by default. Either add `replication.replSetName: rs0` to your local `mongod.conf` (or `--replSet rs0` on the command line) and run `mongosh --eval "rs.initiate()"` once, or point `MONGODB_URI` at an already-replica-set-backed instance (e.g. a free MongoDB Atlas cluster, which is always a replica set). Signup/seeding will fail with a "Transaction numbers are only allowed on a replica set member or mongos" error otherwise.

## CI/CD (`.github/workflows/ci-cd.yml`)

Three jobs, gated in sequence:
1. **`test`** (every push/PR to `main`) — `npm ci`, `lint`, `typecheck`, `build`, `test -- --passWithNoTests` (see [testing.md](testing.md) for why `--passWithNoTests` is there — there are no tests yet).
2. **`build-and-push`** (push to `main` only, after `test` passes) — builds the Docker image and pushes to `ghcr.io/<owner>/<repo>` tagged `:latest` and `:<short-sha>`, authenticating with the built-in `GITHUB_TOKEN` (no extra secret needed for this step).
3. **`deploy`** — SSHes into a server (`appleboy/ssh-action`) and runs `docker compose pull app && docker compose up -d --no-deps app`. Gated on `secrets.DEPLOY_HOST != ''` so it silently no-ops (not fails) until deploy secrets are actually configured.

Required secrets for `deploy` to activate: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (required); `DEPLOY_PORT`, `DEPLOY_PATH` (optional, have defaults). The server itself needs, once: `docker login ghcr.io` with a PAT (`read:packages` scope), a checked-out/copied `docker-compose.yml`, a `.env` next to it (Compose variable substitution — `IMAGE_NAME=ghcr.io/<owner>/<repo>`, `IMAGE_TAG=latest`) distinct from the app's own `.env.production`.

There's no automated rollback — a bad `:latest` push just gets pulled and deployed on the next `deploy` run. If you need one, the mechanism would be re-tagging a known-good `:<short-sha>` as `:latest` (or pointing the server's `.env` `IMAGE_TAG` at a specific SHA) and re-running the deploy step manually (`workflow_dispatch` is enabled on this workflow for that reason).

## Non-negotiable prerequisite: `package-lock.json` must stay committed

It was previously `.gitignore`'d, which silently broke both `npm ci` in the Dockerfile and a from-scratch CI checkout. It's tracked now — don't re-add it to `.gitignore`.

## TypeScript version constraint

See [typescript.md](typescript.md) — `typescript` is pinned to `^5.9.x`. Bumping it to 7.x breaks `ts-jest`'s peer dependency (blocking `npm ci`/`npm install` entirely) and the ESLint TypeScript plugin, in addition to requiring `tsconfig.json`/dynamic-import changes. This has already been tried and reverted once.
