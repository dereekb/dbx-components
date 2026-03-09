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

## Phase 3: `@dereekb/firebase` ✅ COMPLETE

### 3.1 Add arktype peer dependency ✅
- [x] Add `arktype` to `packages/firebase/package.json` (peerDependency)

### 3.2 Update validators and model params ✅
- [x] Convert `@IsFirestoreModelKey()` → `firestoreModelKeyType` (`.narrow()` wrapping `isFirestoreModelKey`)
- [x] Convert `@IsFirestoreModelId()` → `firestoreModelIdType` (`.narrow()` wrapping `isFirestoreModelId`)
- [x] Convert `@IsFirestoreModelIdOrKey()` → `firestoreModelIdOrKeyType` (`.narrow()` wrapping `isFirestoreModelIdOrKey`)
- [x] Create `targetModelParamsType`, `inferredTargetModelParamsType`, `targetModelIdParamsType`, `inferredTargetModelIdParamsType` in `model.param.ts`
- [x] Convert `TargetModelParams`, `InferredTargetModelParams`, `TargetModelIdParams`, `InferredTargetModelIdParams` from classes to interfaces
- [x] Note: Did not add extends from `ModelKeyRef`/`ModelIdRef` — `FirestoreModelKeyRef`/`FirestoreModelIdRef` have `readonly` modifier which is more restrictive; kept as-is

### 3.3 Convert all API param classes ✅
- [x] Convert `notification/notification.api.ts` (~20 classes → interfaces + ArkType schemas)
- [x] Convert `storagefile/storagefile.api.ts` (~15 classes → interfaces + ArkType schemas)
- [x] Convert `common/development/function.schedule.ts` (1 class → interface + schema)
- [x] Nested validation uses `.array()` on nested schemas (e.g., `updateStorageFileGroupEntryParamsType.array()`)
- [x] `@Type(() => Date)` replaced with `"string.date.parse"`
- [x] Enum validation uses `type.enumerated()` (e.g., `NotificationBoxRecipientFlag`)
- [x] Class inheritance (`extends TargetModelParams`) replaced with `targetModelParamsType.merge({...})`
- [x] Interfaces (result types) and function map configs unchanged
- [x] Abstract classes (`AbstractSubscribeToNotificationBoxParams`, etc.) converted to interfaces + schemas

### 3.4 Adapt existing firebase tests ✅
- [x] Rewrote `model.validator.spec.ts` to use ArkType schemas instead of class-validator `validate()`
- [x] No other test files had class-validator usage
- [x] Build passes clean
- [x] Removed all `class-validator` and `class-transformer` imports from firebase package

**ArkType patterns established in Phase 3:**
- `targetModelParamsType.merge({...})` replaces `extends TargetModelParams` class inheritance
- `type.enumerated(Enum.A, Enum.B, ...)` for enum validation
- Nested object arrays: `nestedSchemaType.array()` replaces `@ValidateNested({ each: true }) @Type(() => Class)`
- Empty param types: `type({})` for params with no validated fields

---

## Phase 4: `@dereekb/firebase-server` ✅ COMPLETE

### 4.1 Rewrite firebase server context ✅
- [x] Replaced `ValidationError[]` with `ArkErrors` in `firebaseServerValidationServerError()` and `firebaseServerValidationError()`
- [x] Error formatting now uses `validationErrors.summary` instead of NestJS `ValidationPipe.createExceptionFactory()`
- [x] Removed `ValidationPipe` import from `@nestjs/common`
- [x] Removed `class-validator` import entirely
- [x] Dropped `defaultValidationOptions` from `FirebaseServerActionsTransformFactoryOptions`
- [x] `handleValidationError` callback now receives `ArkErrors` (already aligned with `@dereekb/model` Phase 1 changes)
- [x] Added `arktype` to `packages/firebase-server/package.json` peerDependencies, removed `class-validator`

### 4.2 Update firebase-server model action servers ✅
- [x] Updated `notification.action.service.ts` — all 11 factory calls now use ArkType schema imports
- [x] Updated `notification.action.init.service.ts` — all 4 factory calls now use ArkType schema imports
- [x] Updated `storagefile.action.server.ts` — all 15 factory calls now use ArkType schema imports
- [x] Updated `storagefile.action.init.service.ts` — all 2 factory calls now use ArkType schema imports
- [x] Updated `notification.expedite.service.ts` — converted value imports to type-only imports
- [x] All imports use `type` keyword for interface-only references, value imports for schemas

### 4.3 Fix ArkType schema type inference ✅
- [x] Added `as Type<InterfaceName>` casts to all schema definitions in `@dereekb/firebase` API files
- [x] Casts applied in: `model.param.ts`, `notification.api.ts`, `storagefile.api.ts`, `function.schedule.ts`
- [x] This ensures consumers get correctly-typed schemas without needing per-call-site casts
- [x] Build passes clean for both firebase and firebase-server packages
- [x] Removed all `class-validator` and `class-transformer` imports from firebase-server

### 4.4 ArkType global config decision
- [x] Decided NOT to add `configure({ onUndeclaredKey: "reject" })` to nest server instance factory
- [x] Reason: ArkType `configure()` is a global side-effect that must be called before any `type()` — not suitable for per-instance config in a library
- [x] If needed, individual schemas can use `'+': 'reject'` syntax, or the app entry point can call `configure()`

**ArkType patterns established in Phase 4:**
- `as Type<InterfaceName>` casts on schema definitions to fix generic type inference in factory consumers
- `ArkErrors.summary` for human-readable validation error messages (replaces NestJS ValidationPipe formatting)

---

## Phase 5: Demo App and Templates ✅ COMPLETE

