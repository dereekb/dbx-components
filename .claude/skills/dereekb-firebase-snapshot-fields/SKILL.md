# @dereekb/firebase Snapshot Fields Reference

Complete reference for all available Firestore snapshot field mapping functions from `@dereekb/firebase`. These functions handle conversion between Firestore data and TypeScript model values.

## Core Concepts

Snapshot field functions convert data between:
- **Model values** (V) - TypeScript types used in your application
- **Firestore data** (D) - Values stored in Firestore documents

All field functions are imported from `@dereekb/firebase`:
```typescript
import {
  firestoreString,
  firestoreBoolean,
  firestoreNumber,
  firestoreDate,
  firestoreArray,
  firestoreMap,
  // ... etc
} from '@dereekb/firebase';
```

## Basic Fields

### String Fields

#### `firestoreString<S>(config?: FirestoreStringConfig<S>)`

Maps string values with optional transformation.

```typescript
// Simple string with default empty string
name: firestoreString()

// With default value
name: firestoreString({ default: 'Untitled' })

// With transformation (e.g., lowercase)
email: firestoreString({
  transform: (s) => s.toLowerCase()
})

// With max length transform
code: firestoreString({
  transform: { maxLength: 10 }
})
```

**Config options:**
- `default?: S` - Default value (defaults to `''`)
- `transform?: TransformStringFunctionConfigInput<S>` - Transform function or config
- `defaultBeforeSave?: GetterOrValue<S>` - Value to use when saving if null/undefined

#### `optionalFirestoreString<S>(config?: OptionalFirestoreString<S>)`

Maps optional string values (can be null/undefined).

```typescript
// Optional string
description: optionalFirestoreString()

// With default read value
nickname: optionalFirestoreString({
  defaultReadValue: 'Anonymous'
})

// Don't store if empty string
bio: optionalFirestoreString({
  dontStoreIf: ''
})

// With transformation
username: optionalFirestoreString({
  transform: (s) => s.toLowerCase()
})
```

**Config options:**
- `defaultReadValue?: GetterOrValue<S>` - Value to return when reading null/undefined
- `dontStoreIf?: S | DecisionFunction<S>` - Don't store if value matches
- `dontStoreDefaultReadValue?: boolean` - Don't store if equals defaultReadValue
- `transform?: TransformStringFunctionConfigInput<S>` - Transform function

### Boolean Fields

#### `firestoreBoolean(config: FirestoreBooleanFieldConfig)`

Maps boolean values. **Default is required.**

```typescript
// Boolean with default false
published: firestoreBoolean({ default: false })

// Boolean with default true
active: firestoreBoolean({ default: true })
```

**Config options:**
- `default: boolean` - **Required** default value
- `defaultBeforeSave?: GetterOrValue<boolean>` - Value when saving if null/undefined

#### `optionalFirestoreBoolean(config?: OptionalFirestoreBooleanFieldConfig)`

Maps optional boolean values.

```typescript
// Optional boolean
verified: optionalFirestoreBoolean()

// Don't store false values
premium: optionalFirestoreBoolean({
  dontStoreIf: false
})
```

### Number Fields

#### `firestoreNumber<N>(config: FirestoreNumberConfig<N>)`

Maps number values with optional transformation and bounds.

```typescript
// Number with default
count: firestoreNumber({ default: 0 })

// With bounds
rating: firestoreNumber({
  default: 0,
  transform: {
    bounds: { min: 0, max: 5 }
  }
})

// With precision (rounds to 2 decimal places)
price: firestoreNumber({
  default: 0,
  transform: { precision: 2 }
})

// Save default value
score: firestoreNumber({
  default: 0,
  saveDefault: true
})
```

**Config options:**
- `default: N` - **Required** default value
- `transform?: TransformNumberFunctionConfigInput<N>` - Transform config or function
- `saveDefault?: boolean` - Whether to save default if value is null/undefined
- `defaultBeforeSave?: GetterOrValue<N>` - Value when saving if null/undefined

**Transform options:**
- `bounds?: { min?: N, max?: N }` - Clamp to range
- `precision?: number` - Round to decimal places

