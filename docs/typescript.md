# TypeScript

## Compiler configuration

`tsconfig.json`: `target: ES2021`, `module: CommonJS`, `moduleResolution: node`, `strict: true` (plus explicit `noImplicitAny`, `strictNullChecks`), `esModuleInterop`, `isolatedModules`, `skipLibCheck`. Output goes to `dist/` from `rootDir: ./src`. There's an unused `@/*` → `src/*` path alias (`baseUrl`/`paths`) — nothing in the codebase actually imports via `@/`, everything uses relative imports.

**Pin `typescript` to `^5.9.x`. Do not upgrade to 7.x.** That was tried; TS7 removes `moduleResolution: "node"` and `baseUrl` outright (would force `moduleResolution: "node16"` + `module: "Node16"` + explicit `.js` extensions on relative dynamic `import()` calls), and as of now neither `ts-jest@29.x` nor the installed `@typescript-eslint` major support TypeScript 7 — `npm install` itself fails on the `ts-jest` peer-dependency ceiling. If you hit this again, downgrade `typescript` rather than chase config changes to accommodate 7.x.

## Strict-mode fallout you'll actually hit

With `strictNullChecks` on, Mongoose subdocuments/populated fields are a frequent source of "possibly null/undefined" errors. The convention here:
- If a field is *always* present by the time application code reads it (e.g. `stats`, `limits` objects that ship with schema defaults for every subfield), declare it **non-optional** in the model's `I<Model>` interface even though Mongoose's own inference might treat the parent object as optional. That's a deliberate choice reflecting the real invariant, not a workaround — see e.g. `stats`/`limits` on `Tenant`, `StaffProfile`, `OwnerProfile`.
- If a field is genuinely sometimes absent, add the real null-check at the call site rather than asserting it away with `!`.

## The Mongoose statics/methods typing pattern

This is the single most important TypeScript convention in the codebase — full detail in [mongoose.md](mongoose.md). Short version: every model that adds custom `schema.methods.x` / `schema.statics.x` must declare an `I<Model>` document interface (with the method signatures) and an `I<Model>Model` interface extending `Model<I<Model>>` (with the static signatures), pass both as `Schema<IDoc, IModel>` generics, and annotate `this: IDoc` / `this: IModel` on each method/static function expression. Skipping this means the method compiles fine inside the model file (because untyped `this` is implicitly `any` there) but produces "Property X does not exist" errors at every call site in services — that exact class of bug was the majority of the TypeScript errors fixed in this codebase's history.

## Dynamic imports / ESM-only packages

A few services use `await import("../utils/token")` for lazy loading. Under the current `moduleResolution: node`, these stay extensionless. If a package you add turns out to be ESM-only (check its `package.json` `exports` field for a `require` condition before installing) and can't be `require()`'d from this CommonJS codebase, prefer swapping to a Node built-in equivalent if one exists (this happened with `uuid@13` → `crypto.randomUUID()`) over restructuring module resolution to accommodate it.

## Linting

`.eslintrc.json` is TypeScript-aware (`@typescript-eslint`), `no-explicit-any` is intentionally **off** given the pragmatic `any` usage described in [coding-standards.md](coding-standards.md). Warnings (mostly `no-unused-vars`) don't fail `npm run lint`; only errors do, and that's what CI enforces.
