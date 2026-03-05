---
name: rxjs
description: RxJS utilities and patterns from @dereekb/rxjs - reactive programming utilities including LoadingState, FilterMap, work queues, and custom RxJS operators.
---

# @dereekb/rxjs

## Overview

**@dereekb/rxjs** provides RxJS-specific utilities and reactive patterns for managing state, filters, async operations, and Observable transformations.

**Package Location:** `packages/rxjs/`

**Key Features:**
- LoadingState pattern for async state management
- FilterMap for reactive filter state
- Work queue patterns for task management
- Custom RxJS operators and utilities
- Iterator patterns for Observable iteration
- Subscription management utilities

**Dependencies:**
- rxjs (peer dependency)
- @dereekb/util

**Package Architecture:**
```
@dereekb/util
    ↓
@dereekb/rxjs
    ↓
Used by: @dereekb/dbx-core, @dereekb/firebase, @dereekb/dbx-web
```

## Module Organization (8 modules)

### Loading
**→ See the [dereekb-rxjs-loading](../dereekb-rxjs-loading/SKILL.md) skill for comprehensive LoadingState documentation**

Async state management pattern for loading operations.

**Location:** `packages/rxjs/src/lib/loading/`

**Quick Overview:**
LoadingState represents the state of an async operation (loading, success, error, idle) and provides reactive patterns for propagating state through components.

**Key Exports:**
- `LoadingState<T>` - State interface (loading, value, error, progress)
- `LoadingStateContext<T>` - Observable context for LoadingState
- `ListLoadingStateContext<T>` - Specialized for list data
- `loadingStateFromObs<T>(obs)` - Create LoadingState from Observable
- `beginLoading<T>()` - Start loading state
- `successResult<T>(value)` - Success state with value
- `errorResult(error)` - Error state

**Common Patterns:**
```typescript
import { LoadingState, loadingStateFromObs } from '@dereekb/rxjs';

// Convert Observable to LoadingState
const state$ = loadingStateFromObs(dataStream$);

// Subscribe to loading state
state$.subscribe(state => {
  if (state.loading) {
    showSpinner();
  } else if (state.value) {
    displayData(state.value);
  } else if (state.error) {
    showError(state.error);
  }
});
```

**Use Cases:**
- Firebase data loading
- API calls with loading indicators
- Form submissions with progress
- Multi-step async workflows

### Filter
Reactive filter state management for sharing filter state across components.

**Location:** `packages/rxjs/src/lib/filter/`

**Key Concepts:**
- FilterMap manages multiple named filters
- Filter presets for common filter configurations
- Filter sources for combining filter streams
- Reactive filter updates

**Key Exports:**
- `FilterMap<T>` class - Manages named filters with reactive updates
- `FilterSource<T>` - Observable filter source
- `FilterPreset<T>` - Predefined filter configurations
- `filterForKey(key)` - Get filter Observable for specific key
- `setFilter(key, filter)` - Update filter value

**Common Patterns:**
```typescript
import { FilterMap } from '@dereekb/rxjs';

@Component({
  providers: [FilterMap]
})
export class MyListComponent {
  readonly filterMap = inject(FilterMap<MyFilter>);

  // Get filter for specific key
  readonly filter$ = this.filterMap.filterForKey('main');

  // Update filter
  updateFilter(newFilter: MyFilter) {
    this.filterMap.setFilter('main', newFilter);
  }

  // Clear filter
  clearFilter() {
    this.filterMap.setFilter('main', undefined);
  }
}
```

**Use Cases:**
- Filterable lists and tables
- Search interfaces with multiple filters
- Filter presets (saved searches)
- Partial filter updates

### Work
Work queue patterns for managing task execution.

**Location:** `packages/rxjs/src/lib/work/`

**Key Concepts:**
- Work instances represent units of work
- Factory patterns for creating work
- Queue management for sequential processing
- Progress tracking