#### `optionalFirestoreNumber<N>(config?: OptionalFirestoreNumberFieldConfig<N>)`

Maps optional number values.

```typescript
// Optional number
discount: optionalFirestoreNumber()

// Don't store zero values
views: optionalFirestoreNumber({
  dontStoreIf: 0
})

// With transformation
percentage: optionalFirestoreNumber({
  transform: {
    bounds: { min: 0, max: 100 },
    precision: 1
  }
})
```

### Enum Fields

#### `firestoreEnum<S>(config: FirestoreEnumConfig<S>)`

Maps enum values (string or number).

```typescript
enum Status {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived'
}

// Enum with default
status: firestoreEnum<Status>({
  default: Status.Draft
})
```

**Config options:**
- `default: S` - **Required** default enum value

#### `optionalFirestoreEnum<S>(config?: OptionalFirestoreEnumConfig<S>)`

Maps optional enum values.

```typescript
// Optional enum
priority: optionalFirestoreEnum<Priority>()

// Don't store default value
visibility: optionalFirestoreEnum<Visibility>({
  dontStoreIf: Visibility.Public
})
```

### UID Fields

#### `firestoreUID()`

Maps Firebase Auth user ID strings. Default is empty string.

```typescript
// User ID field
uid: firestoreUID()
```

#### `optionalFirestoreUID()`

Maps optional Firebase Auth user IDs.

```typescript
// Optional user ID (e.g., created by)
cby: optionalFirestoreUID()
```

## Date Fields

### `firestoreDate(config?: FirestoreDateFieldConfig)`

Maps JavaScript Date objects to/from ISO8601 strings in Firestore.

```typescript
// Date with auto-generated default (current time)
createdAt: firestoreDate()

// Date with specific default
dueDate: firestoreDate({
  default: () => new Date('2025-01-01')
})

// Auto-save current timestamp
updatedAt: firestoreDate({
  saveDefaultAsNow: true
})
```

**Config options:**
- `default?: GetterOrValue<Date>` - Default date (defaults to current time)
- `saveDefaultAsNow?: boolean` - Save current timestamp as default when saving
- `defaultBeforeSave?: GetterOrValue<string>` - ISO string to use when saving if null

### `optionalFirestoreDate(config?: OptionalFirestoreDateFieldConfig)`

Maps optional Date values.

```typescript
// Optional date
completedAt: optionalFirestoreDate()

// Don't store specific date
archivedAt: optionalFirestoreDate({
  dontStoreValueIf: new Date('1970-01-01')
})

// With default read value
scheduledAt: optionalFirestoreDate({
  defaultReadValue: () => new Date()
})
```

### Unix Timestamp Fields

#### `firestoreUnixDateTimeSecondsNumber(config: FirestoreUnixDateTimeSecondsNumberFieldConfig)`

Maps Date objects to/from Unix timestamp seconds (number).

```typescript
// Unix timestamp
timestamp: firestoreUnixDateTimeSecondsNumber({
  default: () => new Date()
})

// With saveDefaultAsNow
lastSeen: firestoreUnixDateTimeSecondsNumber({
  saveDefaultAsNow: true
})
```

#### `optionalFirestoreUnixDateTimeSecondsNumber(config?: OptionalFirestoreUnixDateTimeSecondsNumberFieldConfig)`

Maps optional Unix timestamps.

```typescript
// Optional timestamp
expiredAt: optionalFirestoreUnixDateTimeSecondsNumber()
```

## Array Fields

### `firestoreArray<T>(config: FirestoreArrayFieldConfig<T>)`

Maps array values with optional sorting.

```typescript
// Simple array with default empty
tags: firestoreArray({ default: [] })

// Array that sorts values
priorities: firestoreArray({
  sortWith: (a, b) => a - b
})
```

**Config options:**
- `default?: GetterOrValue<T[]>` - Default array (defaults to `[]`)
- `sortWith?: SortCompareFunction<T>` - Sort function for values
- `defaultBeforeSave?: GetterOrValue<T[]>` - Value when saving if null

### `optionalFirestoreArray<T>(config?: OptionalFirestoreArrayFieldConfig<T>)`

