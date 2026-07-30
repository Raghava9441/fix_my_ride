# syntax=docker/dockerfile:1

# ─── Stage 1: dependencies ────────────────────────────────────────────────────
# Installs full (dev + prod) deps once, cached separately from source changes.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: build ────────────────────────────────────────────────────────────
# Compiles TypeScript to dist/ using the full dependency set from `deps`.
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── Stage 3: production dependencies ─────────────────────────────────────────
# Fresh install with only prod deps, so they aren't bloated by dev tooling.
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 4: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Created here (not COPYed) so it exists with correct ownership even before
# anything is uploaded; storage.ts falls back to <cwd>/uploads.
RUN mkdir -p uploads && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||5000)+'/live', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
