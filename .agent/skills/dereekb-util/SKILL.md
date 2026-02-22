---
name: util
description: Pure TypeScript utilities from @dereekb/util - foundational package with 35 modules for array, string, promise, object, date manipulation and more. No external dependencies.
---

# @dereekb/util

## Overview

**@dereekb/util** is the foundational utility package of the @dereekb ecosystem, providing pure TypeScript utilities with no external dependencies.

**Package Location:** `packages/util/`

**Key Features:**
- 35 domain-organized modules with ~1,972 exports
- Pure TypeScript (no Angular, no external dependencies)
- Foundation for entire @dereekb ecosystem
- Comprehensive test coverage with Jest
- Three entry points: main, test, fetch

**Package Architecture:**
```
@dereekb/util (no dependencies)
    ↓
Used by: @dereekb/rxjs, @dereekb/model, @dereekb/date
    ↓
All other @dereekb packages
```

## Entry Points

### Main: `@dereekb/util`
All production utilities across 35 modules.

```typescript
import { convertToArray, promiseDelay, Maybe } from '@dereekb/util';
```

### Test: `@dereekb/util/test`
Jest testing utilities and helpers.

```typescript
import { itShouldFail, wrapFunction } from '@dereekb/util/test';
```

**Key Exports:**
- `itShouldFail()` - Jest test expecting failure
- `wrapFunction()` - Wrap functions for testing
- `testFunctionWithValue()` - Test function execution
- `expectFail()` - Expect error throwing

### Fetch: `@dereekb/util/fetch`
HTTP/fetch utilities for making requests.

```typescript
import { jsonFetchFunction, FetchError } from '@dereekb/util/fetch';
```

**Key Exports:**
- `FetchError` - Fetch error type
- `jsonFetchFunction()` - JSON fetching with typing
- `paginatedFetchFunction()` - Paginated fetching
- `fetchFile()` - File downloading
- `urlString()` - URL building
- `timeoutFetch()` - Fetch with timeout

## Module Organization (35 modules)

### Essential Utilities (Most Frequently Used)

#### Array
Array manipulation, filtering, mapping, indexing, and uniqueness.

**Location:** `packages/util/src/lib/array/`

**Key Concepts:**
- Array/value conversion utilities
- Filtering and finding operations
- Index-based operations
- Unique value handling
- Array factories and builders

**Representative Exports:**
- `convertToArray<T>(arrayOrValue)` - Convert single value or array to array
- `asArray<T>(input)` - Ensure input is array
- `arrayOrEmpty<T>(input)` - Return array or empty array
- `filterUniqueValues<T>(array)` - Remove duplicates
- `firstValue<T>()`, `lastValue<T>()` - Access first/last elements
- `splitArrayByIndex<T>(array, index)` - Split array at index
- `flattenArray<T>(arrays)` - Flatten nested arrays
- `sortByNumberFunction<T>(getValue)` - Create sorting function
- `findFirstBoolean<T>(array, predicate)` - Find first matching element
- `ArrayOrValue<T>` type - Single value or array type

**Common Patterns:**
```typescript
// Convert any input to array
const arr = convertToArray(valueOrArray); // [value] or array

// Safe array access
const items = arrayOrEmpty(maybeArray); // [] or array

// Filter unique values
const unique = filterUniqueValues([1, 2, 2, 3]); // [1, 2, 3]

// Split array
const [before, after] = splitArrayByIndex(arr, 5);
```

#### String
String manipulation, encoding, URLs, transformations, and case conversion.

**Location:** `packages/util/src/lib/string/`

**Key Concepts:**
- String joining and splitting
- Normalization and whitespace handling
- Base64 encoding/decoding
- Case conversion (camel, snake, kebab)
- URL building and parsing

**Representative Exports:**
- `joinStrings(strings, separator)` - Join with separator, skip empties
- `normalizeString(str)` - Normalize whitespace
- `splitStringAtIndex(str, index)` - Split at position
- `stringToNumber(str)` - Safe number parsing
- `camelCaseToSnakeCase(str)`, `snakeCaseToCamelCase(str)` - Case conversion
- `encodeString(str)`, `decodeString(str)` - Base64 encoding
- `urlString(base, params)` - Build URL with parameters
- `substringAfter(str, delimiter)` - Get substring after delimiter