Maps optional array values with filtering and uniqueness options.

```typescript
// Optional array
comments: optionalFirestoreArray()

// Don't store if empty
roles: optionalFirestoreArray({
  dontStoreIfEmpty: true
})

// Filter unique values
userIds: optionalFirestoreArray<string>({
  filterUnique: true
})

// Custom unique filter with sort
items: optionalFirestoreArray({
  filterUnique: (arr) => unique(arr),
  sortWith: sortAscendingIndexNumberRefFunction()
})
```

**Config options:**
- `filterUnique?: FilterUniqueFunction<T> | true` - Filter for uniqueness
- `dontStoreIfEmpty?: boolean` - Don't store empty arrays (default: false)
- `dontStoreIf?: DecisionFunction<T[]>` - Custom condition to not store
- `sortWith?: SortCompareFunction<T>` - Sort function
- `transformData?: MapFunction<T[], T[]>` - Transform array

### `firestoreUniqueArray<T, K>(config: FirestoreUniqueArrayFieldConfig<T, K>)`

Maps arrays with automatic uniqueness filtering.

```typescript
// Unique array (for primitive types)
tags: firestoreUniqueArray({
  filterUnique: true
})

// With custom filter
ids: firestoreUniqueArray({
  filterUnique: (arr) => [...new Set(arr)]
})
```

### `firestoreUniqueStringArray<S>(config?: FirestoreUniqueStringArrayFieldConfig<S>)`

Maps arrays of unique strings.

```typescript
// Unique string array
tags: firestoreUniqueStringArray()

// With case-insensitive uniqueness
categories: firestoreUniqueStringArray({
  toLowercase: true
})

// With sorting
keywords: firestoreUniqueStringArray({
  sortWith: (a, b) => a.localeCompare(b)
})
```

### `firestoreUniqueNumberArray<S>(config?: FirestoreUniqueNumberArrayFieldConfig<S>)`

Maps arrays of unique numbers.

```typescript
// Unique number array
ratings: firestoreUniqueNumberArray()

// With sorting
scores: firestoreUniqueNumberArray({
  sortWith: (a, b) => b - a
})
```

### `firestoreEnumArray<S>(config?: FirestoreEnumArrayFieldConfig<S>)`

Maps arrays of unique enum values.

```typescript
enum Permission {
  Read = 'read',
  Write = 'write',
  Delete = 'delete'
}

// Enum array
permissions: firestoreEnumArray<Permission>()
```

### `firestoreUniqueKeyedArray<T, K>(config: FirestoreUniqueKeyedArrayFieldConfig<T, K>)`

Maps arrays with uniqueness based on a key function.

```typescript
interface Item {
  id: string;
  name: string;
}

// Unique by ID
items: firestoreUniqueKeyedArray<Item, string>({
  readKey: (item) => item.id
})
```

### `firestoreEncodedArray<T, E>(config: FirestoreEncodedArrayFieldConfig<T, E>)`

Maps arrays with custom encoding/decoding.

```typescript
// Array with custom encoding
encoded: firestoreEncodedArray<ComplexType, string>({
  convert: {
    fromData: (s) => parseComplexType(s),
    toData: (t) => stringifyComplexType(t)
  }
})
```

**Config options:**
- `convert.fromData: MapFunction<E, T>` - Decode function
- `convert.toData: MapFunction<T, E>` - Encode function
- `sortWith?: SortCompareFunction<T>` - Sort function

### Model Key Arrays

Convenience functions for model key/ID arrays:

```typescript
// Array of model keys
relatedIds: firestoreModelKeyArrayField

// Array of model IDs (alias)
documentIds: firestoreModelIdArrayField
```

## Object Fields

### `firestoreMap<T, K>(config?: FirestoreMapFieldConfig<T, K>)`

Maps object/map values with string keys.

```typescript
// Simple map
metadata: firestoreMap()

// Map with value transformation
scores: firestoreMap({
  mapFieldValues: (v) => v ?? 0
})

// Map filtering null values (default behavior)
attributes: firestoreMap({
  mapFilter: KeyValueTypleValueFilter.NULL
})

// Map filtering empty values
roles: firestoreMap({
  mapFilter: KeyValueTypleValueFilter.EMPTY
})
```

