# @dereekb/rxjs LoadingState & LoadingStateContext

Guide for working with LoadingState and LoadingStateContext from the `@dereekb/rxjs` package - a reactive state management pattern for handling asynchronous operations with RxJS.

## Overview

LoadingState is a generic pattern used throughout @dereekb packages (@dereekb/dbx-core, @dereekb/dbx-web, @dereekb/dbx-firebase, etc.) to propagate the current state of an action or data loading operation. It provides a structured way to represent loading states, values, errors, and progress in RxJS observables.

**Key Concepts:**
- **LoadingState**: A value/error pair that represents the current state of an async operation
- **LoadingStateContext**: An observable context providing multiple streams and accessors to a LoadingState
- **ListLoadingStateContext**: A specialized context for working with list/array data

## Core LoadingState Interface

### LoadingState Structure

```typescript
interface LoadingState<T = unknown> {
  readonly loading?: Maybe<boolean>;      // Whether currently loading
  readonly loadingProgress?: Maybe<LoadingProgress>;  // Optional progress indicator
  readonly error?: Maybe<ReadableError>;  // Error if one occurred
  readonly value?: Maybe<T>;              // The loaded value
}
```

### LoadingState Types

LoadingState can be in one of four states, determined by `loadingStateType()`:

1. **IDLE** - Not loading, no value or error
   ```typescript
   { loading: false }
   ```

2. **LOADING** - Currently loading
   ```typescript
   { loading: true }
   ```

3. **SUCCESS** - Finished loading with a value
   ```typescript
   { loading: false, value: data }
   ```

4. **ERROR** - Finished loading with an error
   ```typescript
   { loading: false, error: readableError }
   ```

### LoadingState Variants

```typescript
// Generic loading state
LoadingState<T>

// Loading state with array value
ListLoadingState<T> = LoadingState<T[]>

// Loading state with guaranteed value
LoadingStateWithValue<T> = LoadingState<T> & { readonly value: Maybe<T> }

// Loading state with non-nullable value
LoadingStateWithDefinedValue<T> = LoadingState<T> & { readonly value: T }

// Loading state with error
LoadingStateWithError<T> = LoadingState<T> & { readonly error: ReadableError }

// Loading state with pagination
PageLoadingState<T> extends LoadingState<T>, Page {
  readonly hasNextPage?: Maybe<boolean>;
}

// Filtered page loading state
FilteredPageLoadingState<T, F> extends PageLoadingState<T>, FilteredPage<F>
```

## Creating LoadingStates

### Factory Functions

```typescript
import {
  idleLoadingState,
  beginLoading,
  successResult,
  errorResult
} from '@dereekb/rxjs';

// Create idle state
const idle = idleLoadingState<MyType>();  // { loading: false }

// Start loading
const loading = beginLoading<MyType>();   // { loading: true }

// Success with value
const success = successResult(data);      // { loading: false, value: data }

// Error state
const error = errorResult<MyType>(err);   // { loading: false, error: readableError }
```

### From Observable

```typescript
import { loadingStateFromObs } from '@dereekb/rxjs';

// Wraps an observable to emit LoadingState
const state$ = loadingStateFromObs(myObservable$);
// Emits: { loading: true } → { loading: false, value: result }

// Take only first value
const state$ = loadingStateFromObs(myObservable$, true);
```

## LoadingState Helper Functions

### State Type Checking

```typescript
import {
  loadingStateType,
  isLoadingStateInIdleState,
  isLoadingStateLoading,
  isLoadingStateInSuccessState,
  isLoadingStateInErrorState,
  isLoadingStateFinishedLoading,
  isLoadingStateWithDefinedValue,
  isLoadingStateWithError
} from '@dereekb/rxjs';

// Get the state type
const type = loadingStateType(state);  // Returns LoadingStateType enum

// Check state type
if (isLoadingStateLoading(state)) {
  // Currently loading
}

if (isLoadingStateInSuccessState(state)) {
  // Has successfully loaded value
}

if (isLoadingStateFinishedLoading(state)) {
  // Not loading anymore (may have value or error)
}

// Type guards
if (isLoadingStateWithDefinedValue(state)) {
  // state.value is guaranteed to be defined
  const value: T = state.value;
}

if (isLoadingStateWithError(state)) {
  // state.error is guaranteed to be defined
  const error: ReadableError = state.error;
}
```

### Merging LoadingStates

```typescript
import { mergeLoadingStates } from '@dereekb/rxjs';

// Merge 2-5 loading states
const merged = mergeLoadingStates(stateA, stateB);
// Returns LoadingState<A & B>

// With custom merge function
const merged = mergeLoadingStates(
  stateA,
  stateB,
  (a, b) => ({ combined: a.value + b.value })
);

// Behavior:
// - If any is loading → returns loading
// - If any has error → returns first error
// - If all succeeded → merges values
```

### Updating LoadingStates

