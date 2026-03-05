---
name: DBX Web Actions
description: Web interaction directives for dbxAction from @dereekb/dbx-web
triggers:
  - action button
  - action dialog
  - action popover
  - action snackbar
  - action confirm
  - action error
  - action analytics
  - dbx web actions
---

# DBX Web Actions

Web interaction directives that extend the **dbxAction** system from `@dereekb/dbx-web`.

## Table of Contents

1. [Introduction](#introduction)
2. [Button Directives](#button-directives)
3. [Confirmation & Prompts](#confirmation--prompts)
4. [Error Handling](#error-handling)
5. [Snackbar Feedback](#snackbar-feedback)
6. [Dialog & Popover Integration](#dialog--popover-integration)
7. [Advanced Directives](#advanced-directives)
8. [Examples](#examples)
9. [Best Practices](#best-practices)

---

## Introduction

### Overview

The **dbx-web-actions** directives build upon the core dbxAction system to provide rich UI interactions for web applications. These directives handle common patterns like confirmation dialogs, snackbar notifications, error display, and modal interactions.

### Prerequisites

**Required Knowledge**:
- Understanding of the core dbxAction system → See [dbx-core-actions](/skills/dbx-core-actions)
- Angular Material (for dialogs and snackbars)
- Basic RxJS patterns

You should be familiar with action states, `ActionContextStore`, and basic directive composition before using these directives.

### Package Location

- **Package**: `@dereekb/dbx-web`
- **Directives**: Various locations under `/lib/action/` and `/lib/interaction/`
- **Components**: `DbxButtonComponent`, `DbxErrorComponent`, dialog/popover components

### What's Included

- **Button Integration**: Link buttons to actions with automatic disabled/working states
- **Confirmation Dialogs**: Prompt user before executing actions
- **Error Display**: Show errors inline or in snackbars
- **Snackbar Feedback**: Automatic success/error notifications
- **Dialog/Popover**: Get user input through modals before action executes
- **Analytics**: Track action lifecycle events
- **Advanced**: Keyboard triggers, transition safety, loading contexts

---

## Button Directives

### `dbxActionButton`

**Purpose**: Links a `DbxButtonComponent` to an action context, automatically handling disabled and working states.

**Selector**: `dbxActionButton`, `[dbxActionButton]`

**Host**: Applied to `DbxButtonComponent`

**Key Features**:
- Automatically disables button when action is disabled
- Shows loading spinner while action is working
- Triggers action on button click
- Supports all `DbxButtonComponent` features (text, icon, color, etc.)

**Usage Notes**:
- Must be within a `dbxAction` context
- Button clicks call `source.trigger()`
- Loading state is automatically managed
- Respects action's `canTrigger$` state

**Example**:
```html
<div dbxAction [dbxActionHandler]="save">
  <dbx-button dbxActionButton
              text="Save"
              icon="save"
              color="primary">
  </dbx-button>
</div>
```

**With Multiple Buttons**:
```html
<div dbxAction [dbxActionHandler]="save">
  <dbx-button dbxActionButton text="Save" color="primary"></dbx-button>
  <dbx-button (click)="cancel()" text="Cancel"></dbx-button>
</div>
```

---

### `dbxActionButtonTrigger`

**Purpose**: Links a button to trigger the action but ignores the working state (doesn't show loading).

**Selector**: `dbxActionButtonTrigger`, `[dbxActionButtonTrigger]`

**Host**: Applied to `DbxButtonComponent`

**Key Features**:
- Triggers action on click like `dbxActionButton`
- Does NOT respond to working state (no loading spinner)
- Still respects disabled state
- Useful for cancel/secondary actions

**Usage Notes**:
- Use when you need a button that can trigger during action execution
- Common for cancel buttons or actions that can run concurrently
- Still checks `canTrigger$` before triggering

**Example**:
```html
<div dbxAction [dbxActionHandler]="longRunningTask">
  <dbx-button dbxActionButton text="Start Task"></dbx-button>
  <dbx-button dbxActionButtonTrigger text="Cancel" (click)="cancelTask()"></dbx-button>
</div>
```

**Use Cases**:
- Cancel buttons during long operations
- Secondary actions that don't conflict with primary
- Actions that can run while another is in progress

---

## Confirmation & Prompts

### `dbxActionConfirm`

**Purpose**: Shows a confirmation dialog before executing the action. User must confirm before action proceeds.

**Selector**: `dbxActionConfirm`, `[dbxActionConfirm]`

**Input**: `dbxActionConfirm: DbxActionConfirmConfig<T>`

**Type**:
```typescript
interface DbxActionConfirmConfig<T> {
  title?: string;                    // Dialog title
  prompt?: string | ((value: T) => string);  // Message to display
  confirmText?: string;              // Confirm button text (default: "Confirm")
  cancelText?: string;               // Cancel button text (default: "Cancel")
  passthrough?: boolean;             // Pass value through to handler (default: true)
  rejectOnCancel?: boolean;          // Reject action if cancelled (default: false)
}
```

**Key Features**:
- Intercepts action trigger and shows confirmation dialog
- User must click confirm for action to proceed
- Can reject action if user cancels
- Supports dynamic prompts based on value

**Usage Notes**:
- Extends `AbstractPromptConfirmDirective`
- Works with `DbxPromptService` for dialog display
- Confirmation happens before `readyValue` is called
- If cancelled and `rejectOnCancel: true`, action rejects with cancelled error

**Example (Simple)**:
```html
<div dbxAction
     [dbxActionConfirm]="confirmConfig"
     [dbxActionHandler]="deleteUser">
  <dbx-button dbxActionButton text="Delete User" color="warn"></dbx-button>
</div>
```

```typescript
readonly confirmConfig: DbxActionConfirmConfig = {
  title: 'Delete User',
  prompt: 'Are you sure you want to delete this user? This cannot be undone.',
  confirmText: 'Delete',
  cancelText: 'Cancel'
};

readonly deleteUser: WorkUsingObservable = () => {
  return this.api.deleteUser(this.userId);
};
```

**Example (Dynamic Prompt)**:
```typescript
readonly confirmConfig: DbxActionConfirmConfig<User> = {
  title: 'Delete User',
  prompt: (user) => `Delete ${user.name}? This cannot be undone.`,
  confirmText: 'Delete',
  cancelText: 'Keep',
  rejectOnCancel: true  // Reject action if cancelled
};
```

**Example (Pass-through Value)**:
```html
<div dbxAction
     [dbxActionConfirm]="confirmConfig"
     [dbxActionHandler]="save"
     [dbxActionValue]="userData">
  <!-- Value is passed through to handler after confirmation -->
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

---

## Error Handling

### `dbxActionError`

**Purpose**: Links a `DbxErrorComponent` to the action's error stream for automatic error display.

**Selector**: `dbxActionError`, `[dbxActionError]`

**Host**: Applied to `DbxErrorComponent`

**Key Features**:
- Automatically displays errors from `error$` stream
- Clears error when action succeeds or is reset
- Uses `ReadableError` format for user-friendly messages
- Supports all `DbxErrorComponent` display options

**Usage Notes**:
- Must be within `dbxAction` context
- Subscribes to action's `error$` observable
- Error component handles display formatting
- Can configure `iconOnly` mode on DbxErrorComponent

**Example (Standard)**:
```html
<div dbxAction [dbxActionHandler]="save">
  <dbx-button dbxActionButton text="Save"></dbx-button>
  <dbx-error dbxActionError></dbx-error>
</div>
```

**Example (Icon-Only for Limited Space)**:
```html
<div dbxAction [dbxActionHandler]="save">
  <dbx-button dbxActionButton text="Save"></dbx-button>
  <dbx-error [iconOnly]="true" dbxActionError></dbx-error>
</div>
```

**Example (Styled)**:
```html
<div dbxAction [dbxActionHandler]="save">
  <dbx-button dbxActionButton text="Save"></dbx-button>
  <dbx-error dbxActionError class="error-box"></dbx-error>
</div>
```

---

### `dbxActionSnackbarError`

**Purpose**: Displays action errors in a Material snackbar notification instead of inline.

**Selector**: `dbxActionSnackbarError`, `[dbxActionSnackbarError]`

**Input**: `dbxActionSnackbarError: number | DbxErrorSnackbarConfig` - Duration in ms or config object

**Key Features**:
- Shows errors in snackbar (bottom of screen)
- Configurable duration (default: 5000ms)
- Uses `DbxErrorSnackbarService`
- Converts errors to `ReadableError` format
- Non-blocking (doesn't cover UI)

**Usage Notes**:
- Subscribes to `error$` stream
- Snackbar auto-dismisses after duration
- Can configure position, duration, and styling
- Use instead of `dbxActionError` when inline errors aren't desired

**Example (Simple)**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     dbxActionSnackbarError>
  <!-- Errors show in snackbar, not inline -->
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

**Example (Custom Duration)**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     [dbxActionSnackbarError]="3000">
  <!-- Error snackbar shows for 3 seconds -->
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

**Example (Config Object)**:
```typescript
readonly errorConfig: DbxErrorSnackbarConfig = {
  duration: 8000,
  verticalPosition: 'top',
  horizontalPosition: 'right'
};
```

```html
<div dbxAction
     [dbxActionHandler]="save"
     [dbxActionSnackbarError]="errorConfig">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

---

## Snackbar Feedback

### `dbxActionSnackbar`

**Purpose**: Displays Material snackbar notifications based on action state changes (success, error, etc.).

**Selector**: `dbxActionSnackbar`, `[dbxActionSnackbar]`

**Inputs**:
- `dbxActionSnackbar: boolean | DbxActionSnackbarDisplayConfigGeneratorFunction` - Enable or custom config generator
- `dbxActionSnackbarDefault: DbxActionSnackbarType` - Preset type
- `dbxActionSnackbarUndo: DbxActionSnackbarGeneratorUndoInput` - Undo functionality

**Preset Types** (`DbxActionSnackbarType`):
- `'save'` - "Saved!" message with success styling
- `'delete'` - "Deleted!" message
- `'do'` - "Done!" message
- `'update'` - "Updated!" message
- `'create'` - "Created!" message
- `'remove'` - "Removed!" message

**Key Features**:
- Watches `loadingState$` from action
- Automatic success/error snackbars based on state
- Preset configurations for common actions
- Optional undo functionality
- Custom message generation support

**Usage Notes**:
- Uses `DbxActionSnackbarService` for rendering
- Can customize duration, position, and actions
- Undo button creates new action context for reversal
- Supports custom snackbar component

**Example (Simple Save)**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     dbxActionSnackbar
     dbxActionSnackbarDefault="save">
  <!-- Shows "Saved!" on success -->
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

**Example (Delete with Confirmation)**:
```html
<div dbxAction
     [dbxActionConfirm]="deleteConfirm"
     [dbxActionHandler]="deleteItem"
     dbxActionSnackbar
     dbxActionSnackbarDefault="delete">
  <!-- Shows "Deleted!" after successful deletion -->
  <dbx-button dbxActionButton text="Delete" color="warn"></dbx-button>
</div>
```

**Example (With Undo)**:
```html
<div dbxAction
     [dbxActionHandler]="markComplete"
     dbxActionSnackbar
     dbxActionSnackbarDefault="do"
     [dbxActionSnackbarUndo]="getUndoAction">
  <!-- Shows "Done!" with "Undo" button -->
  <dbx-button dbxActionButton text="Mark Complete"></dbx-button>
</div>
```

```typescript
readonly markComplete: WorkUsingObservable<Task> = (task) => {
  return this.api.markComplete(task.id).pipe(delay(500));
};

getUndoAction = (task: Task) => {
  // Return new action context for undo
  return new DbxActionContextMachine({
    oneTimeUse: true,
    handleValueReady: () => {
      return this.api.markIncomplete(task.id).pipe(delay(500));
    }
  });
};
```

**Custom Config Generator**:
```typescript
readonly customSnackbar: DbxActionSnackbarDisplayConfigGeneratorFunction = (
  loadingState,
  value
) => {
  if (loadingState.type === LoadingStateType.SUCCESS) {
    return {
      message: `Successfully processed ${value.count} items`,
      duration: 4000,
      action: 'View Details',
      onAction: () => this.router.navigate(['/details'])
    };
  }
  return null;  // Don't show snackbar for other states
};
```

---

## Dialog & Popover Integration

### `dbxActionDialog`

**Purpose**: Opens a Material dialog when the action is triggered and provides the dialog result as the action value.

**Selector**: `dbxActionDialog`, `[dbxActionDialog]`

**Input**: `dbxActionDialog: DbxActionDialogFunction<T>`

**Type**:
```typescript
type DbxActionDialogFunction<T> = () => MatDialogRef<any, T> | Observable<MatDialogRef<any, T>>;
```

**Key Features**:
- Extends `AbstractDbxActionValueGetterDirective<T>`
- Opens dialog when action is triggered
- Waits for dialog to close
- Provides dialog result as action value
- If dialog returns `null`/`undefined`, action doesn't proceed

**Usage Notes**:
- Dialog opens on trigger (before value ready)
- Result from `afterClosed()` becomes action value
- Cancelled dialogs (null result) don't trigger handler
- Can use custom dialog components
- Works with form dialogs for user input

**Example (Custom Dialog)**:
```html
<div dbxAction
     [dbxActionDialog]="openUserDialog"
     [dbxActionHandler]="processUser">
  <dbx-button dbxActionButton text="Edit User"></dbx-button>
</div>
```

```typescript
readonly openUserDialog: DbxActionDialogFunction<User> = () => {
  return UserEditDialogComponent.open(this.matDialog, this.currentUser);
};

readonly processUser: WorkUsingObservable<User> = (user) => {
  return this.api.saveUser(user).pipe(delay(500));
};
```

**Dialog Component Pattern**:
```typescript
@Component({
  selector: 'app-user-edit-dialog',
  template: `
    <h2 mat-dialog-title>Edit User</h2>
    <mat-dialog-content>
      <!-- form fields -->
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button [mat-dialog-close]="null">Cancel</button>
      <button mat-raised-button [mat-dialog-close]="userData" color="primary">
        Save
      </button>
    </mat-dialog-actions>
  `
})
export class UserEditDialogComponent {
  userData: User;

  static open(dialog: MatDialog, user: User): MatDialogRef<UserEditDialogComponent, User> {
    const ref = dialog.open(UserEditDialogComponent, {
      width: '500px',
      data: { user }
    });
    ref.componentInstance.userData = user;
    return ref;
  }
}
```

---

### `dbxActionPopover`

**Purpose**: Opens a popover when the action is triggered and provides the popover result as the action value.

**Selector**: `dbxActionPopover`, `[dbxActionPopover]`

**Input**: `dbxActionPopover: DbxActionPopoverFunction<T>`

**Type**:
```typescript
type DbxActionPopoverFunction<T> = (config: { origin: ElementRef }) =>
  NgPopoverRef<any, T> | Observable<NgPopoverRef<any, T>>;
```

**Key Features**:
- Extends `AbstractDbxActionValueGetterDirective<T>`
- Opens popover when action is triggered
- Waits for popover to close
- Provides popover result as action value
- Passes origin element for positioning

**Usage Notes**:
- Similar to dialog but lighter-weight (popover vs modal)
- Popover positioned relative to trigger element
- Result from `afterClosed$` becomes action value
- Use for quick edits or selections
- Cancelled popovers (null result) don't trigger handler

**Example (Quick Edit)**:
```html
<div dbxAction
     [dbxActionPopover]="openEditPopover"
     [dbxActionHandler]="saveChanges">
  <dbx-button dbxActionButton text="Quick Edit" icon="edit"></dbx-button>
</div>
```

```typescript
readonly openEditPopover: DbxActionPopoverFunction<EditData> = ({ origin }) => {
  return QuickEditPopoverComponent.open(this.popoverService, {
    origin,
    data: this.currentData
  });
};

readonly saveChanges: WorkUsingObservable<EditData> = (data) => {
  return this.api.save(data).pipe(delay(300));
};
```

**Popover Component Pattern**:
```typescript
@Component({
  selector: 'app-quick-edit-popover',
  template: `
    <div class="popover-content">
      <input [(ngModel)]="data.value" placeholder="Enter value">
      <button (click)="save()">Save</button>
      <button (click)="cancel()">Cancel</button>
    </div>
  `
})
export class QuickEditPopoverComponent {
  data: EditData;

  constructor(private ref: NgPopoverRef<QuickEditPopoverComponent, EditData>) {}

  save() {
    this.ref.close(this.data);
  }

  cancel() {
    this.ref.close(null);
  }

  static open(service: DbxPopoverService, config: any): NgPopoverRef<QuickEditPopoverComponent, EditData> {
    return service.open(QuickEditPopoverComponent, config);
  }
}
```

---

### `DbxFormActionDialogComponent`

**Purpose**: Pre-built dialog component with integrated form and action system for quick form-based dialogs.

**Class**: `DbxFormActionDialogComponent` (component, not directive)

**Static Method**: `openDialogWithForm(matDialog: MatDialog, config: DbxFormActionDialogConfig)`

**Config Type**:
```typescript
interface DbxFormActionDialogConfig {
  header: string;                              // Dialog title
  fields: FormFieldConfig[];                   // Field configurations
  initialValue?: any;                          // Initial form value
  submitButtonConfig?: DbxButtonDisplayConfig; // Submit button customization
}
```

**Key Features**:
- Complete form + action integration in a dialog
- Uses `DbxFormModule` for forms
- Uses `DbxActionModule` for action handling
- Configurable fields with validation
- Custom submit button styling
- Returns form value on submission

**Usage Notes**:
- No need to create custom dialog component
- Perfect for quick user input forms
- Supports all dbx-form field types
- Automatic validation and error handling
- Integrates with action system automatically

**Example**:
```html
<div dbxAction
     [dbxActionDialog]="openFormDialog"
     [dbxActionHandler]="processFormData">
  <dbx-button dbxActionButton text="Add Comment"></dbx-button>
</div>
```

```typescript
import { DbxFormActionDialogComponent, textAreaField } from '@dereekb/dbx-form';

readonly openFormDialog: DbxActionDialogFunction = () => {
  return DbxFormActionDialogComponent.openDialogWithForm(this.matDialog, {
    header: 'Add Comment',
    fields: [
      textAreaField({
        key: 'comment',
        label: 'Comment',
        placeholder: 'Enter your comment',
        required: true,
        rows: 4
      })
    ],
    submitButtonConfig: {
      text: 'Submit Comment',
      icon: 'send',
      color: 'primary'
    }
  });
};

readonly processFormData: WorkUsingObservable<{comment: string}> = (data) => {
  return this.api.addComment(data.comment).pipe(delay(500));
};
```

**Example (Multiple Fields)**:
```typescript
import { textField, selectField, checkboxField } from '@dereekb/dbx-form';

readonly openUserDialog: DbxActionDialogFunction = () => {
  return DbxFormActionDialogComponent.openDialogWithForm(this.matDialog, {
    header: 'Create User',
    fields: [
      textField({
        key: 'name',
        label: 'Name',
        required: true
      }),
      textField({
        key: 'email',
        label: 'Email',
        type: 'email',
        required: true
      }),
      selectField({
        key: 'role',
        label: 'Role',
        options: [
          { value: 'user', label: 'User' },
          { value: 'admin', label: 'Admin' }
        ],
        required: true
      }),
      checkboxField({
        key: 'sendWelcomeEmail',
        label: 'Send welcome email'
      })
    ],
    submitButtonConfig: {
      text: 'Create User',
      color: 'primary'
    }
  });
};
```

---

## Advanced Directives

### `dbxActionAnalytics`

**Purpose**: Connects analytics tracking to the action lifecycle, firing events at key moments.

**Selector**: `dbxActionAnalytics`, `[dbxActionAnalytics]`

**Input**: `dbxActionAnalytics: DbxActionAnalyticsConfig`

**Type**:
```typescript
interface DbxActionAnalyticsConfig {
  onTriggered?: (service: DbxAnalyticsService) => void;
  onReady?: (service: DbxAnalyticsService, value: any) => void;
  onSuccess?: (service: DbxAnalyticsService, value: any) => void;
  onError?: (service: DbxAnalyticsService, error: ReadableError) => void;
}
```

**Example**:
```typescript
readonly analyticsConfig: DbxActionAnalyticsConfig = {
  onTriggered: (service) => {
    service.sendEventType('user_save_initiated');
  },
  onSuccess: (service, result) => {
    service.sendEventType('user_save_success', { userId: result.id });
  },
  onError: (service, error) => {
    service.sendEventType('user_save_error', { error: error.message });
  }
};
```

```html
<div dbxAction
     [dbxActionHandler]="save"
     [dbxActionAnalytics]="analyticsConfig">
  <dbx-button dbxActionButton text="Save"></dbx-button>
</div>
```

---

### `dbxActionKeyTrigger`

**Purpose**: Triggers the action when a specific keyboard key is pressed (commonly Enter key).

**Selector**: `dbxActionKeyTrigger`, `[dbxActionKeyTrigger]`

**Input**: `dbxActionKeyTrigger: string` - Key name (default: 'enter')

**Example (Enter Key Submit)**:
```html
<div dbxAction [dbxActionHandler]="submit" dbxActionKeyTrigger>
  <!-- Triggers on Enter key -->
  <form dbxActionForm>
    <input type="text" placeholder="Type and press Enter">
  </form>
</div>
```

**Example (Custom Key)**:
```html
<div dbxAction [dbxActionHandler]="save" [dbxActionKeyTrigger]="'s'">
  <!-- Triggers on 's' key press -->
  <textarea></textarea>
</div>
```

---

### `dbxActionTransitionSafety`

**Purpose**: Prevents UIRouter navigation when action has unsaved changes (modified state).

**Selector**: `dbxActionTransitionSafety`, `[dbxActionTransitionSafety]`

**Input**: `dbxActionTransitionSafety: 'none' | 'dialog' | 'auto'`

**Modes**:
- `'none'`: No transition safety
- `'dialog'`: Shows confirmation dialog if modified
- `'auto'`: Tries to trigger action, shows dialog if it fails

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     dbxActionTransitionSafety="dialog">
  <form dbxActionForm><!-- form --></form>
  <!-- Warns before navigation if form is modified -->
</div>
```

---

### `dbxActionLoadingContext`

**Purpose**: Links a `DbxLoadingComponent` to the action's loading state.

**Selector**: `dbxActionLoadingContext`, `[dbxActionLoadingContext]`

**Example**:
```html
<div dbxAction [dbxActionHandler]="load">
  <dbx-loading dbxActionLoadingContext>
    <!-- Shows loading spinner while action is working -->
  </dbx-loading>
</div>
```

---

### `dbxFileUploadActionSync`

**Purpose**: Synchronizes a file upload component's state with the action context (working/disabled states).

**Selector**: `dbxFileUploadActionSync`, `[dbxFileUploadActionSync]`

**Key Features**:
- Propagates `isWorkingOrWorkProgress$` to upload component
- Propagates `isDisabled$` to upload component
- Useful for file upload actions

**Example**:
```html
<div dbxAction [dbxActionHandler]="uploadFiles">
  <dbx-file-upload dbxFileUploadActionSync></dbx-file-upload>
  <dbx-button dbxActionButton text="Upload"></dbx-button>
</div>
```

---

## Examples

### Simple Button with Snackbar

```html
<div dbxAction
     [dbxActionHandler]="saveData"
     dbxActionSnackbar
     dbxActionSnackbarDefault="save">
  <dbx-button dbxActionButton text="Save" icon="save"></dbx-button>
</div>
```

---

### Confirm Before Delete

```html
<div dbxAction
     [dbxActionConfirm]="deleteConfirm"
     [dbxActionHandler]="deleteItem"
     dbxActionSnackbar
     dbxActionSnackbarDefault="delete">
  <dbx-button dbxActionButton text="Delete" color="warn"></dbx-button>
</div>
```

```typescript
readonly deleteConfirm: DbxActionConfirmConfig = {
  title: 'Confirm Delete',
  prompt: 'Are you sure? This cannot be undone.',
  confirmText: 'Delete',
  cancelText: 'Cancel'
};
```

---

### Dialog for User Input

```html
<div dbxAction
     [dbxActionDialog]="openInputDialog"
     [dbxActionHandler]="processInput"
     dbxActionSnackbar>
  <dbx-button dbxActionButton text="Add Item"></dbx-button>
</div>
```

```typescript
readonly openInputDialog: DbxActionDialogFunction = () => {
  return DbxFormActionDialogComponent.openDialogWithForm(this.matDialog, {
    header: 'Add New Item',
    fields: [
      textField({ key: 'name', label: 'Name', required: true }),
      textAreaField({ key: 'description', label: 'Description' })
    ]
  });
};
```

---

### Error Handling with Snackbar

```html
<div dbxAction
     [dbxActionHandler]="riskyOperation"
     dbxActionSnackbar
     dbxActionSnackbarError>
  <!-- Success shows snackbar, errors also show in snackbar -->
  <dbx-button dbxActionButton text="Execute"></dbx-button>
</div>
```

---

## Best Practices

### When to Use Dialogs vs Popovers

**Use Dialogs**:
- Complex forms with multiple fields
- Important decisions requiring focus
- Operations that can't be easily undone
- When you need to block other interactions

**Use Popovers**:
- Quick edits (single field changes)
- Simple selections from a list
- Contextual actions near the trigger
- When maintaining visual context is important

---

### Snackbar Types and Conventions

**Standard Types**:
- `'save'` - General save operations
- `'create'` - Creating new entities
- `'update'` - Updating existing entities
- `'delete'` / `'remove'` - Deletion operations
- `'do'` - Generic completion

**Custom Messages**: Use custom config generator for specific feedback:
```typescript
readonly customFeedback = (state, value) => {
  if (state.type === LoadingStateType.SUCCESS) {
    return {
      message: `${value.count} items processed`,
      duration: 3000
    };
  }
  return null;
};
```

---

### Error Display Strategies

**Inline Errors** (`dbxActionError`):
- Use for forms where context is important
- Keeps error visible while user fixes issue
- Better for validation errors

**Snackbar Errors** (`dbxActionSnackbarError`):
- Use for API/network errors
- Non-blocking, doesn't cover UI
- Good for operations where user can't immediately fix
- Better for notification-style errors

**Combined Approach**:
```html
<div dbxAction [dbxActionHandler]="save">
  <!-- Form validation errors show inline -->
  <form dbxActionForm>
    <dbx-error dbxActionError></dbx-error>
  </form>

  <!-- API errors show in snackbar -->
  <dbx-button dbxActionButton text="Save" dbxActionSnackbarError></dbx-button>
</div>
```

---

### Analytics Integration Patterns

**Track Key Events**:
```typescript
readonly analytics: DbxActionAnalyticsConfig = {
  onTriggered: (service) => {
    service.sendEventType('checkout_initiated');
  },
  onSuccess: (service, order) => {
    service.sendEventType('checkout_completed', {
      orderId: order.id,
      total: order.total
    });
  },
  onError: (service, error) => {
    service.sendEventType('checkout_failed', {
      reason: error.message
    });
  }
};
```

**Don't Over-Track**: Only track meaningful user actions, not every button click.

---

## Related Skills

- **[dbx-core-actions](/skills/dbx-core-actions)**: Core action system foundation
- **[dbx-form-actions](/skills/dbx-form-actions)**: Form integration with actions

---

## Summary

The **dbx-web-actions** directives provide rich UI interactions for the dbxAction system:

- **Buttons**: Automatic disabled/loading states
- **Confirmation**: User prompts before actions
- **Errors**: Inline or snackbar error display
- **Snackbars**: Success/error notifications with presets
- **Dialogs/Popovers**: Modal user input before actions
- **Advanced**: Analytics, keyboard triggers, transition safety

Use these directives to create polished, user-friendly action flows with minimal code.