**Key Exports:**
- `WorkInstance<T>` - Represents a work unit
- `WorkFactory<T>` - Creates work instances
- `workFactoryFunction(fn)` - Convert function to work factory
- `workInstance(config)` - Create work instance

**Common Patterns:**
```typescript
import { workFactoryFunction, WorkInstance } from '@dereekb/rxjs';

// Create work factory
const processItemWork = workFactoryFunction((item: Item) => {
  return processItem(item); // Returns Observable
});

// Execute work
const work: WorkInstance<Result> = processItemWork(myItem);
work.stream$.subscribe(result => {
  console.log('Work completed:', result);
});
```

**Use Cases:**
- Background task processing
- Sequential work queues
- Progress tracking for long operations
- Retry logic for failed work

### RxJS (Operators & Utilities)
Custom RxJS operators and Observable utilities.

**Location:** `packages/rxjs/src/lib/rxjs/`

**Key Concepts:**
- Custom operators for common patterns
- Observable transformation utilities
- Error handling operators
- Async utilities

**Representative Exports:**
- `shareReplayUntil(notifier)` - shareReplay with automatic cleanup
- `filterMaybe<T>()` - Filter out null/undefined
- `switchMapMaybeDefault<T>(fn, defaultValue)` - switchMap with default
- `distinctUntilKeyChanged<T>(key)` - Distinct by object key
- `successOrThrowError<T>()` - Throw on LoadingState error
- `asObservable(valueOrObs)` - Convert value or Observable
- `tapDetectChanges(cdRef)` - Trigger change detection
- `mapToLoadingState<T>()` - Map to LoadingState

**Common Patterns:**
```typescript
import { filterMaybe, shareReplayUntil, distinctUntilKeyChanged } from '@dereekb/rxjs';

// Filter out nulls
const validValues$ = stream$.pipe(filterMaybe());

// Shared replay with cleanup
const shared$ = expensive$.pipe(
  shareReplayUntil(componentDestroy$)
);

// Distinct by property
const distinctUsers$ = users$.pipe(
  distinctUntilKeyChanged('id')
);
```

**Additional Utilities:**
- `array.ts` - Array Observable utilities
- `boolean.ts` - Boolean Observable utilities
- `getter.ts` - Getter/Observable conversion
- `map.ts` - Map Observable utilities
- `lifecycle.ts` - Component lifecycle utilities
- `timeout.ts` - Timeout operators
- `value.ts` - Value transformation operators

### Iterator
Iterator patterns for Observable sequences.

**Location:** `packages/rxjs/src/lib/iterator/`

**Key Concepts:**
- Async iteration over Observables
- Iterator state management
- Page-based iteration

**Representative Exports:**
- `ObservableIterator<T>` - Iterator interface
- `iteratorNextValueFromObs<T>(obs)` - Get next value
- `makeIterator<T>(config)` - Create iterator

**Common Patterns:**
```typescript
import { ObservableIterator } from '@dereekb/rxjs';

const iterator: ObservableIterator<Item> = makeIterator({
  next: () => fetchNextBatch(),
  hasNext: () => hasMoreItems
});

// Iterate through pages
iterator.next$.subscribe(items => {
  displayItems(items);
});
```

**Use Cases:**
- Paginated data loading
- Infinite scroll
- Batch processing

### Subscription
Subscription management utilities.

**Location:** `packages/rxjs/src/lib/subscription.ts` (single file)

**Key Exports:**
- `SubscriptionObject` - Manages subscriptions
- `subscriptionObject()` - Create subscription manager
- `addSubscription(sub)` - Add subscription to manager
- `unsubscribeAll()` - Unsubscribe all managed subscriptions

**Common Patterns:**
```typescript
import { subscriptionObject } from '@dereekb/rxjs';

class MyComponent implements OnDestroy {
  private readonly _subs = subscriptionObject();

  ngOnInit() {
    // Add subscriptions
    this._subs.add(stream1$.subscribe(...));
    this._subs.add(stream2$.subscribe(...));
  }

  ngOnDestroy() {
    // Unsubscribe all at once
    this._subs.unsubscribe();
  }
}
```