**Config options:**
- `default?: GetterOrValue<Record<K, T>>` - Default map (defaults to `{}`)
- `mapFilter?: FilterKeyValueTuplesInput` - Filter for key-value pairs
- `mapFieldValues?: MapFunction<Maybe<T>, Maybe<T>>` - Transform values
- `defaultBeforeSave?: GetterOrValue<Record<K, T>>` - Value when saving

**Built-in filters:**
- `KeyValueTypleValueFilter.NULL` - Remove null/undefined (default)
- `KeyValueTypleValueFilter.EMPTY` - Remove null/undefined/empty strings/arrays
- `KeyValueTypleValueFilter.FALSY` - Remove all falsy values

### `firestoreEncodedObjectMap<T, E, S>(config: FirestoreEncodedObjectMapFieldConfig<T, E, S>)`

Maps objects with encoded values.

```typescript
// Map with encoded values
encoded: firestoreEncodedObjectMap({
  encoder: (value) => JSON.stringify(value),
  decoder: (json) => JSON.parse(json)
})
```

**Config options:**
- `encoder: MapFunction<T, E>` - Encode values
- `decoder: MapFunction<E, T>` - Decode values
- `mapFilter?: FilterKeyValueTuplesInput` - Filter for entries

### Granted Role Maps

Convenience functions for role maps:

```typescript
// Map of roles keyed by model key
roleMap: firestoreModelKeyGrantedRoleMap<MyRole>()

// Map of role arrays keyed by model key
roleArrayMap: firestoreModelKeyGrantedRoleArrayMap<MyRole>()

// Encoded role map
encodedRoles: firestoreModelKeyEncodedGrantedRoleMap<MyRole, string>(dencoder)
```

### Array Map

#### `firestoreArrayMap<T, K>(config?: FirestoreArrayMapFieldConfig<T, K>)`

Maps objects where values are arrays.

```typescript
// Map of arrays
tagsByCategory: firestoreArrayMap()

// Filters empty arrays by default
permissions: firestoreArrayMap({
  mapFieldValues: filterEmptyArrayValues
})
```

## Nested Object Fields

### `firestoreSubObject<T, O>(config: FirestoreSubObjectFieldConfig<T, O>)`

Maps nested objects using field configurations.

```typescript
// Nested object with its own fields
address: firestoreSubObject({
  objectField: {
    street: firestoreString(),
    city: firestoreString(),
    zip: firestoreString()
  }
})

// Save default object structure
config: firestoreSubObject({
  saveDefaultObject: true,
  objectField: {
    enabled: firestoreBoolean({ default: false }),
    value: firestoreNumber({ default: 0 })
  }
})
```

**Config options:**
- `objectField: ToModelMapFunctionsInput<T, O>` - **Required** field definitions
- `default?: GetterOrValue<T>` - Default object
- `saveDefaultObject?: boolean` - Save default structure (default: false)
- `defaultBeforeSave?: GetterOrValue<O>` - Value when saving if null

### `firestoreObjectArray<T, O>(config: FirestoreObjectArrayFieldConfig<T, O>)`

Maps arrays of nested objects.

```typescript
// Array of objects with fields
items: firestoreObjectArray({
  objectField: {
    name: firestoreString(),
    count: firestoreNumber({ default: 0 })
  }
})

// With uniqueness filter
users: firestoreObjectArray({
  objectField: userFields,
  filterUnique: (arr) => uniqueBy(arr, (u) => u.id)
})

// With sorting
events: firestoreObjectArray({
  objectField: eventFields,
  sortWith: (a, b) => a.date.getTime() - b.date.getTime()
})
```

**Config options:**
- `objectField: ToModelMapFunctionsInput<T, O>` - **Required** field definitions
- `firestoreField?: FirestoreModelFieldMapFunctionsConfig<T, O>` - Alternative to objectField
- `filterUnique?: FilterUniqueFunction<T>` - Uniqueness filter
- `filter?: FilterFunction<T>` - Arbitrary filter
- `sortWith?: SortCompareFunction<T>` - Sort function