**Common Patterns:**
```typescript
// Join strings (skips null/empty)
const result = joinStrings(['hello', '', 'world'], ' '); // 'hello world'

// Case conversion
const snake = camelCaseToSnakeCase('myVariableName'); // 'my_variable_name'
const camel = snakeCaseToCamelCase('my_variable_name'); // 'myVariableName'

// Safe encoding
const encoded = encodeString('sensitive data');
const decoded = decodeString(encoded);
```

#### Promise
Async operations, limits, loops, tasks, and promise utilities.

**Location:** `packages/util/src/lib/promise/`

**Key Concepts:**
- Promise delays and timeouts
- Concurrency limiting
- Async iteration and loops
- Promise references (deferred promises)
- Task factories with timeout support

**Representative Exports:**
- `promiseReference<T>()` - Create resolvable/rejectable promise
- `promiseDelay(ms)` - Async delay
- `promiseLimit(fn, config)` - Limit concurrent executions
- `promiseLoop(config)` - Iterate asynchronously
- `timeoutStartTaskFactory(config)` - Task with timeout
- `chainPromises(promises)` - Sequential execution
- `waitForever()` - Promise that never resolves
- `isPromise(value)` - Type guard for promises

**Common Patterns:**
```typescript
// Delay execution
await promiseDelay(1000); // Wait 1 second

// Limit concurrency
const limited = promiseLimit(asyncFn, { limit: 5 });
await Promise.all(items.map(limited)); // Max 5 concurrent

// Async loop
await promiseLoop({
  items: [1, 2, 3],
  forEach: async (item) => {
    await process(item);
  }
});

// Deferred promise
const ref = promiseReference<number>();
// Later...
ref.resolve(42);
```

#### Object
Object operations, filtering, equality, mapping, merging, and key operations.

**Location:** `packages/util/src/lib/object/`

**Key Concepts:**
- Object comparison and equality
- Deep merging
- Key-based filtering
- Value transformation
- Key extraction and reading

**Representative Exports:**
- `objectKeysAreEqual(a, b)` - Compare object keys
- `mergeObjects(objects)` - Deep merge objects
- `filterObjectByKeys(obj, keys)` - Keep only specified keys
- `mapObjectMap(obj, mapFn)` - Transform object values
- `readKeysFunction(obj)` - Create key reader
- `makeObjectTypeEqual(source, template)` - Type-safe object creation
- `objectHasNoKeys(obj)` - Check if object is empty

**Common Patterns:**
```typescript
// Merge objects
const merged = mergeObjects([obj1, obj2, obj3]);

// Filter by keys
const filtered = filterObjectByKeys(user, new Set(['id', 'name']));

// Transform values
const transformed = mapObjectMap(obj, (value) => value * 2);

// Check equality
if (objectKeysAreEqual(obj1, obj2)) {
  // Same keys
}
```

#### Value
Generic value utilities including Maybe types, indexed values, bounds, points, and comparators.

**Location:** `packages/util/src/lib/value/`

**Key Concepts:**
- Maybe types for optional values
- Index and range types
- Bounded values (clamping)
- Point and vector types
- Comparator functions

**Representative Exports:**
- `Maybe<T>` type - Optional value (T | undefined | null)
- `isMaybe(value)`, `isMaybeFunction(fn)` - Type guards
- `mapMaybe(value, fn)` - Transform maybe value
- `makeValuesGroupMap(values, keyFn)` - Group values by key
- `comparator(config)` - Create comparison function
- `boundedNumber(value, min, max)` - Clamp to range
- `IndexNumber`, `IndexRange` types - Index types
- `LatLngPoint` type - Geographic point

**Common Patterns:**
```typescript
// Work with Maybe types
function process(value: Maybe<string>): string {
  return isMaybe(value) ? value : 'default';
}

// Map maybe values
const result = mapMaybe(maybeValue, (x) => x.toUpperCase());

// Bounded values
const clamped = boundedNumber(150, 0, 100); // 100

// Comparators
const compareFn = comparator({ getValue: (x) => x.age });
items.sort(compareFn);
```