```typescript
import {
  mergeLoadingStateWithLoading,
  mergeLoadingStateWithValue,
  mergeLoadingStateWithError
} from '@dereekb/rxjs';

// Set to loading
const loading = mergeLoadingStateWithLoading(state);
// { ...state, loading: true, value: undefined, error: undefined }

// Set value (marks as success)
const success = mergeLoadingStateWithValue(state, newValue);
// { ...state, loading: false, value: newValue, error: undefined }

// Set error
const error = mergeLoadingStateWithError(state, errorObj);
// { ...state, loading: false, error: errorObj }
```

### Mapping LoadingStates

```typescript
import { mapLoadingStateResults } from '@dereekb/rxjs';

// Map the value when available
const mapped = mapLoadingStateResults(state, {
  mapValue: (value, state) => transformValue(value)
});

// Custom state mapping
const mapped = mapLoadingStateResults(state, {
  mapValue: (value) => value.id,
  mapState: (input, mappedValue) => ({
    ...input,
    value: mappedValue,
    customField: 'something'
  })
});
```

## LoadingStateContext

LoadingStateContext wraps an observable LoadingState stream and provides convenient accessors for different aspects of the state.

### Creating a LoadingStateContext

```typescript
import { loadingStateContext } from '@dereekb/rxjs';

// From an observable
const context = loadingStateContext({
  obs: myLoadingState$
});

// With configuration
const context = loadingStateContext({
  obs: myLoadingState$,
  showLoadingOnUndefinedValue: true  // Show loading if value is undefined
});

// Shorthand
const context = loadingStateContext(myLoadingState$);
```

### LoadingStateContext Properties

```typescript
interface LoadingStateContext<T> {
  // The event stream (combines loading state with metadata)
  readonly stream$: Observable<LoadingStateContextEvent>;

  // Observable streams for the state
  readonly currentStateStream$: Observable<Maybe<Observable<Maybe<S>>>>;
  readonly stateStream$: Observable<Observable<Maybe<S>>>;
  readonly currentState$: Observable<Maybe<S>>;
  readonly state$: Observable<S>;  // Latest non-null state

  // Loading status
  readonly loading$: Observable<boolean>;

  // Value accessors
  readonly currentValue$: Observable<Maybe<T>>;         // Always emits, even while loading
  readonly valueAfterLoaded$: Observable<Maybe<T>>;     // Only emits after loading finishes
  readonly value$: Observable<T>;                       // Latest non-null value
}

// Mutable version
interface MutableLoadingStateContext<T> extends LoadingStateContext<T> {
  setStateObs(obs: Maybe<Observable<Maybe<S>>>): void;
  destroy(): void;
}
```

### Usage Example

```typescript
import { Component } from '@angular/core';
import { loadingStateContext } from '@dereekb/rxjs';

@Component({
  selector: 'my-component',
  template: `
    <div *ngIf="context.loading$ | async">Loading...</div>
    <div *ngIf="context.stream$ | async as state">
      <div *ngIf="state.error">Error: {{ state.error.message }}</div>
      <div *ngIf="state.value">{{ state.value.name }}</div>
    </div>
  `
})
export class MyComponent {
  readonly context = loadingStateContext({
    obs: this.dataStore.dataLoadingState$
  });

  // Access different streams
  readonly isLoading$ = this.context.loading$;
  readonly currentValue$ = this.context.currentValue$;
  readonly finalValue$ = this.context.value$;
}
```

## RxJS Operators

### Combining LoadingStates

```typescript
import { combineLoadingStates } from '@dereekb/rxjs';

// Combine multiple observable loading states
const combined$ = combineLoadingStates(stateA$, stateB$);

// With merge function
const combined$ = combineLoadingStates(
  stateA$,
  stateB$,
  (a, b) => ({ merged: a + b })
);

// Combine status only (for progress tracking)
import { combineLoadingStatesStatus } from '@dereekb/rxjs';
const status$ = combineLoadingStatesStatus([state1$, state2$, state3$]);
// Emits LoadingState<boolean> - only changes when overall status changes
```

### Starting with Loading

```typescript
import { startWithBeginLoading } from '@dereekb/rxjs';

const state$ = myObservable$.pipe(
  startWithBeginLoading()  // Start with { loading: true }
);
```

### Value Extraction

```typescript
import {
  currentValueFromLoadingState,
  valueFromLoadingState,
  valueFromFinishedLoadingState,
  errorFromLoadingState
} from '@dereekb/rxjs';

// Get current value (emits undefined while loading)
const currentValue$ = state$.pipe(
  currentValueFromLoadingState()
);

// Get only non-null values
const value$ = state$.pipe(
  valueFromLoadingState()
);

// Get value only after loading finishes
const finalValue$ = state$.pipe(
  valueFromFinishedLoadingState()
);

// With default value if undefined
const valueOrDefault$ = state$.pipe(
  valueFromFinishedLoadingState(() => defaultValue)
);

// Extract errors
const error$ = state$.pipe(
  errorFromLoadingState()
);
```

### Mapping Values

