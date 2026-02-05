---
name: DBX Core Actions
description: Core action system guide - reactive state machine from @dereekb/dbx-core
triggers:
  - dbxAction
  - action system
  - action state machine
  - action context
  - ActionContextStore
  - action handler
  - reactive actions
  - dbx action core
---

# DBX Core Actions

A comprehensive guide to the **dbxAction** reactive state machine system from `@dereekb/dbx-core`.

## Table of Contents

1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Quick Reference](#quick-reference)
4. [Directive Reference](#directive-reference)
5. [Examples](#examples)
6. [Best Practices](#best-practices)

---

## Introduction

### What is dbxAction?

**dbxAction** is a reactive state machine system for managing asynchronous operations in Angular applications. It provides a declarative, composable way to handle user actions, form submissions, API calls, and other async workflows directly in your templates.

Instead of manually managing loading states, error handling, and disabled logic in component TypeScript, dbxAction lets you compose directives that handle these concerns automatically.

### Philosophy

dbxAction is built on three core principles:

1. **Declarative**: Define behavior in your template, not imperative code
2. **Composable**: Stack directives to build complex interactions from simple pieces
3. **Reactive**: Built on RxJS observables for seamless integration with Angular's change detection

### Key Benefits

- **Type-safe**: Full TypeScript support with generics for input/output types
- **Reduces boilerplate**: Eliminate repetitive loading/error state management
- **Testable**: Test handler functions independently from UI
- **Consistent error handling**: Standard patterns across your application
- **Auto cleanup**: No manual subscription management needed
- **Flexible composition**: Mix and match directives for any workflow

### Quick Example

Here's a minimal action that calls an API and shows feedback:

```html
<div dbxAction [dbxActionHandler]="saveData">
  <dbx-button dbxActionButton text="Save"></dbx-button>
  <p *dbxActionIsWorking>Saving...</p>
  <p *dbxActionHasSuccess>Saved successfully!</p>
  <dbx-error dbxActionError></dbx-error>
</div>
```

```typescript
readonly saveData: WorkUsingObservable = () => {
  return this.api.save().pipe(delay(1000));
};
```

That's it! The button automatically disables while working, shows loading state, displays success message, and handles errors - all declaratively.

### Package Location

- **Core directives**: `@dereekb/dbx-core/action`
- **Additional UI directives**: See [dbx-web-actions](/skills/dbx-web-actions) skill
- **Form integration**: See [dbx-form-actions](/skills/dbx-form-actions) skill

---

## Core Concepts

### Action State Machine

At the heart of dbxAction is a state machine with **7 states**:

```
IDLE ──trigger()──> TRIGGERED ──readyValue()──> VALUE_READY ──startWorking()──> WORKING
  ↑                                                                                 ↓
  |                                                                    resolve() / reject()
  |                                                                                 ↓
  └────────────────────────────────────────────────────────────────── RESOLVED / REJECTED

DISABLED (special idle state when action is disabled)
```

#### State Descriptions

| State | Description |
|-------|-------------|
| **IDLE** | No action in progress. Waiting for trigger. |
| **DISABLED** | Special idle state when action is disabled (cannot be triggered). |
| **TRIGGERED** | Action was triggered, waiting for value to be provided. |
| **VALUE_READY** | Value is ready and action should begin working. |
| **WORKING** | Action is actively executing (async operation in progress). |
| **RESOLVED** | Action completed successfully. Returns to IDLE after. |
| **REJECTED** | Action encountered an error. Returns to IDLE after. |

#### State Transitions

- **trigger()**: IDLE → TRIGGERED
- **readyValue(value)**: TRIGGERED → VALUE_READY
- **startWorking()**: VALUE_READY → WORKING
- **resolve(result)**: WORKING → RESOLVED → IDLE
- **reject(error)**: WORKING → REJECTED → IDLE
- **disable()**: Any idle state → DISABLED
- **enable()**: DISABLED → IDLE

### ActionContextStore

The **ActionContextStore** is an Ngrx ComponentStore that manages the action's state. It's the reactive core of the system.

#### Key Features

- **Immutable state management**: State transitions are predictable and traceable
- **RxJS observables**: 15+ reactive streams for different aspects of state
- **LockSet integration**: Prevents premature destruction during async operations
- **Type parameters**: `ActionContextStore<T, O>` where:
  - `T`: Input value type (what goes into the action)
  - `O`: Output result type (what comes out of success)

#### Key Observable Streams

| Stream | Type | Purpose |
|--------|------|---------|
| `state$` | `Observable<ActionContextState>` | Complete state object |
| `actionState$` | `Observable<DbxActionState>` | Current state enum value |
| `triggered$` | `Observable<true>` | Emits when action is triggered |
| `valueReady$` | `Observable<T>` | Emits the ready value for processing |
| `working$` | `Observable<true>` | Emits when action starts working |
| `isWorking$` | `Observable<boolean>` | True while action is executing |
| `workProgress$` | `Observable<number>` | Progress percentage (0-100) |
| `success$` | `Observable<O>` | Emits result on success |
| `successPair$` | `Observable<{value, result}>` | Emits both input and output |
| `rejected$` | `Observable<ReadableError>` | Emits error on rejection |
| `error$` | `Observable<ReadableError>` | Current error (if any) |
| `idle$` | `Observable<boolean>` | True when not succeeded yet |
| `isSuccess$` | `Observable<boolean>` | True after successful resolution |
| `isModified$` | `Observable<boolean>` | True when marked as modified |
| `canTrigger$` | `Observable<boolean>` | True when action can be triggered |
| `isModifiedAndCanTrigger$` | `Observable<boolean>` | Combined check for both conditions |
| `loadingState$` | `Observable<LoadingState<O>>` | Loading state with progress |
| `loadingStateType$` | `Observable<LoadingStateType>` | IDLE/LOADING/SUCCESS/ERROR |

### Directive Composition Pattern

Actions are built by composing multiple directives on the same container or child elements:

```html
<div dbxAction                          <!-- 1. Context provider -->
     [dbxActionHandler]="saveUser"      <!-- 2. Handler function -->
     dbxActionEnforceModified>          <!-- 3. State modifier -->

  <form dbxActionForm>                  <!-- 4. Value provider -->
    <!-- form fields -->
  </form>

  <dbx-button dbxActionButton>          <!-- 5. Trigger -->
    Save
  </dbx-button>

  <p *dbxActionIsWorking>Saving...</p>  <!-- 6. Conditional display -->
  <dbx-error dbxActionError>            <!-- 7. Error display -->
  </dbx-error>
</div>
```

Each directive plays a specific role:
1. **Context**: Provides the ActionContextStore
2. **Handler**: Defines what happens when action executes
3. **State Modifiers**: Control when action can trigger
4. **Value Providers**: Supply input data
5. **Triggers**: Initiate the action
6. **Conditional Display**: Show/hide based on state
7. **Feedback**: Display results or errors

### Type Parameters

Actions are generic over two types:

```typescript
DbxActionContextStoreSourceInstance<T, O>
```

- **T**: Input value type (e.g., form data, user selection)
- **O**: Output result type (e.g., API response, saved entity)

Example:
```typescript
// Action that takes UserFormData and returns User
DbxActionDirective<UserFormData, User>

// Handler function signature
WorkUsingObservable<UserFormData, User>
```

---

## Quick Reference

### Directive Directory

Directives organized by purpose for quick lookup:

#### Context & Source
- **`dbxAction`** / **`[dbxAction]`**: Root context provider, creates ActionContextStore
- **`[dbxActionSource]`**: Provides external ActionContextStore to children

#### Handlers
- **`[dbxActionHandler]`**: Executes Work function on valueReady$ (primary handler)
- **`[dbxActionHandlerValue]`**: Returns static value or getter as result
- **`[dbxActionSuccessHandler]`**: Callback function executed on success
- **`[dbxActionErrorHandler]`**: Callback function executed on error

#### Value Providers
- **`dbxActionValue`** / **`[dbxActionValue]`**: Provides static value when triggered
- **`[dbxActionValueStream]`**: Watches Observable and provides current value
- **`[dbxActionValueGetter]`**: Calls function to get value on trigger
- **`dbxActionForm`** (from dbx-form): Binds form as value source

#### Triggers & Buttons
- **`dbxActionButton`** (from dbx-web): Links button to action, handles disabled/working states
- **`dbxActionButtonTrigger`** (from dbx-web): Button that only triggers, ignores working

#### State Modifiers
- **`[dbxActionDisabled]`**: Disables action based on boolean input
- **`[dbxActionDisabledOnSuccess]`**: Auto-disables after success
- **`dbxActionEnforceModified`**: Disables unless marked as modified
- **`dbxActionAutoModify`**: Automatically marks as modified
- **`dbxActionAutoTrigger`**: Auto-triggers when modified (with debounce/throttle)
- **`[dbxActionMapWorkingDisable]`**: Disables if any action in map is working

#### Structural Directives (Conditional Display)
- **`*dbxActionIdle`**: Shows content before success
- **`*dbxActionIsWorking`**: Shows content while working
- **`*dbxActionTriggered`**: Shows content when triggered
- **`*dbxActionHasSuccess`**: Shows content after success
- **`*dbxActionPreSuccess`**: Shows content before success

#### UI Integration (from dbx-web/dbx-form)
- **`dbxActionError`**: Links DbxErrorComponent to error stream
- **`dbxActionSnackbar`**: Shows snackbar feedback on state changes
- **`dbxActionSnackbarError`**: Shows errors in snackbar
- **`[dbxActionConfirm]`**: Adds confirmation dialog before action
- **`[dbxActionDialog]`**: Opens dialog to get value
- **`[dbxActionPopover]`**: Opens popover to get value

#### Multi-Action / Map
- **`[dbxActionContextMap]`**: Provides map of keyed action contexts
- **`[dbxActionFromMap]`**: Retrieves action from map by key
- **`[dbxActionMapSource]`**: Registers action in map with key
- **`[dbxActionMapWorkingDisable]`**: Disables when any map action is working

#### Advanced
- **`[dbxActionAnalytics]`**: Connects analytics to action lifecycle
- **`[dbxActionLogger]`**: Logs state changes to console (debugging)
- **`dbxActionTransitionSafety`**: Prevents navigation with unsaved changes

### Common Patterns Cheatsheet

**Simple button action:**
```html
<div dbxAction [dbxActionHandler]="save">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

**Form submission:**
```html
<div dbxAction [dbxActionHandler]="submit" dbxActionEnforceModified>
  <my-form dbxActionForm></my-form>
  <dbx-button dbxActionButton text="Submit"></dbx-button>
</div>
```

**Confirm before action:**
```html
<div dbxAction [dbxActionConfirm]="confirmConfig" [dbxActionHandler]="delete">
  <dbx-button dbxActionButton text="Delete"></dbx-button>
</div>
```

**Auto-save:**
```html
<div dbxAction [dbxActionHandler]="autoSave" dbxActionAutoTrigger>
  <form dbxActionForm></form>
</div>
```

---

## Directive Reference

### Context & Source Directives

#### `dbxAction` / `[dbxAction]`

**Purpose**: Creates and provides the root ActionContextStore for all child directives.

**Selectors**: `dbx-action`, `[dbxAction]`, `dbx-action-context`, `[dbxActionContext]`

**Export As**: `action`, `dbxAction`

**Type Parameters**: `<T, O>` - Input value type and output result type

**Usage Notes**:
- Must be an ancestor of all other action directives
- Can be applied as element or attribute
- Automatically cleans up on destroy (waits for actions to complete)
- Creates its own ActionContextStore instance

**Example**:
```html
<div dbxAction [dbxActionHandler]="saveUser">
  <!-- action directives go here -->
</div>
```

```typescript
export class MyComponent {
  readonly saveUser: WorkUsingObservable<User> = (user) => {
    return this.api.saveUser(user);
  };
}
```

---

#### `[dbxActionSource]`

**Purpose**: Provides an external ActionContextStore to child directives instead of creating a new one.

**Selector**: `[dbxActionSource]`

**Input**: `dbxActionSource: Maybe<ActionContextStoreSource>`

**Usage Notes**:
- Use when you want to share an ActionContextStore between components
- Watches for source changes (reactive to input changes)
- Useful for complex action orchestration

**Example**:
```html
<div [dbxActionSource]="externalActionSource">
  <!-- directives use external source -->
</div>
```

```typescript
export class MyComponent {
  readonly externalActionSource = new DbxActionContextMachine({...});
}
```

---

### Handler Directives

#### `[dbxActionHandler]`

**Purpose**: The primary handler directive. Executes a Work function when `valueReady$` fires.

**Selector**: `[dbxActionHandler]`

**Input**: `dbxActionHandler: Maybe<Work<T, O>>`

**Type**:
```typescript
Work<T, O> = WorkUsingObservable<T, O> | WorkUsingContext<T, O>

WorkUsingObservable<T, O> = (value: T) => Observable<O>
WorkUsingContext<T, O> = (value: T, context: ActionContext<T, O>) => void
```

**Usage Notes**:
- Must be used with a value provider (dbxActionValue, dbxActionForm, etc.)
- Observable-based handler: Return Observable that resolves/rejects
- Context-based handler: Call `context.resolve()` or `context.reject()` manually
- Handler locks the action source during execution (prevents premature destroy)

**Example (Observable-based)**:
```html
<div dbxAction [dbxActionHandler]="saveData" dbxActionValue>
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

```typescript
readonly saveData: WorkUsingObservable = () => {
  return this.api.save().pipe(
    delay(1000),
    map(response => response.data)
  );
};
```

**Example (Context-based)**:
```typescript
readonly saveData: WorkUsingContext = (value, context) => {
  this.api.save(value).subscribe({
    next: (result) => context.resolve(result),
    error: (error) => context.reject(error)
  });
};
```

---

#### `[dbxActionHandlerValue]`

**Purpose**: Returns a static value or calls a getter function as the action result (instead of async work).

**Selector**: `[dbxActionHandlerValue]`

**Input**: `dbxActionHandlerValue: Maybe<GetterOrValue<O> | FactoryWithInput<O, T>>`

**Usage Notes**:
- Use for synchronous actions that don't need async processing
- Can provide static value, getter function, or factory function
- Immediately resolves with the provided/computed value

**Example**:
```html
<div dbxAction [dbxActionHandlerValue]="selectedUser">
  <dbx-button dbxActionButton text="Select"></dbx-button>
</div>
```

```typescript
readonly selectedUser = { id: 123, name: 'John' };
```

---

#### `[dbxActionSuccessHandler]`

**Purpose**: Executes a callback function when the action completes successfully.

**Selector**: `[dbxActionSuccessHandler]`

**Input**: `dbxActionSuccessHandler: Maybe<DbxActionSuccessHandlerFunction<O>>`

**Type**: `(value: O) => void`

**Usage Notes**:
- Subscribes to `success$` stream
- Useful for side effects after success (analytics, notifications)
- Does not affect action flow

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     [dbxActionSuccessHandler]="onSaveSuccess">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

```typescript
readonly save: WorkUsingObservable = () => this.api.save();

onSaveSuccess = (result: SaveResult) => {
  console.log('Saved successfully:', result);
  this.showNotification('Data saved!');
};
```

---

#### `[dbxActionErrorHandler]`

**Purpose**: Executes a callback function when the action encounters an error.

**Selector**: `[dbxActionErrorHandler]`

**Input**: `dbxActionErrorHandler: Maybe<DbxActionErrorHandlerFunction>`

**Type**: `(error?: Maybe<ReadableError>) => void`

**Usage Notes**:
- Subscribes to `error$` stream
- Filters out null/undefined errors
- Useful for custom error handling logic

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     [dbxActionErrorHandler]="onSaveError">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

```typescript
onSaveError = (error: ReadableError) => {
  console.error('Save failed:', error);
  this.analytics.trackError('save_failed', error);
};
```

---

### Value Provider Directives

#### `dbxActionValue` / `[dbxActionValue]`

**Purpose**: Provides a default static value when the action is triggered.

**Selectors**: `dbxActionValue`, `[dbxActionValue]`

**Input**: `dbxActionValue: Maybe<GetterOrValue<T>>`

**Usage Notes**:
- Simplest value provider for actions that don't need input
- Can provide static value or getter function
- Called once when action is triggered
- Use when handler doesn't need input (just trigger an API call)

**Example (no input needed)**:
```html
<div dbxAction [dbxActionHandler]="refreshData" dbxActionValue>
  <dbx-button dbxActionButton text="Refresh"></dbx-button>
</div>
```

```typescript
readonly refreshData: WorkUsingObservable = () => {
  return this.api.fetchLatest();
};
```

**Example (with static value)**:
```html
<div dbxAction [dbxActionHandler]="delete" [dbxActionValue]="userId">
  <dbx-button dbxActionButton text="Delete User"></dbx-button>
</div>
```

```typescript
readonly userId = 123;

readonly delete: WorkUsingObservable<number> = (id) => {
  return this.api.deleteUser(id);
};
```

---

#### `[dbxActionValueStream]`

**Purpose**: Watches an Observable stream and provides its current value to the action. Also manages modified state.

**Selector**: `[dbxActionValueStream]`

**Inputs**:
- `dbxActionValueStream: Observable<T>` - The value stream to watch
- `dbxActionValueStreamIsEqualValue: Maybe<IsEqualFunction<T>>` - Custom equality check
- `dbxActionValueStreamIsModifiedValue: Maybe<IsModifiedFunction<T>>` - Custom modified check

**Usage Notes**:
- Automatically marks action as modified when value changes
- Provides current stream value when action is triggered
- Uses equality function to determine if value changed
- Useful for reactive form controls or state management

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="saveSettings"
     [dbxActionValueStream]="settings$">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

```typescript
private _settings = new BehaviorSubject<Settings>({...});
readonly settings$ = this._settings.asObservable();

readonly saveSettings: WorkUsingObservable<Settings> = (settings) => {
  return this.api.saveSettings(settings);
};
```

---

#### `[dbxActionValueGetter]`

**Purpose**: Calls a function to get the value when action is triggered (lazy evaluation vs static value).

**Selector**: `[dbxActionValueGetter]`

**Export As**: `dbxActionValueGetter`

**Inputs**:
- `dbxActionValueGetter: Maybe<DbxActionValueGetterValueGetterFunction<T>>` - Function to call
- `dbxActionValueGetterIsModified: Maybe<IsModifiedFunction>` - Modified check
- `dbxActionValueGetterIsEqual: Maybe<IsEqualFunction>` - Equality check

**Type**:
```typescript
DbxActionValueGetterValueGetterFunction<T> =
  () => Observable<DbxActionValueGetterResult<T>>

DbxActionValueGetterResult<T> = {
  value?: T;
  reject?: ReadableError;
}
```

**Usage Notes**:
- Value is fetched only when action triggers (lazy)
- Can return `{ value }` for success or `{ reject }` for error
- Useful when value depends on current component state

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     [dbxActionValueGetter]="getCurrentFormData">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

```typescript
readonly getCurrentFormData = () => {
  const data = this.form.getRawValue();
  if (!this.isValid(data)) {
    return of({ reject: new Error('Form is invalid') });
  }
  return of({ value: data });
};
```

---

### State Management Directives

#### `[dbxActionDisabled]`

**Purpose**: Disables the action based on a boolean input.

**Selector**: `[dbxActionDisabled]`

**Input**: `dbxActionDisabled: boolean | ''`

**Usage Notes**:
- Uses directive-specific disable key: `APP_ACTION_DISABLED_DIRECTIVE_KEY`
- Empty string `''` is treated as false
- Automatically enables on destroy
- Stacks with other disable directives (all must be enabled)

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     [dbxActionDisabled]="!hasPermission">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

```typescript
readonly hasPermission = this.auth.canEdit();
```

---

#### `[dbxActionDisabledOnSuccess]`

**Purpose**: Automatically disables the action after it completes successfully (one-time action).

**Selector**: `[dbxActionDisabledOnSuccess]`

**Input**: `dbxActionDisabledOnSuccess: boolean | ''` (default: true)

**Usage Notes**:
- Uses directive-specific disable key: `APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY`
- Monitors `isSuccess$` stream
- Useful for actions that should only succeed once
- Can be re-enabled programmatically if needed

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="submitOnce"
     dbxActionDisabledOnSuccess>
  <dbx-button dbxActionButton text="Submit"></dbx-button>
</div>
```

---

#### `dbxActionEnforceModified`

**Purpose**: Disables the action unless it is marked as modified.

**Selector**: `dbxActionEnforceModified`, `[dbxActionEnforceModified]`

**Input**: `dbxActionEnforceModified: boolean | ''` (default: true)

**Usage Notes**:
- Uses directive-specific disable key: `APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY`
- Requires `isModified$` to be true for action to be enabled
- Essential for save/submit actions that shouldn't run without changes
- Works with `dbxActionValueStream` and `dbxActionForm` modified tracking

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="saveChanges"
     [dbxActionValueStream]="data$"
     dbxActionEnforceModified>
  <dbx-button dbxActionButton text="Save Changes"></dbx-button>
</div>
```

---

#### `dbxActionAutoModify`

**Purpose**: Automatically marks the action as modified when conditions are met.

**Selector**: `dbxActionAutoModify`, `[dbxActionAutoModify]`

**Input**: `dbxActionAutoModify: string | boolean` (default: true)

**Usage Notes**:
- Watches `isModified$` stream
- Calls `setIsModified(true)` when modified state changes
- Useful with value streams that track their own modifications

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     [dbxActionValueStream]="data$"
     dbxActionAutoModify>
  <!-- Auto marks as modified when data$ changes -->
</div>
```

---

#### `dbxActionAutoTrigger`

**Purpose**: Automatically triggers the action when modified, with configurable debounce/throttle.

**Selector**: `dbxActionAutoTrigger`, `[dbxActionAutoTrigger]`

**Inputs**:
- `dbxActionAutoTrigger: string | boolean` - Enable/disable
- `triggerDebounce: Maybe<number>` - Debounce in ms (default: 2000)
- `triggerThrottle: Maybe<number>` - Throttle in ms (default: 10000)
- `triggerErrorThrottle: number` - Error throttle ms (default: 3000)
- `maxErrorsForThrottle: number` - Max consecutive errors (default: 6)
- `triggerLimit: Maybe<number>` - Max number of triggers
- `useFastTriggerPreset: boolean` - Fast preset (200ms debounce)
- `useInstantTriggerPreset: boolean` - Instant preset (10ms debounce)

**Usage Notes**:
- Monitors `isModifiedAndCanTriggerUpdates$`
- Debounce waits for idle period before triggering
- Throttle prevents triggering more than once per period
- Error-aware: increases delays after consecutive errors
- Prevents over-triggering with intelligent throttling

**Example (auto-save)**:
```html
<div dbxAction
     [dbxActionHandler]="autoSave"
     [dbxActionValueStream]="formData$"
     dbxActionAutoTrigger
     [triggerDebounce]="2000">
  <form><!-- form fields --></form>
  <p *dbxActionIsWorking>Saving...</p>
</div>
```

---

#### `[dbxActionMapWorkingDisable]`

**Purpose**: Disables the action if ANY other action in the parent map is currently working.

**Selector**: `[dbxActionMapWorkingDisable]`

**Input**: `dbxActionMapWorkingDisable: Maybe<DbxActionDisabledKey>`

**Usage Notes**:
- Requires parent `dbxActionContextMap`
- Monitors all sources in the map
- Prevents concurrent operations in a list
- Custom disable key can be provided

**Example**:
```html
<div dbxActionContextMap>
  <div *ngFor="let item of items"
       dbxAction
       [dbxActionMapSource]="item.id"
       [dbxActionHandler]="deleteItem"
       dbxActionMapWorkingDisable>
    <!-- Only one item can be deleted at a time -->
  </div>
</div>
```

---

### Structural Directives (Conditional Display)

#### `*dbxActionIdle`

**Purpose**: Shows content when the action is idle (before success).

**Selector**: `[dbxActionIdle]`

**Input**: `dbxActionIdle: Maybe<number>` - Hide delay in milliseconds

**Usage Notes**:
- Watches `idle$` stream
- Inverse of success state
- Can auto-hide after configured period

**Example**:
```html
<div dbxAction [dbxActionHandler]="save">
  <div *dbxActionIdle>
    <p>Click save to begin</p>
  </div>
</div>
```

---

#### `*dbxActionIsWorking`

**Purpose**: Shows content while the action is in working state.

**Selector**: `[dbxActionWorking]`, `[dbxActionIsWorking]`

**Input**: `dbxActionIsWorking: Maybe<number>` - Hide delay in milliseconds

**Usage Notes**:
- Watches `isWorking$` stream
- Shows during WORKING state
- Can delay hiding after work completes

**Example**:
```html
<div dbxAction [dbxActionHandler]="save">
  <p *dbxActionIsWorking>Saving data...</p>
  <mat-spinner *dbxActionIsWorking></mat-spinner>
</div>
```

---

#### `*dbxActionTriggered`

**Purpose**: Shows content when the action has been triggered.

**Selector**: `[dbxActionTriggered]`

**Input**: `dbxActionTriggered: Maybe<number>` - Hide delay in milliseconds

**Usage Notes**:
- Watches `triggered$` stream
- Shows immediately after trigger
- Can auto-hide after configured period

**Example**:
```html
<div dbxAction [dbxActionHandler]="save">
  <p *dbxActionTriggered>Action triggered!</p>
</div>
```

---

#### `*dbxActionHasSuccess`

**Purpose**: Shows content when the action has successfully completed.

**Selector**: `[dbxActionHasSuccess]`

**Input**: `dbxActionHasSuccess: Maybe<number>` - Hide delay in milliseconds

**Usage Notes**:
- Watches `isSuccess$` stream
- Shows after RESOLVED state
- Can auto-hide success message after delay

**Example**:
```html
<div dbxAction [dbxActionHandler]="save">
  <p *dbxActionHasSuccess="3000">
    Saved successfully! (hides after 3 seconds)
  </p>
</div>
```

---

#### `*dbxActionPreSuccess`

**Purpose**: Shows content before the action has succeeded (opposite of `*dbxActionHasSuccess`).

**Selector**: `[dbxActionPreSuccess]`

**Input**: `dbxActionPreSuccess: Maybe<number>` - Show delay in milliseconds

**Usage Notes**:
- Inverse of `isSuccess$`
- Useful for forms/inputs that should hide after save

**Example**:
```html
<div dbxAction [dbxActionHandler]="save">
  <form *dbxActionPreSuccess>
    <!-- Hide form after success -->
  </form>
</div>
```

---

### Multi-Action / Map Directives

#### `[dbxActionContextMap]`

**Purpose**: Provides a map of action contexts, allowing child elements to access actions by key.

**Selector**: `[dbxActionContextMap]`

**Export As**: `actionMap`

**Usage Notes**:
- Creates `ActionContextStoreSourceMap` service
- Children use `dbxActionFromMap` to access actions by key
- Children use `dbxActionMapSource` to register actions
- Manages lifecycle cleanup of all mapped actions
- Useful for lists where each item has its own action

**Example**:
```html
<div dbxActionContextMap>
  <div *ngFor="let user of users">
    <!-- Each user gets its own action context -->
  </div>
</div>
```

---

#### `[dbxActionFromMap]`

**Purpose**: Retrieves an action from the parent map using a key.

**Selector**: `[dbxActionFromMap]`

**Input**: `dbxActionFromMap: Maybe<ActionKey>` - The key to look up

**Usage Notes**:
- Requires parent `dbxActionContextMap`
- Watches key changes (reactive)
- Provides action source to descendants
- Works with `dbxActionMapSource` to connect actions

**Example**:
```html
<div dbxActionContextMap>
  <div *ngFor="let item of items" [dbxActionFromMap]="item.id">
    <dbx-button dbxActionButton text="Edit"></dbx-button>
  </div>
</div>
```

---

#### `[dbxActionMapSource]`

**Purpose**: Registers an action context in the parent map using a key.

**Selector**: `[dbxActionMapSource]`

**Input**: `dbxActionMapSource: Maybe<ActionKey>` - The key to register under

**Usage Notes**:
- Requires parent `dbxActionContextMap`
- Requires own `dbxAction` context to register
- Watches key changes (re-registers if key changes)
- Removes from map on destroy

**Example**:
```html
<div dbxActionContextMap>
  <div *ngFor="let item of items">
    <div dbxAction
         [dbxActionMapSource]="item.id"
         [dbxActionHandler]="editItem">
      <dbx-button dbxActionButton text="Edit"></dbx-button>
    </div>
  </div>
</div>
```

---

### Advanced Directives

#### `[dbxActionLogger]`

**Purpose**: Logs action state changes to console for debugging.

**Selector**: `[dbxActionLogger]`, `[dbxActionContextLogger]`

**Usage Notes**:
- Subscribes to `state$`
- Outputs each state change to console
- Remove in production (use only for development)

**Example**:
```html
<div dbxAction [dbxActionHandler]="save" dbxActionLogger>
  <!-- All state changes logged to console -->
</div>
```

---

## Examples

### Example 1: Simple Button Action

The most basic action: a button that triggers an API call with feedback.

**Template**:
```html
<div dbxAction [dbxActionHandler]="saveData" dbxActionValue>
  <dbx-button dbxActionButton text="Save"></dbx-button>

  <p *dbxActionIsWorking>Saving data...</p>
  <p *dbxActionHasSuccess="3000">Saved successfully!</p>

  <dbx-error dbxActionError></dbx-error>
</div>
```

**Component**:
```typescript
import { Component } from '@angular/core';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { of, delay } from 'rxjs';

@Component({
  selector: 'app-simple-action',
  templateUrl: './simple-action.component.html',
  standalone: true,
  imports: [
    DbxActionDirective,
    DbxActionHandlerDirective,
    DbxActionValueDirective,
    DbxButtonComponent,
    DbxActionButtonDirective,
    DbxActionIsWorkingDirective,
    DbxActionHasSuccessDirective,
    DbxErrorComponent,
    DbxActionErrorDirective
  ]
})
export class SimpleActionComponent {
  readonly saveData: WorkUsingObservable = () => {
    // Simulate API call
    return of({ success: true }).pipe(delay(1000));
  };
}
```

**What's happening**:
1. `dbxAction` creates the action context
2. `dbxActionHandler` defines what happens when triggered
3. `dbxActionValue` provides empty value (handler doesn't need input)
4. `dbxActionButton` triggers the action and shows loading state
5. `*dbxActionIsWorking` shows loading message
6. `*dbxActionHasSuccess` shows success message (auto-hides after 3s)
7. `dbxActionError` displays any errors

> **Note**: `DbxButtonComponent` and `DbxErrorComponent` are from `@dereekb/dbx-web`. See the [dbx-web-actions](/skills/dbx-web-actions) skill for details.

---

### Example 2: Form-Based Action

A realistic form submission with validation, modified state tracking, and feedback.

**Template**:
```html
<div dbxAction
     [dbxActionHandler]="submitForm"
     dbxActionEnforceModified
     dbxActionSnackbar
     dbxActionSnackbarDefault="save">

  <form dbxActionForm
        [dbxFormSource]="initialValue$"
        [dbxActionFormIsValid]="validateForm">

    <mat-form-field>
      <input matInput
             dbxFormInput="name"
             placeholder="Name"
             required>
    </mat-form-field>

    <mat-form-field>
      <input matInput
             dbxFormInput="email"
             placeholder="Email"
             type="email"
             required>
    </mat-form-field>

    <mat-form-field>
      <mat-select dbxFormInput="role" placeholder="Role" required>
        <mat-option value="user">User</mat-option>
        <mat-option value="admin">Admin</mat-option>
      </mat-select>
    </mat-form-field>
  </form>

  <div class="actions">
    <dbx-button dbxActionButton
                text="Save User"
                color="primary">
    </dbx-button>
    <dbx-error dbxActionError></dbx-error>
  </div>
</div>
```

**Component**:
```typescript
import { Component } from '@angular/core';
import { WorkUsingObservable, IsValidFunction } from '@dereekb/rxjs';
import { of, delay, map } from 'rxjs';

interface UserFormData {
  name: string;
  email: string;
  role: 'user' | 'admin';
}

@Component({
  selector: 'app-form-action',
  templateUrl: './form-action.component.html',
  standalone: true,
  imports: [
    DbxActionDirective,
    DbxActionHandlerDirective,
    DbxActionEnforceModifiedDirective,
    DbxActionSnackbarDirective,
    DbxActionFormDirective,
    DbxFormSourceDirective,
    DbxButtonComponent,
    DbxActionButtonDirective,
    DbxErrorComponent,
    DbxActionErrorDirective,
    // ... Material form imports
  ]
})
export class FormActionComponent {
  readonly initialValue$ = of({
    name: '',
    email: '',
    role: 'user' as const
  });

  readonly validateForm: IsValidFunction<UserFormData> = (value) => {
    // Custom business validation
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email);
    const isNameValid = value.name.length >= 2;

    return of(isEmailValid && isNameValid);
  };

  readonly submitForm: WorkUsingObservable<UserFormData> = (formData) => {
    console.log('Submitting:', formData);

    // Simulate API call
    return of({ id: 123, ...formData }).pipe(
      delay(1500),
      map(user => {
        console.log('User saved:', user);
        return user;
      })
    );
  };
}
```

**What's happening**:
1. `dbxAction` + `dbxActionHandler` sets up the action
2. `dbxActionEnforceModified` prevents submission without changes
3. `dbxActionForm` binds the form as the value source
4. `dbxFormSource` provides initial form values
5. `dbxActionFormIsValid` adds custom validation beyond form validation
6. Form fields use `dbxFormInput` to register in the form
7. `dbxActionButton` triggers when form is valid and modified
8. `dbxActionSnackbar` shows "Saved!" message on success
9. `dbxActionError` displays any errors

> **Note**: `dbxActionForm` is from `@dereekb/dbx-form`. See the [dbx-form-actions](/skills/dbx-form-actions) skill for detailed documentation on form integration, validation options, and modified state tracking.

---

### Example 3: Dialog Integration

Open a dialog to get user input, then process the result.

**Template**:
```html
<div dbxAction
     [dbxActionDialog]="openUserDialog"
     [dbxActionHandler]="processUserSelection"
     dbxActionSnackbar>

  <dbx-button dbxActionButton
              text="Select User"
              icon="person">
  </dbx-button>

  <dbx-error dbxActionError></dbx-error>
</div>
```

**Component**:
```typescript
import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  DbxActionDialogFunction,
  WorkUsingObservable
} from '@dereekb/dbx-web';
import { of, delay, map } from 'rxjs';

interface User {
  id: number;
  name: string;
}

@Component({
  selector: 'app-dialog-action',
  templateUrl: './dialog-action.component.html',
  standalone: true,
  imports: [
    DbxActionDirective,
    DbxActionDialogDirective,
    DbxActionHandlerDirective,
    DbxActionSnackbarDirective,
    DbxButtonComponent,
    DbxActionButtonDirective,
    DbxErrorComponent,
    DbxActionErrorDirective
  ]
})
export class DialogActionComponent {
  readonly matDialog = inject(MatDialog);

  readonly openUserDialog: DbxActionDialogFunction<User> = () => {
    // Open custom dialog component
    return UserSelectionDialogComponent.open(this.matDialog);
  };

  readonly processUserSelection: WorkUsingObservable<User> = (user) => {
    console.log('Selected user:', user);

    // Process the selected user
    return of(user).pipe(
      delay(500),
      map(u => {
        // Perform action with selected user
        return { success: true, user: u };
      })
    );
  };
}
```

**Dialog Component** (simplified):
```typescript
@Component({
  selector: 'app-user-selection-dialog',
  template: `
    <h2 mat-dialog-title>Select a User</h2>
    <mat-dialog-content>
      <mat-selection-list [(ngModel)]="selectedUser">
        <mat-list-option *ngFor="let user of users" [value]="user">
          {{user.name}}
        </mat-list-option>
      </mat-selection-list>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button [mat-dialog-close]="null">Cancel</button>
      <button mat-raised-button
              color="primary"
              [mat-dialog-close]="selectedUser"
              [disabled]="!selectedUser">
        Select
      </button>
    </mat-dialog-actions>
  `
})
export class UserSelectionDialogComponent {
  users: User[] = [...];
  selectedUser: User | null = null;

  static open(dialog: MatDialog): MatDialogRef<UserSelectionDialogComponent, User> {
    return dialog.open(UserSelectionDialogComponent, {
      width: '400px'
    });
  }
}
```

**What's happening**:
1. `dbxActionDialog` opens the dialog when action is triggered
2. Dialog returns selected user (or null if cancelled)
3. If user is selected, `dbxActionHandler` processes it
4. `dbxActionSnackbar` shows success feedback
5. If cancelled (null), action doesn't proceed

> **Note**: `dbxActionDialog` is from `@dereekb/dbx-web`. See the [dbx-web-actions](/skills/dbx-web-actions) skill for details on dialog/popover integration, including `DbxFormActionDialogComponent` for quick form dialogs.

---

## Best Practices

### Common Pitfalls

#### 1. Missing Handler
**Problem**: Action never completes because no handler is provided.

```html
<!-- ❌ BAD: No handler -->
<div dbxAction dbxActionValue>
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

**Solution**: Always provide a handler (or handlerValue).

```html
<!-- ✅ GOOD -->
<div dbxAction [dbxActionHandler]="save" dbxActionValue>
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

#### 2. Missing Value Provider
**Problem**: Handler expects input but no value is provided.

```html
<!-- ❌ BAD: Handler expects User but no value provider -->
<div dbxAction [dbxActionHandler]="saveUser">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

**Solution**: Add a value provider (dbxActionValue, dbxActionForm, etc.).

```html
<!-- ✅ GOOD -->
<div dbxAction [dbxActionHandler]="saveUser" [dbxActionValue]="currentUser">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

#### 3. Forgetting Error Handling
**Problem**: Errors occur but user sees no feedback.

```html
<!-- ❌ BAD: No error display -->
<div dbxAction [dbxActionHandler]="save">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

**Solution**: Always show errors (dbxActionError or dbxActionSnackbarError).

```html
<!-- ✅ GOOD -->
<div dbxAction [dbxActionHandler]="save">
  <dbx-button dbxActionButton text="Save"></dbx-button>
  <dbx-error dbxActionError></dbx-error>
</div>
```

#### 4. Not Understanding Modified State vs Validation
**Problem**: Confusing "modified" (has changes) with "valid" (passes validation).

- **Modified**: Form/value has changed from initial state
- **Valid**: Form/value passes validation rules

Use `dbxActionEnforceModified` to prevent saving when nothing changed.
Use `dbxActionFormIsValid` for business logic validation.

### Performance

#### Actions Clean Up Automatically
- Actions automatically unsubscribe from observables
- LockSet prevents destruction during active operations
- No need for manual subscription management

#### Use Auto-Trigger Carefully
- `dbxActionAutoTrigger` can cause many requests if misconfigured
- Always set appropriate debounce (default: 2000ms)
- Use throttle to prevent rapid-fire requests
- Monitor error count throttling to back off on failures

```html
<!-- ✅ GOOD: Reasonable debounce for auto-save -->
<div dbxAction
     [dbxActionHandler]="autoSave"
     dbxActionAutoTrigger
     [triggerDebounce]="3000">
  <!-- Saves 3 seconds after last change -->
</div>
```

#### Avoid Unnecessary Directive Nesting
- Each directive has overhead
- Don't add directives you're not using

```html
<!-- ❌ BAD: Unnecessary directives -->
<div dbxAction
     [dbxActionHandler]="save"
     dbxActionAutoModify
     dbxActionEnforceModified
     dbxActionDisabledOnSuccess
     dbxActionLogger>
  <!-- Only use what you need -->
</div>
```

### Testing

#### Test Handlers Independently
```typescript
describe('MyComponent', () => {
  it('should save user', (done) => {
    const component = new MyComponent();
    const testUser = { id: 1, name: 'Test' };

    component.saveUser(testUser).subscribe({
      next: (result) => {
        expect(result.success).toBe(true);
        done();
      }
    });
  });
});
```

#### Mock ActionContextStore for Integration Tests
```typescript
const mockActionStore = {
  trigger: jasmine.createSpy('trigger'),
  readyValue: jasmine.createSpy('readyValue'),
  resolve: jasmine.createSpy('resolve'),
  reject: jasmine.createSpy('reject'),
  isWorking$: of(false),
  canTrigger$: of(true),
  // ... other observables
};
```

#### Test Template Directive Composition
```typescript
it('should disable button when action is working', () => {
  const fixture = TestBed.createComponent(MyComponent);
  const button = fixture.nativeElement.querySelector('button');

  // Trigger action
  button.click();
  fixture.detectChanges();

  // Button should be disabled while working
  expect(button.disabled).toBe(true);
});
```

### When NOT to Use Actions

#### Simple Click Handlers
If there's no async operation, just use a regular click handler:

```html
<!-- ❌ OVERKILL: Action not needed -->
<div dbxAction [dbxActionHandlerValue]="true">
  <button dbxActionButton (click)="toggle()">Toggle</button>
</div>

<!-- ✅ BETTER: Simple click -->
<button (click)="toggle()">Toggle</button>
```

#### Component-Internal State Changes
If you're just updating component properties, don't use actions:

```typescript
// ❌ BAD: Action not needed for internal state
readonly toggleView: WorkUsingObservable = () => {
  this.showDetails = !this.showDetails;
  return of(true);
};

// ✅ GOOD: Direct state update
toggleView() {
  this.showDetails = !this.showDetails;
}
```

#### Navigation-Only Operations
For simple navigation, use router directly:

```html
<!-- ❌ OVERKILL -->
<div dbxAction [dbxActionHandler]="navigate">
  <dbx-button dbxActionButton text="Go to Profile"></dbx-button>
</div>

<!-- ✅ BETTER -->
<button routerLink="/profile">Go to Profile</button>
```

### Troubleshooting

#### Action Never Triggers
**Check**:
- Is action disabled? Check `isDisabled$` or disabled directives
- Is it marked modified? Check if `dbxActionEnforceModified` is blocking
- Is there a value provider? Handler might be waiting for value

#### Handler Never Executes
**Check**:
- Is `dbxActionHandler` input set correctly?
- Is value provider triggering `readyValue`?
- Check console for errors in handler function

#### Button Stays Disabled
**Check**:
- Multiple disable directives might be stacking
- Check `canTrigger$` observable
- Ensure form is complete/valid if using `dbxActionForm`

#### Success/Error Not Showing
**Check**:
- Is handler returning an Observable?
- Is Observable completing/erroring correctly?
- Are structural directives imported?

---

## Related Skills

- **[dbx-web-actions](/skills/dbx-web-actions)**: Web interaction directives (buttons, dialogs, snackbars, confirm, analytics)
- **[dbx-form-actions](/skills/dbx-form-actions)**: Form integration with validation and modified state tracking

---

## Summary

The **dbxAction** system provides a powerful, declarative way to manage async operations in Angular:

1. **State Machine**: 7 states (IDLE → TRIGGERED → VALUE_READY → WORKING → RESOLVED/REJECTED)
2. **ActionContextStore**: Reactive Ngrx ComponentStore with 15+ observable streams
3. **Composable Directives**: 25+ directives that stack for complex workflows
4. **Type-Safe**: Generic `<T, O>` for input and output types
5. **Automatic Cleanup**: No manual subscription management

**Key Pattern**: Context → Value → Handler → UI Feedback

Start with simple actions and gradually add complexity through directive composition. Always handle errors and provide user feedback.