### Data Structure Modules

#### Set
Set operations, delta computation, decision sets, and hashsets.

**Location:** `packages/util/src/lib/set/`

**Representative Exports:**
- `setDelta(a, b)` - Compute set differences (added, removed, same)
- `makeSetIterableFunction(set)` - Create iterable from set
- `hashCodeMapSetFunction()` - Hash-based set operations
- `DecisionSet` - Set for tracking decisions

#### Map
Map utilities, key operations, and intersections.

**Location:** `packages/util/src/lib/map/`

**Representative Exports:**
- `mapKeyIntersection(mapA, mapB)` - Find common keys
- `mapIterable(map)` - Iterate map entries
- `mapFactory(fn)` - Create map from factory function
- `readKeysFromMap(map)` - Extract all keys

#### Iterable
Iterable operations and mapping.

**Location:** `packages/util/src/lib/iterable/`

**Representative Exports:**
- `iterableToArray(iterable)` - Convert to array
- `mapIterable(iterable, mapFn)` - Transform iterable
- `iterateIterables(iterables)` - Chain multiple iterables
- `filterIterable(iterable, predicate)` - Filter iterable

#### Tree
Tree structures, flattening, exploration, and traversal.

**Location:** `packages/util/src/lib/tree/`

**Representative Exports:**
- `flattenTree(tree)` - Flatten to array
- `treeTraversal(tree, visitor)` - Traverse tree structure
- `makeTreeFromArray(array, config)` - Build tree from flat array
- `TreeNode` type - Generic tree node

### Function & Control Flow

#### Function
Function utilities, boolean functions, forwarding, and composition.

**Location:** `packages/util/src/lib/function/`

**Representative Exports:**
- `forwardGetter(getter)` - Forward function calls
- `booleanFunction(predicate)` - Boolean predicate utilities
- `cachedGetter(fn)` - Memoize function
- `identity(x)` - Identity function (returns input)
- `noop()` - No-operation function

#### Getter
Getter/factory patterns with caching and lazy evaluation.

**Location:** `packages/util/src/lib/getter/`

**Key Concepts:**
- Lazy evaluation patterns
- Cached/memoized getters
- Getter vs value abstractions

**Representative Exports:**
- `GetterOrValue<T>` type - Function or value
- `asGetter(getterOrValue)` - Convert to getter function
- `asValue(getterOrValue)` - Resolve to value
- `cachedGetter(fn)` - Cache result of getter
- `lazyGetterFactory(factoryFn)` - Lazy initialization

**Common Patterns:**
```typescript
// Lazy evaluation
const config: GetterOrValue<Config> = () => loadConfig();
const value = asValue(config); // Calls function if needed

// Cached getter
const expensiveGetter = cachedGetter(() => computeExpensiveValue());
const val1 = expensiveGetter(); // Computes
const val2 = expensiveGetter(); // Returns cached
```

#### Filter
Generic filtering utilities and filter factories.

**Location:** `packages/util/src/lib/filter/`

**Representative Exports:**
- `filterFactory(config)` - Create filter function
- `filterPredicate(predicate)` - Predicate-based filter
- `FilterFunction<T>` type - Filter function type

### Type & Value Processing

#### Type
Type checking utilities and type guards.

**Location:** `packages/util/src/lib/type/`

**Representative Exports:**
- `isObject(value)` - Check if object
- `isString(value)` - Check if string
- `isNumber(value)` - Check if number
- `isBoolean(value)` - Check if boolean
- `PrimativeKey` type - Primitive key types (string | number)

#### Boolean
Boolean operations and predicate composition.

**Location:** `packages/util/src/lib/boolean/`

**Representative Exports:**
- `invertBooleanFunction(fn)` - Invert predicate
- `andBooleanFunctions(fns)` - Combine with AND
- `orBooleanFunctions(fns)` - Combine with OR

#### Number
Number operations, rounding, random generation, bounds, and bitwise operations.

**Location:** `packages/util/src/lib/number/`