```typescript
import {
  mapLoadingState,
  mapLoadingStateValueWithOperator
} from '@dereekb/rxjs';

// Map the value
const mapped$ = state$.pipe(
  mapLoadingState({
    mapValue: (value) => value.id
  })
);

// Map with custom state transformation
const mapped$ = state$.pipe(
  mapLoadingState({
    mapValue: (value) => value.id,
    mapState: (input, mappedValue) => ({
      ...input,
      value: mappedValue,
      extraData: 'something'
    })
  })
);

// Map using an operator (for async transformations)
const mapped$ = state$.pipe(
  mapLoadingStateValueWithOperator(
    switchMap(value => transformAsync(value))
  )
);
```

### Tap on State Changes

```typescript
import {
  tapOnLoadingStateType,
  tapOnLoadingStateSuccess
} from '@dereekb/rxjs';

// Execute function on specific state type
const state$ = loadingState$.pipe(
  tapOnLoadingStateType((state) => {
    console.log('Loading!', state);
  }, LoadingStateType.LOADING),
  tapOnLoadingStateType((state) => {
    console.log('Error!', state.error);
  }, LoadingStateType.ERROR)
);

// Convenience for success state
const state$ = loadingState$.pipe(
  tapOnLoadingStateSuccess((state) => {
    console.log('Success!', state.value);
  })
);
```

### Distinct Loading States

```typescript
import { distinctLoadingState } from '@dereekb/rxjs';

// Only emit when value or metadata changes
const distinct$ = state$.pipe(
  distinctLoadingState((a, b) => a?.id === b?.id)
);

// Advanced configuration
const distinct$ = state$.pipe(
  distinctLoadingState({
    valueComparator: (a, b) => a?.id === b?.id,
    compareOnUndefinedValue: true,
    passRetainedValue: (value, previous) => value !== null
  })
);
```

### Error Handling

```typescript
import {
  throwErrorFromLoadingStateError,
  catchLoadingStateErrorWithOperator
} from '@dereekb/rxjs';

// Throw error if loading state has error
const state$ = loadingState$.pipe(
  throwErrorFromLoadingStateError()
);

// Catch and transform error states
const state$ = loadingState$.pipe(
  catchLoadingStateErrorWithOperator(
    map(errorState => ({
      ...errorState,
      error: transformError(errorState.error)
    }))
  )
);
```

### Promise Conversion

```typescript
import { promiseFromLoadingState } from '@dereekb/rxjs';

// Convert observable loading state to promise
const value = await promiseFromLoadingState(state$);
// Resolves when loading finishes with value
// Rejects if error occurs
```

## Common Patterns

### Pattern: Data Store with LoadingStateContext

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { loadingStateContext, LoadingState } from '@dereekb/rxjs';

@Injectable()
export class DataStore {
  private _state$ = new BehaviorSubject<LoadingState<MyData>>(beginLoading());
  readonly state$ = this._state$.asObservable();
  readonly context = loadingStateContext({ obs: this.state$ });

  loadData() {
    this._state$.next(beginLoading());
    this.apiService.fetchData().subscribe({
      next: data => this._state$.next(successResult(data)),
      error: err => this._state$.next(errorResult(err))
    });
  }
}
```

### Pattern: Combining Multiple Data Sources

```typescript
import { Component } from '@angular/core';
import {
  combineLoadingStates,
  loadingStateContext
} from '@dereekb/rxjs';

@Component({ /* ... */ })
export class CombinedDataComponent {
  readonly combinedState$ = combineLoadingStates(
    this.userStore.userState$,
    this.settingsStore.settingsState$,
    (user, settings) => ({
      user,
      settings,
      displayName: `${user.name} (${settings.theme})`
    })
  );

  readonly context = loadingStateContext({
    obs: this.combinedState$
  });
}
```

## Best Practices

1. **Use LoadingStateContext for components** - Provides convenient streams for templates
2. **Prefer operators over manual mapping** - Use built-in operators like `mapLoadingState`
3. **Use type guards** - Check state with `isLoadingStateWithDefinedValue` for type safety
4. **Handle all states in templates** - Show loading, error, and success states
5. **Combine states efficiently** - Use `combineLoadingStates` rather than manual combination
6. **Use ListLoadingStateContext for arrays** - Provides empty state detection automatically
7. **Clean up contexts** - Call `destroy()` on mutable contexts when done

## Related Files

- [loading.state.ts](../../../packages/rxjs/src/lib/loading/loading.state.ts) - Core LoadingState types and utilities
- [loading.context.state.ts](../../../packages/rxjs/src/lib/loading/loading.context.state.ts) - LoadingStateContext implementation
- [loading.context.state.list.ts](../../../packages/rxjs/src/lib/loading/loading.context.state.list.ts) - ListLoadingStateContext implementation
- [loading.state.rxjs.ts](../../../packages/rxjs/src/lib/loading/loading.state.rxjs.ts) - RxJS operators for LoadingState
