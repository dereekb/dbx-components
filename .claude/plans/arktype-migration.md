# Plan: Replace class-validator/class-transformer with ArkType

Replace all decorator-based validation (`class-validator` + `class-transformer`) with ArkType runtime validation across the monorepo.

**Planning context:** `~/.claude/cloud-sync/planning/dbcomponents/arktype-migration.md`

**ArkType docs to reference during implementation:**
- https://arktype.io/docs/expressions — operators, intersections, unions, morphs, narrowing
- https://arktype.io/docs/keywords — built-in type keywords and aliases
- https://arktype.io/docs/primitives — string, number, Date constraints, parse morphs (`string.date.parse`, etc.)
- https://arktype.io/docs/objects — object schemas, optional keys, merge, index signatures, undeclared keys
- https://arktype.io/docs/configuration — global config (`onUndeclaredKey`, etc.)
- Use Context7 MCP tool (`/arktypeio/arktype`) for API questions during implementation

---

**Testing**
- Ask the user to run tests instead of running them yourself as that eats up context.

**ArkType patterns established in Phase 1:**
- `type('string > 0').narrow((val, ctx) => predicate(val) || ctx.mustBe('description'))` for custom validators
- `schema(input)` returns `T | ArkErrors`; use `instanceof type.errors` to check errors, then cast: `out as ArkErrors` / `out as T`
- Generic `Type<T>` in factories needs `as T` and `as ArkErrors` casts due to ArkType's complex distillation types
- `clearable(schema)` uses `.or('null')` fluent API (not tuple syntax)
- `.merge({...})` for object composition (replaces class inheritance)
- Regex + string constraint intersections use tuple with `as const`: `[/regex/, '&', 'string <= N'] as const`
- DTOs become: `export const fooType = type({...})` + `export type Foo = typeof fooType.infer`
- Interfaces stay as-is; only classes with `@Expose()` decorators get converted
- Downstream packages (firebase, etc.) will have temporary build failures until their phase is reached — this is expected

## Phase 1: Foundation in `@dereekb/model` ✅ COMPLETE

### 1.1 Add arktype dependency ✅
- [x] Add `arktype` to `packages/model/package.json` (peerDependency)
- [x] Add `arktype` to root `package.json`
- [x] Run `pnpm install`

### 1.2 Add helper utilities ✅
- [x] Create `packages/model/src/lib/type/` for ArkType helpers
- [x] Implement `clearable()` helper — uses `.or('null')` fluent API on `Type<t>`
- [x] Export from `@dereekb/model`

### 1.3 Add `ModelId`, `ModelIdRef` and ArkType schemas ✅
- [x] Add `ModelId` type to `@dereekb/util` (alongside existing `ModelKey`)
- [x] Add `ModelIdRef` interface to `@dereekb/util` (alongside existing `ModelKeyRef`)
- [x] `ModelKeyRef` already existed in `@dereekb/util` — no changes needed
- [x] Add `modelKeyType` and `modelIdType` ArkType schemas in `packages/model/src/lib/type/model.ts`
- [x] Add `targetModelParamsType` and `targetModelIdParamsType` schemas
- [x] Export all from `@dereekb/model`

### 1.4 Rewrite transform pipeline ✅
- [x] Rewrite `transform.ts`: `Type<T>` replaces `ClassType<T>`, `ArkErrors` replaces `ValidationError[]`
- [x] Single `schema(input)` call replaces `plainToInstance` + `validate`
- [x] Removed `TransformAndValidateObjectResultTransformContextOptions`, `optionsForContext`, `defaultValidationOptions`
- [x] Error output no longer has `object` field (no partial object produced)
- [x] Config uses `schema` field instead of `classType`
- [x] Updated `transform.function.ts` and `transform.result.ts` to match
- [x] Deleted `type.ts` and `type.annotation.ts` (class-transformer helpers, no consumers outside tests)

### 1.5 Convert custom validators in `@dereekb/model` ✅
- [x] `IsE164PhoneNumber()` → `e164PhoneNumberType` (`.narrow()`)
- [x] `IsE164PhoneNumberWithOptionalExtension()` → `e164PhoneNumberWithOptionalExtensionType`
- [x] `IsE164PhoneNumberWithExtension()` → `e164PhoneNumberWithExtensionType`
- [x] `IsWebsiteUrl()` → `websiteUrlType` (`.narrow()`)
- [x] `IsWebsiteUrlWithPrefix()` → `websiteUrlWithPrefixType`
- [x] `IsMinuteOfDay()` → `minuteOfDayType` (`.narrow()`)
- [x] `IsUniqueKeyed()` → `uniqueKeyedType()` factory function
- [x] `IsISO8601DayString()` → `iso8601DayStringType`