**Representative Exports:**
- `roundNumber(num, precision)` - Round with precision
- `randomNumber(min, max)` - Random in range
- `clampNumber(value, min, max)` - Clamp to bounds
- `bitwiseUtil(flags)` - Bitwise flag operations
- `incrementNumber(num, increment)` - Increment with wrapping
- `NumberUtility` type - Number utility interface

#### Date
Date/time utilities, unix timestamps, expiration checks, and date ranges.

**Location:** `packages/util/src/lib/date/`

**Representative Exports:**
- `dateFromUnixTime(unix)` - Convert unix timestamp to Date
- `unixTimestamp(date)` - Convert Date to unix timestamp
- `dateIsExpired(date)` - Check if date has passed
- `dateRange(start, end)` - Create date range
- `startOfWeek(date)` - Get week start
- `addMinutes(date, minutes)` - Add time to date
- `DateOrUnixNumber` type - Date or timestamp

### Domain-Specific Utilities

#### Model
Model conversions, copying, ID management, and model utilities.

**Location:** `packages/util/src/lib/model/`

**Representative Exports:**
- `ModelKey` type - Model identifier (string)
- `ModelKeyRef` type - Model reference
- `copyModel(model)` - Clone model
- `modelKeyFactoryFunction(prefix)` - Generate model keys
- `modelKeyString(key)` - Convert key to string
- `ModelUtility` type - Model utility interface

#### Auth
Authentication, roles, claims, and permission checking.

**Location:** `packages/util/src/lib/auth/`

**Representative Exports:**
- `AuthRole` type - Role enumeration
- `grantedGrantsFunction(grants)` - Check permissions
- `authClaimsValidator(rules)` - Validate auth claims
- `AuthClaims` type - Authentication claims

#### Contact
Email, phone, domain utilities, and contact information handling.

**Location:** `packages/util/src/lib/contact/`

**Representative Exports:**
- `isValidEmail(email)` - Email validation
- `normalizePhoneNumber(phone)` - Phone formatting
- `parseDomain(url)` - Extract domain from URL
- `EmailAddress` type - Email type
- `PhoneNumber` type - Phone type

#### Page
Pagination utilities, page numbers, and cursors.

**Location:** `packages/util/src/lib/page/`

**Representative Exports:**
- `PageNumber` type - Page number (1-indexed)
- `PageNumberCursor` type - Pagination cursor
- `nextPage(current)` - Navigate to next page
- `previousPage(current)` - Navigate to previous page
- `pageRange(page, perPage)` - Calculate page range

#### Path
Path operations, tree paths, and path utilities.

**Location:** `packages/util/src/lib/path/`

**Representative Exports:**
- `joinPath(segments)` - Combine path segments
- `pathTree(paths)` - Build tree from paths
- `PathRef` type - Path reference

### Storage & Services

#### Storage
Storage abstractions, memory storage, and storage interfaces.

**Location:** `packages/util/src/lib/storage/`

**Representative Exports:**
- `AbstractStorageAccessorFactory` - Storage interface
- `memoryStorageFactory()` - In-memory storage implementation
- `StorageAccessor` type - Storage accessor interface

#### Service
Service handlers, typed services, and service utilities.

**Location:** `packages/util/src/lib/service/`

**Representative Exports:**
- `serviceHandlerFactory(config)` - Create service handler
- `TypedServiceInstance` type - Typed service
- `ServiceConfig` type - Service configuration

### Error Handling & Assertions

#### Error
Error handling, server errors, and error utilities.

**Location:** `packages/util/src/lib/error/`

**Representative Exports:**
- `ServerError` class - Server error type
- `errorMessage(error)` - Extract error message
- `catchError(fn)` - Wrap with error handling
- `throwError(message)` - Throw error

#### Assertion
Assertions, type guards, and null checks.

**Location:** `packages/util/src/lib/assertion/`

**Representative Exports:**
- `assertNonNullable(value)` - Throw if null/undefined
- `assertHasValue(value, message)` - Assert value exists
- `requireCurrentValueFunction(getter)` - Require non-null value
- `requireNotUndefined(value)` - Throw if undefined

### Other Utilities

#### Relation
Relation utilities for managing relationships between entities.