## Special Fields

### Location Fields

#### `firestoreLatLngString(config?: FirestoreLatLngStringConfig)`

Maps latitude/longitude string values.

```typescript
// Lat/lng string (e.g., "37.7749,-122.4194")
location: firestoreLatLngString()

// With precision
coordinates: firestoreLatLngString({
  precision: 6  // 6 decimal places
})
```

**Config options:**
- `precision?: LatLngPrecision` - Decimal precision (0-8)
- `default?: LatLngString` - Default coordinates

#### `firestoreTimezoneString(config?: FirestoreTimezoneStringConfig)`

Maps timezone identifier strings.

```typescript
// Timezone string (e.g., "America/New_York")
timezone: firestoreTimezoneString()

// With default
tz: firestoreTimezoneString({
  default: 'UTC'
})
```

### Address Fields

#### `firestoreUnitedStatesAddress()`

Maps United States address objects.

```typescript
// US address with standard fields
address: firestoreUnitedStatesAddress()
```

**Address interface:**
```typescript
interface UnitedStatesAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}
```

#### `optionalFirestoreUnitedStatesAddress()`

Maps optional US address objects.

```typescript
// Optional US address
billingAddress: optionalFirestoreUnitedStatesAddress()
```

### Map Zoom Field

#### `firestoreMapZoomLevel`

Pre-configured number field for map zoom levels (0-22).

```typescript
// Map zoom level (0-22, default 5)
zoom: firestoreMapZoomLevel
```

### Website Link Fields

#### `firestoreWebsiteLink()`

Maps website link objects.

```typescript
// Website link
link: firestoreWebsiteLink()
```

#### `firestoreWebsiteLinkArray()`

Maps arrays of website links.

```typescript
// Array of website links
links: firestoreWebsiteLinkArray()
```

### Website File Link Fields

#### `firestoreWebsiteFileLink()`

Maps website file link objects.

```typescript
// File link
file: firestoreWebsiteFileLink()
```

#### `firestoreWebsiteFileLinkObjectArray()`

Maps arrays of file links as objects.

```typescript
// Array of file links (as objects)
files: firestoreWebsiteFileLinkObjectArray()
```

#### `firestoreWebsiteFileLinkEncodedArray()`

Maps arrays of file links as encoded strings.

```typescript
// Array of file links (encoded as strings)
attachments: firestoreWebsiteFileLinkEncodedArray()
```

### Date Cell Fields

#### `firestoreDateCellRange()`

Maps date cell range objects (used for scheduling).

```typescript
// Date cell range
range: firestoreDateCellRange()
```

#### `firestoreDateCellRangeArray(sort?: boolean)`

Maps arrays of date cell ranges.

```typescript
// Array of date cell ranges (sorted by default)
ranges: firestoreDateCellRangeArray()

// Unsorted array
unsortedRanges: firestoreDateCellRangeArray(false)
```

#### `firestoreDateCellSchedule()`

Maps date cell schedule objects.

```typescript
// Date cell schedule
schedule: firestoreDateCellSchedule()
```

### Bitwise Encoded Fields

#### `firestoreBitwiseSet<D>(config: FirestoreBitwiseSetConfig<D>)`

Maps Set<number> to bitwise-encoded values.

```typescript
// Bitwise set
flags: firestoreBitwiseSet<number>({
  maxIndex: 31  // Support up to index 31
})
```

**Config options:**
- `maxIndex?: number` - Maximum index to support (default: 53)

#### `firestoreBitwiseSetMap<D, K>(config: FirestoreBitwiseSetMapConfig<D, K>)`

Maps objects with bitwise-encoded set values.

```typescript
// Map of bitwise sets
permissions: firestoreBitwiseSetMap({
  maxIndex: 31
})
```

#### `firestoreBitwiseObjectMap<T, K>(config: FirestoreBitwiseObjectMapConfig<T, K>)`

Maps objects with bitwise-encoded object values.

```typescript
// Map of objects encoded as bitwise values
settings: firestoreBitwiseObjectMap({
  dencoder: myBitwiseObjectDencoder
})
```

