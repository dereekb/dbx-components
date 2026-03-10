# Migrating from class-validator/class-transformer to ArkType

As of dbx-components v13.1.0, all decorator-based validation has been replaced with [ArkType](https://arktype.io) runtime validation schemas. This guide covers how to migrate downstream projects.

**ArkType docs to reference during implementation:**
- https://arktype.io/docs/expressions — operators, intersections, unions, morphs, narrowing
- https://arktype.io/docs/keywords — built-in type keywords and aliases
- https://arktype.io/docs/primitives — string, number, Date constraints, parse morphs (`string.date.parse`, etc.)
- https://arktype.io/docs/objects — object schemas, optional keys, merge, index signatures, undeclared keys
- https://arktype.io/docs/configuration — global config (`onUndeclaredKey`, etc.)
- Use Context7 MCP tool (`/arktypeio/arktype`) for API questions during implementation

---

## Overview of Changes

- `class-validator` and `class-transformer` are no longer dependencies
- `reflect-metadata` is no longer needed (removed from dependencies and imports)
- `emitDecoratorMetadata` has been removed from `tsconfig.base.json`
- All DTO classes with decorators have been converted to interfaces + ArkType schemas
- The `@dereekb/model` transform pipeline now uses `Type<T>` (ArkType) instead of `ClassType<T>`

## Dependencies

### Remove
```json
"class-validator": "...",
"class-transformer": "...",
"reflect-metadata": "..."
```

### Add
```json
"arktype": "^2.2.0"
```

### Remove reflect-metadata imports
Remove `import 'reflect-metadata'` from:
- Your API entry point (e.g., `main.ts`)
- Your vitest setup file (e.g., `vitest.setup.node.ts`)

### Remove reflect-metadata from Angular project.json
Remove `reflect-metadata` from the `polyfills` array in your Angular app's `project.json`. It is no longer needed as a frontend polyfill.

### Remove emitDecoratorMetadata
Remove `"emitDecoratorMetadata": true` from `tsconfig.base.json`. This is no longer needed since we no longer rely on runtime type reflection.

### Remove class-validator utility imports
If you use utility functions like `isArray`, `isBoolean`, `isEmail`, or `isPhoneNumber` from `class-validator`, replace them:

| Old (class-validator) | New |
|---|---|
| `isArray(x)` | `Array.isArray(x)` |
| `isBoolean(x)` | `typeof x === 'boolean'` |
| `isEmail(x)` | Use a regex or dedicated library |
| `isPhoneNumber(x)` | `isE164PhoneNumber(x)` from `@dereekb/util` |

## Converting DTO Classes to ArkType Schemas

### Basic pattern

**Before:**
```typescript
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SetUsernameParams {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  username!: string;
}
```

**After:**
```typescript
import { type, type Type } from 'arktype';

export interface SetUsernameParams {
  readonly username: string;
}

export const setUsernameParamsType = type({
  username: 'string > 0 & string <= 30'
}) as Type<SetUsernameParams>;
```

### Key conventions
- Classes become **interfaces** (keep the same name)
- Schema variable uses camelCase + `Type` suffix (e.g., `SetUsernameParams` → `setUsernameParamsType`)
- Apply `as Type<InterfaceName>` cast to ensure proper type inference in generic consumers
- Use `readonly` on interface properties

### Decorator → ArkType mapping

| Decorator | ArkType equivalent |
|---|---|
| `@IsString()` | `'string'` |
| `@IsNotEmpty()` + `@IsString()` | `'string > 0'` |
| `@MaxLength(N)` | `'string <= N'` |
| `@IsNotEmpty()` + `@IsString()` + `@MaxLength(N)` | `'string > 0 & string <= N'` |
| `@IsBoolean()` | `'boolean'` |
| `@IsOptional()` + `@IsBoolean()` | `clearable('boolean')` (with `?` key) |
| `@IsOptional()` | Use `'key?'` syntax in schema; use `clearable()` if the field is `Maybe<T>` |
| `@Type(() => Date)` | `'Date \| string.date.parse'` |
| `@ValidateNested({ each: true })` | `nestedSchemaType.array()` |
| Custom `@IsX()` validators | `.narrow((val, ctx) => predicate(val) \|\| ctx.mustBe('description'))` |
| Enum validation | `type.enumerated(Enum.A, Enum.B, ...)` |

### Combining constraints
Use `&` for intersections. For regex + string length:
```typescript
const myType = type([/regex/, '&', 'string <= N'] as const);
```

### Optional fields
Use the `'key?'` syntax. For `Maybe<T>` fields (nullable/clearable), use `clearable()`:
```typescript
import { clearable } from '@dereekb/model';

const myType = type({
  'bio?': clearable('string > 0 & string <= 200'),
  'published?': clearable('boolean'),
  'name?': 'string > 0'  // optional but NOT nullable — no clearable needed
});
```

### Class inheritance → `.merge()`

**Before:**
```typescript
export class UpdateProfileParams extends InferredTargetModelParams {
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: Maybe<string>;
}
```

**After:**
```typescript
export interface UpdateProfileParams extends InferredTargetModelParams {
  readonly bio?: Maybe<string>;
}

export const updateProfileParamsType = inferredTargetModelParamsType.merge({
  'bio?': clearable('string > 0 & string <= 200')
}) as Type<UpdateProfileParams>;
```

### Type aliases (empty extensions)

**Before:**
```typescript
export class FinishOnboardingParams extends InferredTargetModelParams {}
```

**After:**
```typescript
export type FinishOnboardingParams = InferredTargetModelParams;

export const finishOnboardingParamsType = inferredTargetModelParamsType as Type<FinishOnboardingParams>;
```

### Clearable fields with `clearable()`

The dbx-components library uses `null` in API calls to signal that a field should be cleared/deleted, while `undefined` means "no change." Use `clearable()` from `@dereekb/model` for any `Maybe<T>` field:

```typescript
import { clearable } from '@dereekb/model';

const updateParamsType = targetModelParamsType.merge({
  // clearable() accepts an ArkType string definition and returns `def | null | undefined`
  'bio?': clearable(`string > 0 & string <= ${BIO_MAX_LENGTH}`),
  'published?': clearable('boolean'),
  'scheduledDate?': clearable(ARKTYPE_DATE_DTO_TYPE),  // morph: Date | string → Date | null | undefined
  'email?': clearable('string.email'),
  'count?': clearable('number >= 0'),
}) as Type<UpdateParams>;
```

`clearable()` accepts both string definitions and `Type` instances:
- For strings, it returns `"${def} | null | undefined"` with TypeScript return type `Type<type.infer<def> | null | undefined>`
- For `Type` instances, it calls `.or('null').or('undefined')` on the schema

```typescript
const myType = type({
  'items?': clearable(myCustomSchemaType.array()),    // Type instance
  'phone?': clearable(e164PhoneNumberType),            // Type instance
  'flag?': clearable(type.enumerated(Flag.A, Flag.B)), // enumerated Type
});
```

## Updating Action Servers

The `firebaseServerActionTransformFunctionFactory` now accepts an ArkType schema instead of a class reference.

**Before:**
```typescript
import { SetUsernameParams } from 'my-firebase';

return firebaseServerActionTransformFunctionFactory(SetUsernameParams, async (params) => {
  // ...
});
```

**After:**
```typescript
import { type SetUsernameParams, setUsernameParamsType } from 'my-firebase';

return firebaseServerActionTransformFunctionFactory(setUsernameParamsType, async (params) => {
  // ...
});
```

Note: Import the **interface** as a type-only import and the **schema** as a value import.

## Updating Tests

### Validation tests

**Before:**
```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

const instance = plainToInstance(MyDto, input);
const errors = await validate(instance);
expect(errors.length).toBe(0);
```

**After:**
```typescript
import { type } from 'arktype';

const result = myDtoType(input);
expect(result instanceof type.errors).toBe(false);
```

To check for validation errors:
```typescript
const result = myDtoType(invalidInput);
expect(result instanceof type.errors).toBe(true);
```

### Type assertion in tests
When using validated output:
```typescript
import { type ArkErrors } from 'arktype';

const result = myDtoType(input);
if (result instanceof type.errors) {
  fail(`Validation failed: ${(result as ArkErrors).summary}`);
}
const validated = result as MyDto;
```

## Available Base Schemas from @dereekb/firebase

These schemas are exported and can be used with `.merge()`:

| Schema | Interface | Description |
|---|---|---|
| `targetModelParamsType` | `TargetModelParams` | Required model key |
| `inferredTargetModelParamsType` | `InferredTargetModelParams` | Optional model key |
| `targetModelIdParamsType` | `TargetModelIdParams` | Required model ID |
| `abstractSubscribeToNotificationBoxParamsType` | `AbstractSubscribeToNotificationBoxParams` | Notification subscription |
| `downloadStorageFileParamsType` | `DownloadStorageFileParams` | Storage file download |

## Available Helpers from @dereekb/model

| Helper | Description |
|---|---|
| `clearable(def)` | Wraps a string definition as `def \| null \| undefined` for `Maybe<T>` fields |

## Available Validators from @dereekb/model

| Schema | Description |
|---|---|
| `e164PhoneNumberType` | E.164 phone number (no extension) |
| `e164PhoneNumberWithOptionalExtensionType` | E.164 phone number (optional extension) |
| `websiteUrlType` | Valid website URL |
| `websiteUrlWithPrefixType` | Website URL with http/https prefix |
| `minuteOfDayType` | Valid minute of day (0-1439) |
| `iso8601DayStringType` | ISO 8601 day string (YYYY-MM-DD) |
| `uniqueKeyedType()` | Factory for unique keyed arrays |

## Available Validators from @dereekb/date

| Schema | Description |
|---|---|
| `knownTimezoneType` | Valid IANA timezone string |
| `validDateCellTimingType` | Valid DateCellTiming |
| `validDateCellRangeType` | Valid DateCellRange |
| `validDateCellRangeSeriesType` | Valid DateCellRangeSeries |

## Available Validators from @dereekb/firebase

| Schema | Description |
|---|---|
| `firestoreModelKeyType` | Valid Firestore model key |
| `firestoreModelIdType` | Valid Firestore model ID |
| `firestoreModelIdOrKeyType` | Valid Firestore model ID or key |
