# Plan: Replace class-validator/class-transformer with ArkType

Replace all decorator-based validation (`class-validator` + `class-transformer`) with ArkType runtime validation across the monorepo.

**Planning context:** `~/.claude/cloud-sync/planning/dbcomponents/arktype-migration.md`

**ArkType docs to reference during implementation:**
- https://arktype.io/docs/expressions — operators, intersections, unions, morphs, narrowing
- https://arktype.io/docs/keywords — built-in type keywords and aliases
- https://arktype.io/docs/primitives — string, number, Date constraints, parse morphs (`string.date.parse`, etc.)
- https://arktype.io/docs/objects — object schemas, optional keys, merge, index signatures, undeclared keys
- https://arktype.io/docs/configuration — global config (`onUndeclaredKey`, etc.)

---

**Testing**
- Ask the user to run tests instead of running them yourself as that eats up context.

## Phase 1: Foundation in `@dereekb/model`

### 1.1 Add arktype dependency
- [ ] Add `arktype` to `packages/model/package.json` (peerDependency + devDependency)
- [ ] Add `arktype` to root `package.json`
- [ ] Run `pnpm install`

### 1.2 Add helper utilities
- [ ] Create `packages/model/src/lib/type/` (or similar) for ArkType helpers
- [ ] Implement `clearable()` helper — returns `type(schema, "|", "null")` for fields where `null` is a clear/reset signal
- [ ] Export from `@dereekb/model`

### 1.3 Add `ModelId`, `ModelKeyRef`, `ModelIdRef` to `@dereekb/model`
- [ ] Add `ModelId` type (string alias, like existing `ModelKey`)
- [ ] Add `ModelKeyRef` interface (`{ readonly key: ModelKey }`)
- [ ] Add `ModelIdRef` interface (`{ readonly id: ModelId }`)
- [ ] Add `modelKeyType` and `modelIdType` ArkType schemas (basic string validation)
- [ ] Add `targetModelParamsType` schema (merges `modelKeyType` as `key`)
- [ ] Export all from `@dereekb/model`

### 1.4 Rewrite transform pipeline
- [ ] Rewrite `packages/model/src/lib/transform/transform.ts`:
  - [ ] Replace `ClassType<T>` with ArkType `Type<T>` in all signatures
  - [ ] Replace `ValidationError[]` with `ArkErrors`
  - [ ] Keep `I extends object` generic on function signatures for compile-time input narrowing; internally the schema receives `input as unknown`
  - [ ] Remove `TransformAndValidateObjectResultTransformContextOptions` (no separate transform/validate options)
  - [ ] Remove `optionsForContext` / `defaultValidationOptions` from factory defaults
  - [ ] `transformAndValidateObjectResult` becomes a single `schema(input)` call instead of `plainToInstance` + `validate`
  - [ ] Error output loses `object` field on failure (no partial object produced)
- [ ] Update `transform.function.ts` and `transform.result.ts` to match new types
- [ ] Remove `class-transformer` imports from transform module
- [ ] Remove `class-validator` imports from transform module
- [ ] Remove `type.ts` and `type.annotation.ts` (class-transformer annotation helpers) — or convert to ArkType `.pipe()` equivalents if still needed

### 1.5 Convert custom validators in `@dereekb/model`
- [ ] `@IsE164PhoneNumber()` → regex type
- [ ] `@IsE164PhoneNumberWithOptionalExtension()` → regex type
- [ ] `@IsE164PhoneNumberWithExtension()` → regex type
- [ ] `@IsWebsiteUrl()` → `.narrow()` wrapping existing `isWebsiteUrl`
- [ ] `@IsWebsiteUrlWithPrefix()` → `.narrow()` wrapping existing predicate
- [ ] `@IsMinuteOfDay()` → `.narrow()` wrapping `isMinuteOfDay`
- [ ] `@IsUniqueKeyed()` → `.narrow()` wrapping `isUniqueKeyedFunction`
- [ ] Export reusable schema fragments from `@dereekb/model`

### 1.6 Convert DTOs in `@dereekb/model`
- [ ] Convert all `@Expose()`-annotated classes to ArkType schemas + inferred types
- [ ] Files: `packages/model/src/lib/data/` (WebsiteLink, Address, etc.)
- [ ] Use `.merge()` for types that previously used class inheritance
- [ ] Use `clearable()` for `Maybe<T>` fields where null is a valid value
- [ ] Use `"string.date.parse"` for Date fields that arrive as JSON strings
- [ ] Verify interfaces (result types, config types) remain unchanged

### 1.7 Adapt existing model tests
- [ ] Update existing test files to use `schema(input)` + `instanceof type.errors` instead of `validate()` + `ValidationError[]`
- [ ] Verify all existing model tests pass

---

## Phase 2: `@dereekb/date`

### 2.1 Add arktype peer dependency
- [ ] Add `arktype` to `packages/date/package.json` (peerDependency)

### 2.2 Convert custom validators
- [ ] `@IsKnownTimezone()` → `.narrow()` wrapping `isKnownTimezone`
- [ ] `@IsValidDateCellTiming()` → `.narrow()`
- [ ] `@IsValidDateCellRange()` → `.narrow()`
- [ ] `@IsValidDateCellRangeSeries()` → `.narrow()`
- [ ] `@IsISO8601DayString()` → regex or `.narrow()`

### 2.3 Convert DTOs and adapt existing tests
- [ ] Convert `@Expose()`-annotated classes to ArkType schemas + inferred types
- [ ] Adapt existing tests
- [ ] Verify all existing date tests pass

---