**Config options:**
- `dencoder: BitwiseObjectDencoder<T>` - **Required** encoder/decoder function

## Advanced Fields

### Pass-Through Fields

#### `firestorePassThroughField<T>()`

No transformation - stores and reads values as-is.

```typescript
// Store value as-is
raw: firestorePassThroughField<RawType>()
```

### Custom Fields

#### `firestoreField<V, D>(config: FirestoreFieldConfig<V, D>)`

Create custom field mappings.

```typescript
// Custom field with conversion
custom: firestoreField<MyType, string>({
  default: () => new MyType(),
  fromData: (str) => MyType.parse(str),
  toData: (obj) => obj.toString()
})
```

**Config options:**
- `fromData: ModelFieldMapConvertFunction<D, V>` - **Required** decode function
- `toData: ModelFieldMapConvertFunction<V, D>` - **Required** encode function
- `default: GetterOrValue<V>` - Default value (either this OR defaultData required)
- `defaultData: GetterOrValue<D>` - Default data value
- `defaultBeforeSave?: GetterOrValue<D>` - Value when saving if null

#### `optionalFirestoreField<V, D>(config?: OptionalFirestoreFieldConfig<V, D>)`

Create custom optional field mappings.

```typescript
// Optional custom field
optional: optionalFirestoreField<MyType, string>({
  transformFromData: (str) => str ? MyType.parse(str) : null,
  transformToData: (obj) => obj ? obj.toString() : null,
  dontStoreIf: null
})
```

**Config options:**
- `transformFromData?: MapFunction<D, V>` - Decode function
- `transformToData?: MapFunction<V, D | null>` - Encode function
- `defaultReadValue?: GetterOrValue<D>` - Value when reading null
- `dontStoreIf?: D | DecisionFunction<D>` - Don't store condition
- `dontStoreValueIf?: V | DecisionFunction<V>` - Don't store pre-transform condition

## Field Configuration Patterns

### Required vs Optional

- Use `firestore*()` functions for required fields (must provide default)
- Use `optionalFirestore*()` functions for optional fields (can be null/undefined)

### Default Values

```typescript
// Static default
name: firestoreString({ default: 'Untitled' })

// Function default (called each time)
createdAt: firestoreDate({ default: () => new Date() })

// Default before save (only when saving)
updatedAt: firestoreDate({ saveDefaultAsNow: true })
```

### Don't Store Conditions

```typescript
// Don't store specific value
enabled: optionalFirestoreBoolean({ dontStoreIf: false })

// Don't store using function
score: optionalFirestoreNumber({
  dontStoreIf: (n) => n === 0 || n === null
})

// Don't store empty arrays
tags: optionalFirestoreArray({
  dontStoreIfEmpty: true
})
```

### Transformations

```typescript
// Transform on read and write
email: firestoreString({
  transform: (s) => s.toLowerCase().trim()
})

// Transform with config
price: firestoreNumber({
  transform: {
    precision: 2,
    bounds: { min: 0 }
  }
})

// Different transforms for read/write
value: optionalFirestoreField({
  transformFromData: decodeValue,
  transformToData: encodeValue
})
```

### Filtering and Validation

```typescript
// Filter unique
tags: optionalFirestoreArray({
  filterUnique: true
})

// Custom filter
items: firestoreObjectArray({
  filter: (item) => item.isValid
})

// Value filter on map
data: firestoreMap({
  mapFilter: KeyValueTypleValueFilter.EMPTY
})
```

## Common Mistakes

1. **Missing defaults on required fields** - All required field functions need a default value
2. **Using required field for optional data** - Use `optionalFirestore*()` for nullable fields
3. **Not transforming consistently** - Ensure transforms work for both reading and writing
4. **Forgetting to filter arrays** - Arrays can accumulate duplicates without filtering
5. **Over-transforming data** - Keep transformations simple and reversible
6. **Not handling null in optional fields** - Check for null when using transformFromData/transformToData

## Related Skills

- `dereekb-firebase-model` - Complete guide for creating Firestore models
- `angular-component` - Creating components that use these models
- `angular-signals` - Reactive state management with model data
