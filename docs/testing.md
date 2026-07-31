# Testing

## Current state

There are **no test files and no Jest configuration** in this repo today — not even a `jest.config.js`. `package.json` has the scripts wired up (`test`, `test:watch`, `test:coverage`, and `test:integration` which points at a `jest.integration.config.js` that also doesn't exist) and `jest`/`ts-jest`/`@types/jest` are installed, but running `npm test` right now just runs Jest against an empty suite. Don't assume prior test coverage exists for any given module, and don't assume a Jest config exists to extend — you'll need to add one.

## If you're adding the first tests

At minimum you'll need a `jest.config.js` wiring up `ts-jest` as the transform for `.ts` files and a `testEnvironment: "node"`. Given the codebase:
- **Services** are the natural unit-test boundary — they're plain classes with a singleton export (`export const vehicleService = new VehicleService()`), taking Mongoose models as an implicit dependency (imported directly, not injected). Mocking a model means mocking the module import (e.g. `jest.mock("../models/Vehicle")`), since there's no constructor-injected repository layer to swap out (see [architecture.md](architecture.md) — the repository pattern in `src/repositories/` is unused, don't build tests around it).
- **Integration-style tests** against a real/in-memory MongoDB (e.g. `mongodb-memory-server`, not currently a dependency) would be the more realistic way to exercise the multi-tenancy plugin ([multi-tenancy.md](multi-tenancy.md)) and the Mongoose statics/methods pattern ([mongoose.md](mongoose.md)), since both depend on real query-middleware execution that's awkward to fully mock.
- `src/seeds/` already gives you realistic fixture-shaped data to seed a test database from (`npm run seed:dev` seeds a real Mongo instance — for automated tests you'd want an equivalent seeding step against an ephemeral test DB, driven by `NODE_ENV=test` / `.env.test`, which the env-loading precedence in `config/load.ts` already supports).

## Manual verification in the meantime

Until real tests exist, the practical safety net for a change is:
```bash
npm run lint
npm run typecheck
npm run build
```
plus running the app against the Dockerized Mongo/Redis (see `README.md`) and exercising the affected endpoint(s) manually. Don't claim something is "tested" without having actually done one of these — see the general guidance about not fabricating test coverage.