### 1.6 Convert DTOs in `@dereekb/model` ✅
- [x] `address.ts`: classes → ArkType schemas with `.merge()` for composition
- [x] `link.ts`: kept `WebsiteLink` interface, removed class, added `websiteLinkType` schema
- [x] `link.file.ts`: kept `WebsiteFileLink` interface and utility functions, removed class, added `websiteFileLinkType` schema
- [x] `link.website.ts`: no changes needed (pure utility functions, no decorators)

### 1.7 Adapt existing model tests ✅
- [x] Rewrote transform tests to use ArkType schemas instead of class DTOs
- [x] Rewrote all validator tests to use `schema(input)` + `instanceof type.errors`
- [x] Rewrote address tests to use schema validation
- [x] Deleted `type.spec.ts` and `type.annotation.spec.ts` (tested deleted files)
- [x] `link.spec.ts` and `link.file.spec.ts` unchanged (test utility functions only)
- [x] All model tests pass, model builds clean

---

## Phase 2: `@dereekb/date`

### 2.1 Add arktype peer dependency ✅
- [x] Add `arktype` to `packages/date/package.json` (peerDependency)

### 2.2 Convert custom validators ✅
- [x] `@IsKnownTimezone()` → `knownTimezoneType` (`.narrow()` wrapping `isKnownTimezone`)
- [x] `@IsValidDateCellTiming()` → `validDateCellTimingType` (`.narrow()`)
- [x] `@IsValidDateCellRange()` → `validDateCellRangeType` (`.narrow()`)
- [x] `@IsValidDateCellRangeSeries()` → `validDateCellRangeSeriesType` (`.narrow()`)
- [x] `@IsISO8601DayString()` already converted in Phase 1 (`iso8601DayStringType` in `@dereekb/model`)

### 2.3 Convert DTOs and adapt existing tests ✅
- [x] `DateDurationSpan` class → `dateDurationSpanType` schema (interface kept)
- [x] `DateRange` class → `dateRangeType` schema (interface kept)
- [x] `DateRangeParams` class → `dateRangeParamsType` schema (converted to interface)
- [x] `DateCell` class → `dateCellType` schema (interface kept)
- [x] `DateCellTiming` class → `dateCellTimingType` schema using `.merge()` (interface kept)
- [x] `DateCellRange` class → `dateCellRangeType` schema using `.merge()` (interface kept)
- [x] `CalendarDate` class → `calendarDateType` schema using `.merge()` (interface kept)
- [x] `DateCellSchedule` class → `dateCellScheduleType` schema (interface kept)
- [x] `ModelRecurrenceInfo` class → `modelRecurrenceInfoType` schema (converted to interface)
- [x] Adapted all validator spec tests to use ArkType schemas
- [x] Adapted `date.duration.spec.ts` to use schema validation
- [x] Adapted `date.cell.spec.ts` to use ArkType schema instead of `plainToInstance`
- [x] Adapted `date.recurrence.spec.ts` to use interface instead of class constructor
- [x] Removed all `class-validator` and `class-transformer` imports from date package
- [x] Build passes
- [x] Verify all existing date tests pass

---

## Phase 3: `@dereekb/firebase`

### 3.1 Add arktype peer dependency
- [ ] Add `arktype` to `packages/firebase/package.json` (peerDependency)

### 3.2 Update `FirestoreModelKeyRef` / `FirestoreModelIdRef`
- [ ] Have `FirestoreModelKeyRef` extend `ModelKeyRef` from `@dereekb/util`
- [ ] Update `FirestoreModelIdRef` to extend `ModelIdRef`
- [ ] Convert `@IsFirestoreModelKey()` → `.narrow()` wrapping `isFirestoreModelKey`
- [ ] Convert `@IsFirestoreModelId()` → `.narrow()` wrapping `isFirestoreModelId`
- [ ] Convert `@IsFirestoreModelIdOrKey()` → `.narrow()` wrapping `isFirestoreModelIdOrKey`
- [ ] Create `firestoreModelKeyType`, `firestoreModelIdType` schemas
- [ ] Create `firestoreTargetModelParamsType` that uses `firestoreModelKeyType`

### 3.3 Convert all API param classes
- [ ] Convert `notification/notification.api.ts` (~20 classes, uses `IsE164PhoneNumber` from `@dereekb/model`, `@Type(() => Date)`, nested validation, enums, inheritance from `TargetModelParams`)
- [ ] Convert `storagefile/storagefile.api.ts` (~15 classes)
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