**Location:** `packages/util/src/lib/relation/`

**Representative Exports:**
- `RelationKey` type - Relation identifier
- `relationKeyFromModel(model)` - Extract relation key

#### File
File utilities and XML utilities.

**Location:** `packages/util/src/lib/file/`

**Representative Exports:**
- `FileNameRef` type - File name reference
- `xmlString(xml)` - XML string utilities

#### Nodejs
Node.js specific utilities, primarily for stream handling.

**Location:** `packages/util/src/lib/nodejs/`

**Representative Exports:**
- `streamToBuffer(stream)` - Convert stream to buffer
- `streamToString(stream)` - Convert stream to string

#### Misc
Miscellaneous utilities including color and host utilities.

**Location:** `packages/util/src/lib/misc/`

**Representative Exports:**
- `colorFromHex(hex)` - Parse hex color
- `hostNameFromUrl(url)` - Extract hostname

#### Grouping
Value grouping utilities.

**Location:** `packages/util/src/lib/grouping/`

**Representative Exports:**
- `makeValuesGroupMap(values, keyFn)` - Group values by key

#### Hash
Hashing utilities.

**Location:** `packages/util/src/lib/hash/`

**Representative Exports:**
- `hashCode(value)` - Generate hash code
- `hashCodeString(str)` - Hash string value

#### Iterate
Iteration utilities (distinct from iterable module).

**Location:** `packages/util/src/lib/iterate/`

**Representative Exports:**
- `iterateFunction(fn, count)` - Call function N times

#### Lifecycle
Lifecycle management utilities.

**Location:** `packages/util/src/lib/lifecycle/`

**Representative Exports:**
- `Destroyable` interface - Objects that can be destroyed
- `destroyAll(items)` - Destroy multiple items

#### Sort
Sorting utilities and sort functions.

**Location:** `packages/util/src/lib/sort/`

**Representative Exports:**
- `sortByNumberFunction(getValue)` - Create number sort
- `sortByStringFunction(getValue)` - Create string sort

#### Key
Key utilities and key operations.

**Location:** `packages/util/src/lib/key/`

**Representative Exports:**
- `KeyRef` type - Key reference
- `keyFromRef(ref)` - Extract key from reference

## Common Patterns

### Converting Single Values to Arrays
```typescript
import { convertToArray, asArray } from '@dereekb/util';

// Convert single value or array to array
const arr = convertToArray(valueOrArray); // [value] or [item1, item2]

// Ensure array (keep empty arrays empty)
const arr2 = asArray(maybeArray); // [] or array

// Safe array access
const items = arrayOrEmpty(null); // []
```

### Promise Limiting for Concurrency
```typescript
import { promiseLimit } from '@dereekb/util';

// Limit concurrent async operations
const fetchUser = async (id: string) => { /* ... */ };
const limitedFetch = promiseLimit(fetchUser, { limit: 5 });

// Process 100 users but only 5 at a time
const results = await Promise.all(
  userIds.map(id => limitedFetch(id))
);
```

### Working with Maybe Types
```typescript
import { Maybe, isMaybe, mapMaybe } from '@dereekb/util';

// Define optional value
function findUser(id: string): Maybe<User> {
  const user = database.get(id);
  return user; // Can be User | undefined | null
}

// Type-safe checking
const user = findUser('123');
if (isMaybe(user)) {
  console.log(user.name); // TypeScript knows user exists
}

// Transform maybe value
const name = mapMaybe(user, (u) => u.name); // Maybe<string>
```

### Getter Pattern for Lazy Evaluation
```typescript
import { GetterOrValue, asValue, cachedGetter } from '@dereekb/util';

// Accept either value or function
function initialize(config: GetterOrValue<Config>) {
  const resolvedConfig = asValue(config); // Calls function if needed
  // Use config...
}

// Can pass value directly
initialize(myConfig);

// Or lazy function
initialize(() => loadConfigFromFile());

// Cache expensive computations
const getExpensiveData = cachedGetter(() => {
  return computeExpensiveValue();
});
```