### 5.1 Update demo-firebase API DTOs ✅
- [x] `apps/demo-api/` entry-level files already used type-only imports — no changes needed
- [x] `components/demo-firebase/src/lib/development/development.api.ts` — `DemoDevelopmentExampleParams` class → interface + `demoDevelopmentExampleParamsType` schema
- [x] `components/demo-firebase/src/lib/model/system/system.api.ts` — `ExampleReadParams` class → interface + `exampleReadParamsType` schema
- [x] `components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts` — 6 classes → interfaces + schemas:
  - `CreateGuestbookParams`, `GuestbookEntryParams`, `InsertGuestbookEntryParams` (with `.merge()`)
  - `LikeGuestbookEntryParams` (alias of `TargetModelParams`), `SubscribeToGuestbookNotificationsParams` (alias of `AbstractSubscribeToNotificationBoxParams`)
- [x] `components/demo-firebase/src/lib/model/profile/profile.api.ts` — 5 classes → interfaces + schemas:
  - `ProfileCreateTestNotificationParams`, `SetProfileUsernameParams`, `UpdateProfileParams` (all `.merge()` on `inferredTargetModelParamsType`)
  - `FinishOnboardingProfileParams` (alias), `DownloadProfileArchiveParams` (alias)
- [x] Updated `demo-firebase/package.json`: replaced `class-transformer`/`class-validator` with `arktype`

### 5.2 Update demo-api action servers ✅
- [x] `apps/demo-api/src/app/common/model/profile/profile.action.server.ts` — 3 factory calls now use ArkType schemas
- [x] `apps/demo-api/src/app/common/model/guestbook/guestbook.action.server.ts` — 4 factory calls now use ArkType schemas
- [x] All imports use `type` keyword for interface-only references

### 5.3 Update setup templates ✅
- [x] `setup/templates/components/firebase/src/lib/development/development.api.ts` — class → interface + schema
- [x] `setup/templates/components/firebase/src/lib/model/example/example.api.ts` — class → interface + schema
- [x] `setup/templates/components/firebase/src/lib/model/profile/profile.api.ts` — 2 classes → type aliases + schemas
- [x] `setup/templates/apps/api/src/app/common/model/example/example.action.server.ts` — factory call uses schema
- [x] `setup/templates/apps/api/src/app/common/model/profile/profile.action.server.ts` — factory call uses schema
- [x] Template function files updated to use type-only imports

### 5.4 Remove stray class-validator utility imports ✅
- [x] `packages/dbx-core/.../angular.router.service.ts` — `isArray` from class-validator → `Array.isArray`
- [x] `packages/dbx-web/.../compact.ts` — `isBoolean` from class-validator → `typeof input === 'boolean'`
- [x] `packages/util/.../random.spec.ts` — `isEmail`/`isPhoneNumber` from class-validator → regex match / `isE164PhoneNumber`
- [x] Updated `apps/demo/src/app/modules/landing/container/layout.component.ts` — description and links updated from class-transformer/class-validator to arktype
- [x] All source code now free of `class-validator` and `class-transformer` imports (only `.claude/skills/` docs remain)

---

## Phase 6: Cleanup ✅ COMPLETE

### 6.1 Remove class-validator and class-transformer ✅
- [x] Removed `class-validator` and `class-transformer` from root `package.json`
- [x] Removed from `packages/date/package.json`, `packages/firebase/package.json` (peerDependencies)
- [x] Removed from `packages/util/package.json` (devDependencies)
- [x] Removed from `packages/dbx-core/package.json`, `packages/dbx-web/package.json` (peerDependencies)
- [x] Replaced with `arktype` in `components/demo-firebase/package.json` (done in Phase 5)
- [x] Ran `pnpm install` to clean lockfile

### 6.2 Remove reflect-metadata ✅
- [x] All NestJS injection uses explicit `@Inject()` tokens — no type-based injection
- [x] Removed `reflect-metadata` from root `package.json` and `apps/demo-api/package.json`
- [x] Removed `import 'reflect-metadata'` from `vitest.setup.node.ts` and `apps/demo-api/src/main.ts`
- [x] Removed from template files: `setup/templates/vitest.setup.node.ts` and `setup/templates/apps/api/src/main.ts`

### 6.3 Remove `emitDecoratorMetadata` ✅
- [x] Removed `emitDecoratorMetadata: true` from `tsconfig.base.json`
- [ ] SWC evaluation deferred — separate concern, not part of this migration

### 6.4 Update peer dependencies ✅
- [x] `arktype` already added as peerDependency in model, date, firebase, firebase-server
- [x] Removed `class-validator` and `class-transformer` from all peerDependencies
- [x] Ran `node ./tools/scripts/sync-peer-deps.mjs` — synced arktype to `^2.2.0` across all packages

### 6.5 Update `@dereekb/nestjs` — not needed ✅
- [x] No NestJS controller validation pipes used — validation is via our transform pipeline
- [x] No changes needed

### 6.6 Verify builds ✅
- [x] `pnpm nx run-many -t build --all` passes
- [x] User to run tests separately

---

## Phase 7: Migration Guide ✅ COMPLETE

### 7.1 Write migration guide for downstream projects ✅
- [x] Created `setup/upgrades/v12-to-v13/class-validator-to-arktype-migration.md`
- [x] Covers: class→schema conversion, decorator→ArkType mapping, test updates, import changes
- [x] Includes note: remove `reflect-metadata` from `project.json` polyfills for Angular projects
- [x] Updated `setup/upgrades/v12-to-v13/v12-to-v13-upgrade-info.md` with ArkType migration section and updated Removal of Babel section
