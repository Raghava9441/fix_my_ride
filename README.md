# Fix My Ride

Multi-tenant vehicle service management SaaS API (Node.js + Express + TypeScript + MongoDB + Redis).

This README covers **building, linting, running in Docker, and deploying via GitHub Actions**. For environment variable reference, see [`.env.example`](.env.example).

## Requirements

- Node.js >= 18 (repo is developed against Node 20)
- Docker + Docker Compose (for containerized runs)
- MongoDB and Redis (either via Docker, see below, or installed locally)

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the app locally with hot-reload (`ts-node-dev`) |
| `npm run build` | Type-check and compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check only, no output emitted |
| `npm run lint` | Lint `src/**/*.ts` with ESLint |
| `npm run lint:fix` | Lint and auto-fix what's fixable |
| `npm run format` | Format `src/**/*.ts` with Prettier |
| `npm test` | Run the Jest test suite |
| `npm run start` | Run the compiled app from `dist/` (production) |

Run build + typecheck + lint locally before pushing — this is exactly what CI runs:

```bash
npm run lint
npm run typecheck
npm run build
```

## Running with Docker

The project ships a multi-stage [`Dockerfile`](Dockerfile) (deps → build → prod-deps → runtime) and a [`docker-compose.yml`](docker-compose.yml) that runs the app alongside MongoDB and Redis, each with healthchecks and persistent volumes.

Start everything:

```bash
docker-compose up -d --build
```

Check status / logs:

```bash
docker-compose ps
docker-compose logs -f app
```

Stop (add `-v` to also wipe the Mongo/Redis data volumes):

```bash
docker-compose down
```

### How the app connects to Mongo/Redis in Docker

`docker-compose.yml` overrides `MONGODB_URI` and `REDIS_HOST` to point at the `mongo`/`redis` service names (Docker's internal DNS) rather than `localhost`, since that's how containers reach each other on the compose network. Everything else (JWT secrets, SMTP, etc.) is loaded from `.env.development` via `env_file`.

### Building the image standalone (no Compose)

```bash
docker build -t fix-my-ride-app .
docker run -p 5000:5000 --env-file .env.production fix-my-ride-app
```

You'll need `MONGODB_URI` and `REDIS_HOST` in that env file to point at reachable Mongo/Redis instances (e.g. `docker.host.internal`, a cloud database, or containers on the same Docker network).

## CI/CD (GitHub Actions)

Defined in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml), three jobs:

1. **`test`** — runs on every push and PR to `main`: `npm ci`, lint, typecheck, build, test.
2. **`build-and-push`** — runs only on pushes to `main` (after `test` passes): builds the Docker image and pushes it to **GitHub Container Registry** as `ghcr.io/<owner>/<repo>:latest` and `:<short-sha>`. Uses the built-in `GITHUB_TOKEN`, no extra setup needed.
3. **`deploy`** — SSHes into a server and restarts the `app` container with the freshly pushed image. Automatically skipped until you configure the secrets below — it won't fail your pipeline in the meantime.

### Enabling deployment

Add these under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Required | Description |
|---|---|---|
| `DEPLOY_HOST` | yes | Server hostname or IP |
| `DEPLOY_USER` | yes | SSH user |
| `DEPLOY_SSH_KEY` | yes | Private key for that user (no passphrase) |
| `DEPLOY_PORT` | no | SSH port (default `22`) |
| `DEPLOY_PATH` | no | Directory on the server holding `docker-compose.yml` (default `~/fix_my_ride`) |

One-time setup **on the server**:

```bash
docker login ghcr.io -u <github-username>   # use a PAT with read:packages scope
mkdir -p ~/fix_my_ride && cd ~/fix_my_ride
```

Place a copy of `docker-compose.yml` there, plus:
- a `.env` (Compose variable substitution, not app config) containing:
  ```
  IMAGE_NAME=ghcr.io/<owner>/<repo>
  IMAGE_TAG=latest
  ```
- a `.env.production` with the app's real runtime secrets (`JWT_SECRET`, `MONGODB_URI`, etc.)

Once those secrets exist, every merge to `main` will build, push, and redeploy automatically.

## Repo conventions worth knowing

- `package-lock.json` **is** committed (needed for reproducible `npm ci` in both Docker and CI) — don't re-add it to `.gitignore`.
- Real secrets live in `.env.<environment>` files, all git-ignored except `.env.example`. Docker/CI supply them via `env_file` or repo secrets, never by baking them into the image.
- ESLint config is `.eslintrc.json` (TypeScript-aware, warnings don't fail CI — only errors do).
