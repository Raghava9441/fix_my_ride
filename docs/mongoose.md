# Mongoose Patterns

## The statics/methods typing pattern (read this before touching any model)

Mongoose infers a document's field types fine from a plain `new Schema({...})` call with no generics — that's why untyped models don't error on `this.someField`. What it can't infer are **custom** `schema.methods.x` / `schema.statics.x` you add by hand, unless you tell it about them explicitly. Every model in this codebase that has custom methods/statics follows this shape:

```ts
export interface IRole extends Document {
  name: string;
  slug: string;
  // ...every schema field...
  permissions: Types.ObjectId[];

  // instance methods, declared here so callers see them
  getAllPermissions(): Promise<string[]>;
  hasPermission(permissionKey: string): Promise<boolean>;
}

export interface IRoleModel extends Model<IRole> {
  // statics, declared here so callers see them
  findForServiceCenter(centerId: string | Types.ObjectId): mongoose.Query<IRole[], IRole>;
}

const roleSchema = new Schema<IRole, IRoleModel>({ /* ... */ });

roleSchema.methods.hasPermission = async function (this: IRole, permissionKey: string) {
  /* ... */
};

roleSchema.statics.findForServiceCenter = function (this: IRoleModel, centerId: string | Types.ObjectId) {
  /* ... */
};

export const Role = mongoose.model<IRole, IRoleModel>("Role", roleSchema);
```

If you skip the `I<Model>`/`I<Model>Model` interfaces (or skip passing them as `Schema<...>`/`mongoose.model<...>` generics), the method body itself will still compile — `this` inside an untyped schema's method is implicitly `any`. The breakage shows up everywhere *else* that calls `Role.findForServiceCenter(...)` or `role.hasPermission(...)`, as "Property X does not exist on type Model<...>/Document<...>". This exact gap (methods/statics existing at runtime but invisible to TypeScript at the call site) was the majority of the type errors this codebase accumulated — don't reintroduce it.

Reference implementations: `models/Role.ts`, `models/StaffProfile.ts`, `models/OwnerProfile.ts`, `models/Tenant.ts`, `models/Notification.ts`, `models/Invitation.ts`, `models/Permission.ts`, `models/SubscriptionPlan.ts`, `models/Document.ts`, `models/AuditLog.ts`, `models/Account.ts`.

## Populated-field casts

Mongoose can't statically know whether a ref field is populated at a given point, so the field's declared type is always the unpopulated form (`Types.ObjectId`, or `Types.ObjectId[]` for arrays). After `await doc.populate('someRef')`, cast to the resolved shape rather than re-declaring the field as a union:

```ts
await this.populate('roleId');
const role = this.roleId as unknown as { hasPermission(key: string): Promise<boolean> };
```

This is the accepted, deliberate `any`-adjacent pattern described in [typescript.md](typescript.md) — go through `unknown` rather than casting directly, to keep it an obvious, greppable escape hatch.

## Subdocument arrays

Declare embedded array fields as `Types.DocumentArray<{...}>` (not a plain `{...}[]`) when the array holds a mongoose subdocument schema (i.e. it's defined inline in the parent schema, not a separate model) — this is what gives you `.some()`/`.filter()` plus subdocument-specific behavior without a `DocumentArray`-shape mismatch error. See `customPermissions`/`deniedPermissions` on `StaffProfile`, `vehicles` on `OwnerProfile`.

## `this` typing on hooks

Pre/post hooks (`schema.pre('save', ...)`, `schema.pre(/^find/, ...)`) need an explicit `this` annotation when you want to use anything beyond what's implicitly `any`-safe. For query middleware, prefer the public `Query` API (`this.getFilter()`, `this.where(...)`) over private internals like `this._conditions` — the latter isn't part of Mongoose's public type surface and will error under `strict`.

## Deriving a full field type without re-typing the schema by hand

If you need the raw document shape for something (not the common case — most models declare it by hand as above), `mongoose.InferSchemaType<typeof someSchema>` derives it directly from the schema definition, avoiding drift between the schema and a hand-maintained interface. This codebase mostly hand-writes the interface instead (so instance/static methods can be declared in the same place), but it's a legitimate option for a schema with no custom methods.

## Real bugs this pattern has caught

Two examples worth knowing about since they explain *why* this convention is taken seriously here, not just style preference:
- `models/AuditLog.ts` used to do `const { mongoose, Schema } = require('../config/database')` — a module that never exported either. Every audit-logged action would have crashed at runtime; TypeScript didn't catch it because it was a plain untyped `require()`. Fixed by importing from `mongoose` directly and applying the same typed pattern as every other model.
- `OwnerProfile.can()` used to call `this.ownsResource(...)` (an async method) from a **non-async** function and `return` the result directly — meaning the returned "boolean" was actually always a truthy `Promise` object, silently bypassing the ownership check for every update/delete. Fixed by making `can()` properly `async`.

Both were plain JS-shaped bugs invisible to the compiler until the model was fully typed — a reason to actually finish typing a model rather than reaching for a blanket cast to make an error disappear.