**Use Cases:**
- Component subscription management
- Service cleanup
- Memory leak prevention

### Lock
Mutex/lock patterns for preventing concurrent operations.

**Location:** `packages/rxjs/src/lib/lock.ts` (single file)

**Key Exports:**
- `ObservableLock` - Lock interface
- `observableLock()` - Create lock
- `locked()` - Check if locked
- `withLock(fn)` - Execute with lock

**Common Patterns:**
```typescript
import { observableLock } from '@dereekb/rxjs';

const lock = observableLock();

// Prevent concurrent saves
saveData() {
  if (lock.locked()) {
    return; // Already saving
  }

  return lock.withLock(() => {
    return this.api.save(data);
  });
}
```

**Use Cases:**
- Preventing double-clicks
- Ensuring sequential operations
- Race condition prevention

### Object
Object utilities for reactive patterns with objects.

**Location:** `packages/rxjs/src/lib/object/`

**Key Exports:**
- `mapObjectMapReactive<K, T>(map$, mapFn)` - Transform object map reactively
- `objectMapFromObs<K, T>(entries$)` - Build object map from Observable

**Common Patterns:**
```typescript
import { mapObjectMapReactive } from '@dereekb/rxjs';

const transformed$ = mapObjectMapReactive(
  objectMap$,
  (value, key) => transformValue(value)
);
```

## Common Patterns

### Loading State Management
```typescript
import { LoadingState, loadingStateFromObs, LoadingStateContext } from '@dereekb/rxjs';

// Create loading state from data stream
const dataState$ = loadingStateFromObs(
  this.dataService.getData()
);

// Use in component
dataState$.subscribe(state => {
  if (state.loading) {
    this.showSpinner = true;
  } else if (state.value) {
    this.data = state.value;
    this.showSpinner = false;
  } else if (state.error) {
    this.error = state.error;
    this.showSpinner = false;
  }
});
```

### Filter Management
```typescript
import { FilterMap } from '@dereekb/rxjs';

@Component({
  providers: [FilterMap]
})
export class FilterableListComponent {
  readonly filterMap = inject(FilterMap<ListFilter>);
  readonly filter$ = this.filterMap.filterForKey('main');

  // Reactive filtered data
  readonly filteredData$ = combineLatest([
    this.data$,
    this.filter$
  ]).pipe(
    map(([data, filter]) => applyFilter(data, filter))
  );
}
```

### Work Queue Processing
```typescript
import { workFactoryFunction } from '@dereekb/rxjs';

const processWork = workFactoryFunction((item: Item) => {
  return this.api.process(item);
});

// Process items sequentially
const results$ = from(items).pipe(
  concatMap(item => processWork(item).stream$)
);
```

### Shared Replay with Cleanup
```typescript
import { shareReplayUntil } from '@dereekb/rxjs';

@Component({...})
export class MyComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // Expensive operation shared across subscriptions
  readonly sharedData$ = this.expensiveOperation$.pipe(
    shareReplayUntil(this.destroy$)
  );

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### Filtering Null Values
```typescript
import { filterMaybe } from '@dereekb/rxjs';

