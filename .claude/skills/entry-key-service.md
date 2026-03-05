# Entry-Key Service Pattern

Guide for creating Angular services that manage a registry of typed entries keyed by a string identifier. This pattern is used throughout the codebase for configurable services like error widgets, linkify options, and model entity widgets.

## When to Use

Use this skill when creating a new service that:
- Manages a `Map<KeyType, EntryType>` of configuration entries
- Has a default entry and allows type-specific overrides
- Needs app-level configuration via `provideXxx()` and runtime registration via `register()`
- Follows the registry/lookup pattern

## Pattern Overview

The entry-key service pattern consists of 4 files:

```
feature/
  feature.ts              # Key type, default constant, options types
  feature.service.ts      # Service with Map, Config class, Entry interface
  feature.providers.ts    # provideXxx() function
  feature.component.ts    # Component that consumes the service
```

## File 1: Types (`feature.ts`)

Define the key type, default key constant, and any options types.

```typescript
// feature.ts

/**
 * The default feature string type.
 */
export const DEFAULT_FEATURE_TYPE: FeatureType = 'DEFAULT';

/**
 * Custom key used to identify a type of feature.
 */
export type FeatureType = string;

/**
 * Options/configuration associated with each entry.
 * Can be a custom interface or extracted from a library type.
 */
export type FeatureOptions = { /* ... */ };
// Or extract from a library: export type FeatureOptions = Parameters<typeof libraryFn>[1];
```

## File 2: Service (`feature.service.ts`)

The service file contains three things: the **Entry interface**, the **Config abstract class** (used as DI token), and the **Service** itself.

### Entry Interface

The full entry with its key field and configuration data:

```typescript
export interface FeatureServiceEntry {
  readonly type: FeatureType;
  readonly options: FeatureOptions;
  // Add other fields as needed - the entry interface can grow over time
}
```

### Default Entry Type

An `Omit` type that removes the key field. Used by `registerDefaultEntry()` and the Config class so callers don't need to specify the key:

```typescript
export type FeatureServiceDefaultEntry = Omit<FeatureServiceEntry, 'type'>;
```

### Config Abstract Class (DI Token)

An abstract class that serves as both the DI token and the shape of the initial configuration. Fields should use `Maybe<>` and `ArrayOrValue<>` for flexibility:

```typescript
export abstract class FeatureServiceConfig {
  abstract defaultEntry?: Maybe<FeatureServiceDefaultEntry>;
  abstract entries?: Maybe<ArrayOrValue<FeatureServiceEntry>>;
}
```

### Service Implementation

```typescript
@Injectable({
  providedIn: 'root'
})
export class FeatureService {
  private readonly _entries = new Map<FeatureType, FeatureServiceEntry>();

  constructor() {
    // 1. Optionally inject initial config
    const initialConfig = inject(FeatureServiceConfig, { optional: true });

    // 2. Register provided defaults and entries
    if (initialConfig?.defaultEntry) {
      this.registerDefaultEntry(initialConfig.defaultEntry);
    }
    if (initialConfig?.entries) {
      this.register(initialConfig.entries);
    }

    // 3. If no default was provided, register built-in defaults
    if (!this._entries.has(DEFAULT_FEATURE_TYPE)) {
      this.registerDefaultEntry({ options: { /* sensible defaults */ } });
    }
  }

  /**
   * Registers the default entry (no key required).
   */
  registerDefaultEntry(entry: FeatureServiceDefaultEntry): void {
    this._entries.set(DEFAULT_FEATURE_TYPE, {
      ...entry,
      type: DEFAULT_FEATURE_TYPE
    });
  }

  /**
   * Registers one or more entries by key.
   * Uses useIterableOrValue from @dereekb/util for ArrayOrValue support.
   */
  register(entries: ArrayOrValue<FeatureServiceEntry>, override: boolean = true): void {
    useIterableOrValue(entries, (entry) => {
      if (override || !this._entries.has(entry.type)) {
        this._entries.set(entry.type, entry);
      }
    });
  }

  // MARK: Get
  getDefaultEntry(): Maybe<FeatureServiceEntry> {
    return this._entries.get(DEFAULT_FEATURE_TYPE);
  }

  getEntryRegisteredForType(type: FeatureType): Maybe<FeatureServiceEntry> {
    return this._entries.get(type);
  }

  /**
   * Returns entry for the given type, or default if type is null/undefined.
   */
  getEntry(type?: Maybe<FeatureType>): Maybe<FeatureServiceEntry> {
    return type ? this._entries.get(type) : this.getDefaultEntry();
  }
}
```