### Object Merging and Filtering
```typescript
import { mergeObjects, filterObjectByKeys } from '@dereekb/util';

// Deep merge multiple objects
const merged = mergeObjects([defaults, userConfig, overrides]);

// Filter to specific keys
const publicUser = filterObjectByKeys(user, new Set(['id', 'name', 'email']));
```

### Async Looping
```typescript
import { promiseLoop } from '@dereekb/util';

// Process items sequentially with async
await promiseLoop({
  items: users,
  forEach: async (user) => {
    await updateUser(user);
    await sendEmail(user);
  }
});
```

## Best Practices

### DO:
- **Use type guards** (`isMaybe`, `isObject`) for safe type narrowing
- **Prefer utilities over manual implementations** - Less error-prone and more tested
- **Use promise utilities** for async control flow (limits, loops, delays)
- **Leverage getter patterns** for lazy evaluation and caching
- **Use Maybe types** instead of `| undefined` for better type safety
- **Import specific utilities** rather than entire modules for better tree-shaking

### DON'T:
- **Don't reinvent utilities** that exist in @dereekb/util - Check first!
- **Don't mix with lodash** unnecessarily - Prefer @dereekb/util for consistency
- **Don't ignore type exports** - Types like `Maybe`, `ArrayOrValue`, `GetterOrValue` are valuable
- **Don't skip type guards** - Use `isMaybe`, `isObject`, etc. for type safety
- **Don't use manual promise limiting** - Use `promiseLimit` instead

### Performance:
- Utilities are optimized for typical use cases
- Use `cachedGetter` for expensive computations called multiple times
- `promiseLimit` prevents overwhelming systems with concurrent requests
- Array utilities are optimized for common patterns

## Related Packages

### Direct Dependencies (Packages that depend on @dereekb/util):
- **[@dereekb/rxjs](./../../../packages/rxjs/)** - RxJS-specific utilities (use for Observable patterns)
- **[@dereekb/model](./../../../packages/model/)** - Model abstractions (use for domain modeling)
- **[@dereekb/date](./../../../packages/date/)** - Advanced date utilities with date-fns (use for complex date logic)
- **[@dereekb/dbx-core](./../../../packages/dbx-core/)** - Angular utilities (all DBX packages use util)
- **[@dereekb/firebase](./../../../packages/firebase/)** - Firebase utilities

### When to Use Other Packages:
- **Need Observable patterns?** → Use @dereekb/rxjs (builds on util)
- **Need date recurrence or timezone?** → Use @dereekb/date (extends util date module)
- **Need domain models?** → Use @dereekb/model (builds on util)
- **Need Angular features?** → Use @dereekb/dbx-core (uses util internally)

## Quick Module Finder

Can't find what you need? Use this index:

**I need to...**
- Manipulate arrays → `array` module
- Work with strings → `string` module
- Handle promises/async → `promise` module
- Work with objects → `object` module
- Handle optional values → `value` module (Maybe types)
- Create getters/lazy values → `getter` module
- Work with numbers → `number` module
- Handle dates → `date` module
- Type checking → `type` module
- Error handling → `error` module
- Assertions → `assertion` module
- Work with sets → `set` module
- Work with maps → `map` module
- Iteration → `iterable` module
- Tree structures → `tree` module
- Model utilities → `model` module
- Auth/permissions → `auth` module
- Email/phone validation → `contact` module
- Pagination → `page` module
- File operations → `file` module
- Storage abstraction → `storage` module

## Package Stats

- **Total Files:** 335 TypeScript files
- **Modules:** 35 top-level modules
- **Exports:** ~1,972 total exports
- **Test Coverage:** Comprehensive with .spec.ts files
- **Documentation:** ~1,144 JSDoc comment blocks
- **Size:** Core library ~1.9MB (before minification)

## Additional Resources

- **Package Documentation:** See [.agent/PACKAGES.md](./../../PACKAGES.md) for all packages
- **Source Code:** [packages/util/src/lib/](./../../packages/util/src/lib/)
- **Tests:** Co-located .spec.ts files with implementations
- **Changelog:** [packages/util/CHANGELOG.md](./../../packages/util/CHANGELOG.md)
- **TypeScript Paths:** See [tsconfig.base.json](./../../tsconfig.base.json) for import paths