// Remove null/undefined from stream
const validUsers$ = users$.pipe(
  filterMaybe() // Type changes from Maybe<User> to User
);
```

## Best Practices

### DO:
- **Use LoadingState** for all async operations in UI components
- **Provide FilterMap** at component level for filter isolation
- **Use shareReplayUntil** instead of shareReplay to prevent memory leaks
- **Use filterMaybe** to safely filter out null/undefined
- **Manage subscriptions** with SubscriptionObject or takeUntil
- **Use observableLock** to prevent race conditions in critical operations

### DON'T:
- **Don't use shareReplay without cleanup** - Use shareReplayUntil instead
- **Don't manually track loading/error states** - Use LoadingState pattern
- **Don't create multiple FilterMaps** for the same component (use one instance)
- **Don't forget to unsubscribe** - Always clean up subscriptions
- **Don't ignore errors** in LoadingState - Always handle error states

### Performance:
- Use `shareReplayUntil` for expensive Observables accessed by multiple subscribers
- FilterMap automatically deduplicates filter updates
- LoadingStateContext provides optimized streams for common loading patterns
- Work instances support cancellation for better resource management

## Integration with Other Packages

### @dereekb/dbx-core
```typescript
// DBX components use LoadingState extensively
import { LoadingState } from '@dereekb/rxjs';
import { DbxActionComponent } from '@dereekb/dbx-core';

// Actions return LoadingState
action.trigger$.subscribe((state: LoadingState) => {
  // Handle loading/success/error
});
```

### @dereekb/firebase
```typescript
// Firebase observables work seamlessly with LoadingState
import { loadingStateFromObs } from '@dereekb/rxjs';
import { firestoreDocument } from '@dereekb/firebase';

const docState$ = loadingStateFromObs(
  firestoreDocument(docRef).stream()
);
```

### @dereekb/dbx-web
```typescript
// Web components use FilterMap for lists
import { FilterMap } from '@dereekb/rxjs';
import { DbxListComponent } from '@dereekb/dbx-web';

// Lists integrate with FilterMap
@Component({
  providers: [FilterMap]
})
export class MyList extends DbxListComponent {
  // FilterMap automatically used by parent
}
```

## Related Packages

### Direct Dependencies:
- **[@dereekb/util](../../../packages/util/)** - Pure utilities (promise, array, object)
  - Use @dereekb/util for non-reactive operations
  - Use @dereekb/rxjs for reactive/Observable patterns

### Packages that Depend on @dereekb/rxjs:
- **[@dereekb/dbx-core](../../../packages/dbx-core/)** - Angular utilities (uses LoadingState, FilterMap)
- **[@dereekb/firebase](../../../packages/firebase/)** - Firebase utilities (returns LoadingState)
- **[@dereekb/dbx-web](../../../packages/dbx-web/)** - Web components (uses FilterMap)

### When to Use Other Packages:
- **Need Promise utilities?** → Use @dereekb/util (promise module)
- **Need Angular-specific reactive patterns?** → Use @dereekb/dbx-core (builds on rxjs)
- **Need Firebase reactive queries?** → Use @dereekb/firebase (uses LoadingState)

## Quick Module Finder

**I need to...**
- Track loading/error states → `loading` module (see [dereekb-rxjs-loading](../dereekb-rxjs-loading/SKILL.md))
- Manage filter state → `filter` module (FilterMap)
- Process work queues → `work` module
- Custom RxJS operators → `rxjs` module
- Iterate over observables → `iterator` module
- Manage subscriptions → `subscription` module
- Prevent race conditions → `lock` module
- Transform object maps → `object` module

## Additional Resources

- **Detailed LoadingState Guide:** [.agent/skills/dereekb-rxjs-loading/SKILL.md](../dereekb-rxjs-loading/SKILL.md)
- **Package Catalog:** [.agent/PACKAGES.md](../../PACKAGES.md)
- **Source Code:** [packages/rxjs/src/lib/](../../../packages/rxjs/src/lib/)
- **Changelog:** [packages/rxjs/CHANGELOG.md](../../../packages/rxjs/CHANGELOG.md)

## Package Stats

- **Modules:** 8 top-level modules
- **Dependencies:** rxjs (peer), @dereekb/util
- **Used By:** @dereekb/dbx-core, @dereekb/firebase, @dereekb/dbx-web, @dereekb/dbx-firebase
- **Key Pattern:** LoadingState (used throughout entire ecosystem)