### Key Patterns

- **`inject()` with `{ optional: true }`**: The config is optional so the service works without `provideXxx()` being called.
- **`useIterableOrValue()`**: From `@dereekb/util`, handles both single values and arrays in `register()`.
- **`override` parameter**: Defaults to `true` so later registrations win. Set to `false` to only register if the key doesn't already exist.
- **`getEntry()` vs `getEntryRegisteredForType()`**: `getEntry()` is the convenience method that falls back to default when no type is given. `getEntryRegisteredForType()` is the strict lookup.

## File 3: Providers (`feature.providers.ts`)

The provider function creates `EnvironmentProviders` using a factory pattern.

```typescript
import { type EnvironmentProviders, type Injector, type Provider, makeEnvironmentProviders } from '@angular/core';
import { FeatureServiceConfig } from './feature.service';

export type FeatureServiceConfigFactory = (injector: Injector) => FeatureServiceConfig;

export interface ProvideFeatureConfig {
  readonly featureServiceConfigFactory: FeatureServiceConfigFactory;
}

export function provideFeature(config: ProvideFeatureConfig): EnvironmentProviders {
  const { featureServiceConfigFactory } = config;

  const providers: Provider[] = [
    {
      provide: FeatureServiceConfig,
      useFactory: featureServiceConfigFactory
    }
  ];

  return makeEnvironmentProviders(providers);
}
```

### Usage in `root.app.config.ts`

```typescript
provideFeature({
  featureServiceConfigFactory: () => ({
    defaultEntry: { options: { /* override defaults */ } },
    entries: [
      { type: 'custom-type', options: { /* type-specific config */ } }
    ]
  })
})
```

## File 4: Component Consumption

Components inject the service and use `getEntry()` to resolve configuration:

```typescript
@Component({ /* ... */ })
export class FeatureComponent {
  private readonly featureService = inject(FeatureService);

  readonly config = input<Maybe<FeatureConfig>>();

  readonly result = computed(() => {
    const config = this.config();

    // Resolve entry from service (falls back to default if no type)
    const entry = this.featureService.getEntry(config?.type);
    const baseOptions = entry?.options;

    // Merge with inline options (inline overrides base)
    const options = { ...baseOptions, ...config?.options };

    return doSomething(options);
  });
}
```

The component config interface separates the type key from inline overrides:

```typescript
export interface FeatureConfig {
  readonly type?: Maybe<FeatureType>;
  readonly options?: FeatureOptions;
}
```

## Runtime Registration

Besides app-level config, entries can be registered at runtime from any component or service:

```typescript
export class SomeComponent {
  private readonly featureService = inject(FeatureService);

  constructor() {
    this.featureService.register({
      type: 'my-custom-type',
      options: { /* ... */ }
    });
  }
}
```

## Barrel Exports

Export all files from the package's barrel `index.ts`:

```typescript
export * from './feature/feature';
export * from './feature/feature.component';
export * from './feature/feature.service';
export * from './feature/feature.providers';
```

## Existing Examples in Codebase

| Service | Key Type | Entry Type | Location |
|---------|----------|------------|----------|
| `DbxLinkifyService` | `DbxLinkifyStringType` | `DbxLinkifyServiceEntry` | `packages/dbx-web/src/lib/layout/text/linkify/` |
| `DbxErrorWidgetService` | `StringErrorCode` | `DbxErrorWidgetEntry` | `packages/dbx-web/src/lib/error/` |
| `DbxFirebaseModelEntitiesWidgetService` | `FirestoreModelIdentity` | `DbxFirebaseModelEntitiesWidgetEntry` | `packages/dbx-firebase/src/lib/model/modules/model/entities/` |

## Utilities from @dereekb/util

These utilities are commonly used in entry-key services:

- **`ArrayOrValue<T>`**: Type that accepts `T` or `T[]`
- **`useIterableOrValue(input, fn)`**: Iterates over `ArrayOrValue`, calling `fn` for each item
- **`Maybe<T>`**: Type alias for `T | undefined | null`
- **`filterMaybeArrayValues(array)`**: Filters out null/undefined from arrays
- **`mapIterable(iterable, fn)`**: Maps over any iterable