## Phase 3: `@dereekb/firebase`

### 3.1 Add arktype peer dependency
- [ ] Add `arktype` to `packages/firebase/package.json` (peerDependency)

### 3.2 Update `FirestoreModelKeyRef` / `FirestoreModelIdRef`
- [ ] Have `FirestoreModelKeyRef` extend `ModelKeyRef` from `@dereekb/model`
- [ ] Update `FirestoreModelIdRef` to extend `ModelIdRef`
- [ ] Convert `@IsFirestoreModelKey()` → `.narrow()` wrapping `isFirestoreModelKey`
- [ ] Convert `@IsFirestoreModelId()` → `.narrow()` wrapping `isFirestoreModelId`
- [ ] Convert `@IsFirestoreModelIdOrKey()` → `.narrow()` wrapping `isFirestoreModelIdOrKey`
- [ ] Create `firestoreModelKeyType`, `firestoreModelIdType` schemas
- [ ] Create `firestoreTargetModelParamsType` that uses `firestoreModelKeyType`

### 3.3 Convert all API param classes
- [ ] Convert `storagefile/storagefile.api.ts` (~15 classes)
- [ ] Convert `notification/notification.api.ts`
- [ ] Convert other model API files with `@Expose()`-annotated classes
- [ ] Verify: nested validation uses `.array()` on nested schemas
- [ ] Verify: `@Type(() => Date)` replaced with `"string.date.parse"`
- [ ] Verify: interfaces (result types) and function map configs unchanged

### 3.4 Adapt existing firebase tests
- [ ] Adapt existing tests to new schema patterns
- [ ] Verify all existing firebase tests pass

---

## Phase 4: `@dereekb/firebase-server`

### 4.1 Configure ArkType globally in nest server instance
- [ ] Add ArkType configuration option to nest server instance factory
- [ ] Default: `configure({ onUndeclaredKey: "reject" })` via `import { configure } from "arktype/config"`
- [ ] If config is explicitly `null`, skip `configure()` call
- [ ] Remove `class-validator` and `ValidationPipe` dependency from `context.ts`

### 4.2 Rewrite firebase server context
- [ ] `firebaseServerValidationServerError()` — takes `ArkErrors`, format with `errors.summary`
- [ ] `firebaseServerValidationError()` — same, wraps in `badRequestError()`
- [ ] `firebaseServerActionsTransformFactory()` — drop `defaultValidationOptions`, error handler takes `ArkErrors`
- [ ] `FirebaseServerActionsTransformFactoryOptions` — remove `Pick<..., 'defaultValidationOptions'>`
- [ ] `FirebaseServerActionsContext` / `AbstractFirebaseServerActionsContext` — types updated

### 4.3 Update firebase-server tests
- [ ] Adapt existing class-validator-specific tests
- [ ] Add test: default behavior (reject unknown keys)
- [ ] Add test: explicit `null` config (skip configuration)
- [ ] Add test: custom config override
- [ ] Verify all existing firebase-server tests pass

### 4.4 Update firebase-server model action servers
- [ ] Swap class imports for schema imports in every action server file
- [ ] Import types separately: `import { type FooParams, fooParamsType, ... }`
- [ ] Verify no business logic changes needed

---

## Phase 5: Demo App and Templates

### 5.1 Update demo-firebase API DTOs
- [ ] Verify `apps/demo-api/` entry-level files need no changes (already import types)
- [ ] Convert any demo-specific param classes in `demo-firebase/` to ArkType schemas

### 5.2 Update setup templates
- [ ] Convert template DTO classes in `setup/templates/` to ArkType pattern

---

## Phase 6: Cleanup

### 6.1 Remove class-validator and class-transformer
- [ ] Remove `class-validator` and `class-transformer` from all `package.json` files (root + all packages)
- [ ] Run `pnpm install` to clean lockfile

### 6.2 Evaluate reflect-metadata removal
- [ ] Check demo project for remaining direct constructor injection (no `@Inject()` decorator)
- [ ] If all NestJS injection uses `@Inject()` tokens, remove `reflect-metadata` from dependencies
- [ ] If some demo files still use direct injection, fix to use `@Inject()` or keep reflect-metadata

### 6.3 Remove `emitDecoratorMetadata` and evaluate SWC
- [ ] Remove `emitDecoratorMetadata` from tsconfig (once reflect-metadata is removed)
- [ ] Evaluate switching from Babel to SWC for compilation
- [ ] Update build configs to use SWC where applicable (NestJS projects, tests, etc.)

### 6.4 Update peer dependencies
- [ ] Update peerDependencies across all affected packages to include `arktype`
- [ ] Remove `class-validator` and `class-transformer` from peerDependencies
- [ ] Run `node ./tools/scripts/sync-peer-deps.mjs`

### 6.5 Update `@dereekb/nestjs` if needed (unlikely)
- [ ] We don't use NestJS controllers with built-in validation pipes — validation happens via our own transform pipeline on POJO webhook data
- [ ] `nestjs-arktype` exists but likely not needed given our architecture
- [ ] Revisit only if a future need arises for controller-level validation

### 6.6 Verify builds and tests
- [ ] `pnpm nx run-many --target=build --all`
- [ ] Ask the user to run tests for everything, or commit the changes `/dbx-commit-changes` skill, and wait for CircleCI results, which you ask the user to read over.

---

## Phase 7: Migration Skill (Post-Migration)

### 7.1 Build migration skill for downstream projects
- [ ] Create a Claude skill that guides downstream dbx-components consumers through migration
- [ ] Cover: class→schema conversion, decorator→ArkType mapping, test updates, import changes
