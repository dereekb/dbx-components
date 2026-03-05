---
name: DBX Form Actions
description: Form integration directives for dbxAction from @dereekb/dbx-form
triggers:
  - action form
  - dbxActionForm
  - form action
  - form validation action
  - form modified
  - dbx form actions
---

# DBX Form Actions

Form integration directives that connect the **DbxForm** system with **dbxAction** from `@dereekb/dbx-form`.

## Table of Contents

1. [Introduction](#introduction)
2. [DbxActionFormDirective](#dbxactionformdirective)
3. [DbxActionFormSafetyDirective](#dbxactionformsafetydirective)
4. [DbxFormActionDialogComponent](#dbxformactiondialogcomponent)
5. [Examples](#examples)
6. [Best Practices](#best-practices)

---

## Introduction

### Overview

The **dbx-form-actions** directives seamlessly integrate Angular forms with the dbxAction system. The primary directive, `dbxActionForm`, binds a form as the action's value source and automatically manages validation, modified state, and form locking during action execution.

### Prerequisites

**Required Knowledge**:
- Core dbxAction system → See [dbx-core-actions](/skills/dbx-core-actions)
- DbxForm system from `@dereekb/dbx-form` (form building, validators, fields)
- RxJS observables for validation functions
- Understanding of modified vs valid states

You should understand action states, `ActionContextStore`, and form basics before using form-action integration.

### Package Location

- **Package**: `@dereekb/dbx-form`
- **Main Directive**: `packages/dbx-form/src/lib/form/action/form.action.directive.ts`
- **Related**: Form safety, form action dialog component

### What's Included

- **DbxActionFormDirective**: Binds form to action with validation and modified tracking
- **DbxActionFormSafetyDirective**: Prevents navigation with unsaved form changes
- **DbxFormActionDialogComponent**: Pre-built dialog with form and action (see [dbx-web-actions](/skills/dbx-web-actions))

---

## DbxActionFormDirective

### Purpose

Binds a `DbxMutableForm<T>` to an action as its value source, automatically managing:
- Form value provision on trigger
- Modified state tracking
- Validation (form + custom business rules)
- Form locking while action is working
- Action disabling when form is incomplete

### Selector

`[dbxActionForm]`

### Host Requirement

Must be applied to a component that provides `DbxMutableForm<T>`.

### Type Parameters

```typescript
DbxActionFormDirective<T, O>
```

- **T**: Form value type (input to action)
- **O**: Action result type (can differ from form if using `dbxActionFormMapValue`)

---

### Key Features

1. **Automatic Value Provision**: On `triggered$`, provides current form value to action
2. **Validation Before Submit**: Rejects action if form is invalid or custom validation fails
3. **Modified State Management**: Tracks form changes and updates action's `isModified$`
4. **Disabled State Control**: Disables action when form is incomplete/invalid
5. **Form Locking**: Disables form while action is working (configurable)
6. **Lifecycle Coordination**: Uses `LockSet` to coordinate form and action cleanup

---

### Inputs

#### `dbxActionFormDisabledOnWorking`

**Type**: `boolean` (default: `true`)

**Purpose**: Controls whether the form is disabled while the action is working.

**Usage**:
```html
<form dbxActionForm [dbxActionFormDisabledOnWorking]="false">
  <!-- Form stays enabled during action execution -->
</form>
```

**Use Cases**:
- Set to `false` if form needs to stay editable during async operation
- Keep `true` (default) to prevent changes during save

---

#### `dbxActionFormIsValid`

**Type**: `IsValidFunction<T>`

**Signature**: `(value: T) => Observable<boolean>`

**Purpose**: Custom validation beyond form's built-in validation. Runs after form is complete.

**Usage Notes**:
- Called with form value
- Must return `Observable<boolean>`
- Only runs if form is complete (no validation errors)
- If returns `false`, action is rejected
- Use for business rules that can't be expressed as form validators

**Example (Date Validation)**:
```typescript
import { IsValidFunction } from '@dereekb/rxjs';
import { isFriday } from 'date-fns';
import { of } from 'rxjs';

readonly validateForm: IsValidFunction<FormValue> = (value) => {
  // Business rule: Only allow submissions on Fridays
  const isValid = isFriday(value.date);
  return of(isValid);
};
```

```html
<form dbxActionForm [dbxActionFormIsValid]="validateForm">
  <!-- ... -->
</form>
```

**Example (Async API Validation)**:
```typescript
readonly validateForm: IsValidFunction<UserFormData> = (value) => {
  // Check if username is available
  return this.api.checkUsernameAvailable(value.username).pipe(
    map(response => response.available),
    catchError(() => of(false))
  );
};
```

---

#### `dbxActionFormIsEqual`

**Type**: `IsEqualFunction<T>`

**Signature**: `(value: T) => Observable<boolean>`

**Purpose**: Checks if the current form value equals the initial/default value. Used to determine modified state.

**Usage Notes**:
- Called with current form value
- Must return `Observable<boolean>`
- `true` means value equals initial (not modified)
- `false` means value differs from initial (is modified)
- Takes precedence over `dbxActionFormIsModified` if both provided
- Use when you need to compare against a baseline value

**Example (Compare to Initial)**:
```typescript
import { IsEqualFunction } from '@dereekb/rxjs';
import { isSameMinute } from 'date-fns';
import { of, map } from 'rxjs';

interface FormValue {
  name: string;
  date: Date;
}

readonly defaultValue$ = of({
  name: 'John',
  date: new Date('2024-01-01')
});

readonly isFormEqual: IsEqualFunction<FormValue> = (value) => {
  return this.defaultValue$.pipe(
    map(defaultValue => {
      return value.name === defaultValue.name &&
             isSameMinute(value.date, defaultValue.date);
    })
  );
};
```

```html
<form dbxActionForm [dbxFormSource]="defaultValue$" [dbxActionFormIsEqual]="isFormEqual">
  <!-- Action disabled when form equals default value -->
</form>
```

---

#### `dbxActionFormIsModified`

**Type**: `IsModifiedFunction<T>`

**Signature**: `(value: T) => Observable<boolean>`

**Purpose**: Custom check for whether the form value has been modified. **Ignored if `dbxActionFormIsEqual` is provided.**

**Usage Notes**:
- Called with current form value
- Must return `Observable<boolean>`
- `true` means value is modified
- `false` means value is not modified
- Alternative to `isEqual` (use one or the other, not both)
- Use when you want to directly determine modified state

**Example**:
```typescript
import { IsModifiedFunction } from '@dereekb/rxjs';

readonly isFormModified: IsModifiedFunction<FormValue> = (value) => {
  return this.initialValue$.pipe(
    map(initial => {
      // Check if any field differs
      return value.name !== initial.name ||
             value.email !== initial.email;
    })
  );
};
```

```html
<form dbxActionForm [dbxActionFormIsModified]="isFormModified">
  <!-- Explicitly define what "modified" means -->
</form>
```

---

#### `dbxActionFormMapValue`

**Type**: `DbxActionFormMapValueFunction<T, O>`

**Signature**: `(formValue: T) => Observable<DbxActionValueGetterResult<O>>`

**Return Type**:
```typescript
interface DbxActionValueGetterResult<O> {
  value?: O;
  reject?: ReadableError;
}
```

**Purpose**: Maps/transforms the form value to a different type before passing to the action handler. Enables type transformation between form and API.

**Usage Notes**:
- Called after validation passes
- Can transform type from `T` (form) to `O` (action input)
- Can return `{ reject }` to reject action with error
- Useful when form structure differs from API structure
- Allows for data sanitization or enrichment

**Example (Type Transformation)**:
```typescript
import { DbxActionFormMapValueFunction } from '@dereekb/dbx-form';

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
}

interface UserApiRequest {
  fullName: string;
  email: string;
  timestamp: Date;
}

readonly mapFormValue: DbxActionFormMapValueFunction<UserFormData, UserApiRequest> = (formValue) => {
  // Transform form data to API format
  const apiRequest: UserApiRequest = {
    fullName: `${formValue.firstName} ${formValue.lastName}`,
    email: formValue.email.toLowerCase(),
    timestamp: new Date()
  };

  return of({ value: apiRequest });
};
```

```html
<form dbxActionForm [dbxActionFormMapValue]="mapFormValue">
  <!-- Form type is UserFormData, action handler receives UserApiRequest -->
</form>
```

**Example (Conditional Rejection)**:
```typescript
readonly mapAndValidate: DbxActionFormMapValueFunction<FormData, ApiData> = (formValue) => {
  // Additional validation during mapping
  if (formValue.age < 18) {
    return of({
      reject: new Error('User must be 18 or older')
    });
  }

  return of({
    value: {
      ...formValue,
      createdAt: new Date()
    }
  });
};
```

---

### Behavior Details

#### Modified State Tracking

The directive tracks modified state using:
1. **Angular Form State**: `pristine` flag and `untouched` flag
2. **Change Count**: Number of value changes (threshold: >3 changes)
3. **Time Since Reset**: At least 2 seconds since form reset
4. **Custom Functions**: `dbxActionFormIsEqual` or `dbxActionFormIsModified`

A form is considered "probably touched" (and thus can be modified) when:
- Form is not `untouched`, OR
- More than 3 changes have occurred AND at least 2 seconds have passed since reset

This prevents false positives from initialization.

#### Validation Flow

1. **Form Complete Check**: Is form valid per Angular validators?
2. **Custom Validation**: If complete, run `dbxActionFormIsValid` (if provided)
3. **Disabled State**: Action is disabled if validation fails
4. **On Trigger**: If not complete or validation fails, action is not triggered
5. **If Complete**: Form value is passed to handler

#### Rejection Scenarios

Action is rejected if:
- Form is not complete (has validation errors)
- Custom validation returns `false`
- Map value function returns `{ reject }`

#### Form Locking

When `dbxActionFormDisabledOnWorking` is `true` (default):
- Form is disabled when `isWorking$` is `true`
- Form fields become read-only during action execution
- Prevents user from changing data during save

#### Disabled Key

Uses `APP_ACTION_FORM_DISABLED_KEY` to manage action's disabled state based on form validity.

---

### Complete Example

```html
<div dbxAction
     [dbxActionHandler]="submitUser"
     dbxActionEnforceModified
     dbxActionSnackbar
     dbxActionSnackbarDefault="save">

  <form dbxActionForm
        [dbxFormSource]="initialUser$"
        [dbxActionFormIsValid]="validateUser"
        [dbxActionFormIsEqual]="isUserEqual"
        [dbxActionFormMapValue]="mapToApiFormat"
        [dbxActionFormDisabledOnWorking]="true">

    <mat-form-field>
      <input matInput dbxFormInput="firstName" placeholder="First Name" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput dbxFormInput="lastName" placeholder="Last Name" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput dbxFormInput="email" type="email" placeholder="Email" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput dbxFormInput="age" type="number" placeholder="Age" required>
    </mat-form-field>
  </form>

  <dbx-button dbxActionButton text="Save User" color="primary"></dbx-button>
  <dbx-error dbxActionError></dbx-error>
</div>
```

```typescript
interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  age: number;
}

interface UserApiRequest {
  fullName: string;
  email: string;
  age: number;
}

readonly initialUser$ = of({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  age: 30
});

readonly validateUser: IsValidFunction<UserFormData> = (value) => {
  // Business rule: Age must be 18+
  return of(value.age >= 18);
};

readonly isUserEqual: IsEqualFunction<UserFormData> = (value) => {
  return this.initialUser$.pipe(
    map(initial =>
      value.firstName === initial.firstName &&
      value.lastName === initial.lastName &&
      value.email === initial.email &&
      value.age === initial.age
    )
  );
};

readonly mapToApiFormat: DbxActionFormMapValueFunction<UserFormData, UserApiRequest> = (formValue) => {
  return of({
    value: {
      fullName: `${formValue.firstName} ${formValue.lastName}`,
      email: formValue.email.toLowerCase(),
      age: formValue.age
    }
  });
};

readonly submitUser: WorkUsingObservable<UserApiRequest> = (apiRequest) => {
  return this.api.saveUser(apiRequest).pipe(delay(1000));
};
```

---

## DbxActionFormSafetyDirective

### Purpose

Extends `DbxActionTransitionSafetyDirective` specifically for forms. Forces form update before handling UIRouter transitions and prevents navigation when form has unsaved changes.

### Selector

`[dbxActionFormSafety]`

### Host Requirement

Must be applied to a component with both `DbxActionDirective` and `DbxActionFormDirective`.

### Key Features

- Extends transition safety for form-specific behavior
- Calls `form.forceFormUpdate()` before transition check
- Defaults to `'auto'` mode (tries to save, shows dialog if it fails)
- Shows confirmation dialog if form is modified
- Allows navigation after successful save

### Modes

Same as `DbxActionTransitionSafetyDirective`:
- `'none'`: No transition safety
- `'dialog'`: Shows confirmation if modified
- `'auto'`: Attempts to trigger action, shows dialog on failure

### Example

```html
<div dbxAction
     [dbxActionHandler]="saveForm"
     dbxActionFormSafety="auto">

  <form dbxActionForm>
    <!-- form fields -->
  </form>

  <!-- User warned before navigating away with unsaved changes -->
</div>
```

---

## DbxFormActionDialogComponent

### Overview

Pre-built dialog component with integrated form and action system. Perfect for quick form-based dialogs without creating custom components.

**Note**: Full documentation in [dbx-web-actions](/skills/dbx-web-actions) skill. Included here for form context.

### Static Method

```typescript
DbxFormActionDialogComponent.openDialogWithForm(
  matDialog: MatDialog,
  config: DbxFormActionDialogConfig
): MatDialogRef<DbxFormActionDialogComponent, any>
```

### Config Type

```typescript
interface DbxFormActionDialogConfig {
  header: string;                              // Dialog title
  fields: FormFieldConfig[];                   // Array of field configs
  initialValue?: any;                          // Initial form value
  submitButtonConfig?: DbxButtonDisplayConfig; // Submit button customization
}
```

### Example

```typescript
import { DbxFormActionDialogComponent, textField, textAreaField } from '@dereekb/dbx-form';

readonly openCommentDialog: DbxActionDialogFunction = () => {
  return DbxFormActionDialogComponent.openDialogWithForm(this.matDialog, {
    header: 'Add Comment',
    fields: [
      textField({
        key: 'title',
        label: 'Title',
        required: true
      }),
      textAreaField({
        key: 'body',
        label: 'Comment',
        placeholder: 'Enter your comment',
        required: true,
        rows: 5
      })
    ],
    submitButtonConfig: {
      text: 'Post Comment',
      icon: 'send',
      color: 'primary'
    }
  });
};
```

---

## Examples

### Example 1: Basic Form Action

Simple form submission with automatic validation and modified enforcement.

**Template**:
```html
<div dbxAction
     [dbxActionHandler]="submitForm"
     dbxActionEnforceModified
     dbxActionSnackbar
     dbxActionSnackbarDefault="save">

  <form dbxActionForm>
    <mat-form-field>
      <input matInput dbxFormInput="name" placeholder="Name" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput dbxFormInput="email" type="email" placeholder="Email" required>
    </mat-form-field>
  </form>

  <dbx-button dbxActionButton text="Save" color="primary"></dbx-button>
  <dbx-error dbxActionError></dbx-error>
</div>
```

**Component**:
```typescript
interface FormData {
  name: string;
  email: string;
}

readonly submitForm: WorkUsingObservable<FormData> = (formData) => {
  console.log('Submitting:', formData);
  return this.api.save(formData).pipe(delay(1000));
};
```

**What's Happening**:
- Form requires name and email (Angular validation)
- Action disabled until form is valid
- Action disabled until form is modified (dbxActionEnforceModified)
- Form locks while saving (default behavior)
- Success snackbar shows "Saved!" message

---

### Example 2: Form with Custom Validation

Add business logic validation beyond form validators.

**Template**:
```html
<div dbxAction
     [dbxActionHandler]="createEvent"
     dbxActionEnforceModified
     dbxActionSnackbar>

  <form dbxActionForm [dbxActionFormIsValid]="validateEvent">
    <mat-form-field>
      <input matInput dbxFormInput="title" placeholder="Event Title" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput
             [matDatepicker]="picker"
             dbxFormInput="date"
             placeholder="Event Date"
             required>
      <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
      <mat-datepicker #picker></mat-datepicker>
    </mat-form-field>

    <mat-form-field>
      <mat-select dbxFormInput="maxAttendees" placeholder="Max Attendees" required>
        <mat-option [value]="10">10</mat-option>
        <mat-option [value]="25">25</mat-option>
        <mat-option [value]="50">50</mat-option>
        <mat-option [value]="100">100</mat-option>
      </mat-select>
    </mat-form-field>
  </form>

  <dbx-button dbxActionButton text="Create Event" color="primary"></dbx-button>
  <dbx-error dbxActionError></dbx-error>
</div>
```

**Component**:
```typescript
import { isFuture, isWeekend } from 'date-fns';

interface EventFormData {
  title: string;
  date: Date;
  maxAttendees: number;
}

readonly validateEvent: IsValidFunction<EventFormData> = (value) => {
  // Business rules:
  // 1. Date must be in the future
  // 2. Date must be on a weekend
  const isFutureDate = isFuture(value.date);
  const isWeekendDate = isWeekend(value.date);

  return of(isFutureDate && isWeekendDate);
};

readonly createEvent: WorkUsingObservable<EventFormData> = (eventData) => {
  return this.api.createEvent(eventData).pipe(delay(800));
};
```

**What's Happening**:
- Form validation checks required fields
- Custom validation ensures date is in future and on weekend
- If custom validation fails, action is rejected
- Error would show: form is complete but validation failed

---

### Example 3: Form with Modified Check

Track modified state by comparing to initial value with custom equality logic.

**Template**:
```html
<div dbxAction
     [dbxActionHandler]="updateProfile"
     dbxActionEnforceModified
     dbxActionSnackbar
     dbxActionSnackbarDefault="update">

  <form dbxActionForm
        [dbxFormSource]="currentProfile$"
        [dbxActionFormIsEqual]="isProfileEqual">

    <mat-form-field>
      <input matInput dbxFormInput="displayName" placeholder="Display Name" required>
    </mat-form-field>

    <mat-form-field>
      <textarea matInput
                dbxFormInput="bio"
                placeholder="Bio"
                rows="4"></textarea>
    </mat-form-field>

    <mat-checkbox dbxFormInput="emailNotifications">
      Email Notifications
    </mat-checkbox>
  </form>

  <dbx-button dbxActionButton text="Update Profile"></dbx-button>
  <p class="hint">Button enabled only when changes are made</p>
</div>
```

**Component**:
```typescript
interface ProfileData {
  displayName: string;
  bio: string;
  emailNotifications: boolean;
}

readonly currentProfile$ = of({
  displayName: 'John Doe',
  bio: 'Software developer',
  emailNotifications: true
});

readonly isProfileEqual: IsEqualFunction<ProfileData> = (value) => {
  return this.currentProfile$.pipe(
    map(current =>
      value.displayName === current.displayName &&
      value.bio === current.bio &&
      value.emailNotifications === current.emailNotifications
    )
  );
};

readonly updateProfile: WorkUsingObservable<ProfileData> = (profileData) => {
  return this.api.updateProfile(profileData).pipe(delay(600));
};
```

**What's Happening**:
- Form loads with current profile data
- Custom equality check compares all fields
- Save button disabled until any field changes
- Once modified, save button enables
- After successful save, form resets to new "equal" state

---

### Example 4: Form with Value Mapping

Transform form structure to match API requirements.

**Template**:
```html
<div dbxAction
     [dbxActionHandler]="registerUser"
     dbxActionSnackbar
     dbxActionSnackbarDefault="create">

  <form dbxActionForm [dbxActionFormMapValue]="mapToRegistration">
    <mat-form-field>
      <input matInput dbxFormInput="firstName" placeholder="First Name" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput dbxFormInput="lastName" placeholder="Last Name" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput dbxFormInput="email" type="email" placeholder="Email" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput dbxFormInput="password" type="password" placeholder="Password" required>
    </mat-form-field>

    <mat-form-field>
      <input matInput dbxFormInput="confirmPassword" type="password" placeholder="Confirm Password" required>
    </mat-form-field>
  </form>

  <dbx-button dbxActionButton text="Register" color="primary"></dbx-button>
  <dbx-error dbxActionError></dbx-error>
</div>
```

**Component**:
```typescript
interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegistrationApiRequest {
  fullName: string;
  email: string;
  password: string;
  agreedToTerms: boolean;
  registeredAt: Date;
}

readonly mapToRegistration: DbxActionFormMapValueFunction<
  RegistrationFormData,
  RegistrationApiRequest
> = (formValue) => {
  // Validation: passwords must match
  if (formValue.password !== formValue.confirmPassword) {
    return of({
      reject: new Error('Passwords do not match')
    });
  }

  // Transform form data to API format
  return of({
    value: {
      fullName: `${formValue.firstName} ${formValue.lastName}`,
      email: formValue.email.toLowerCase().trim(),
      password: formValue.password,
      agreedToTerms: true,  // Implicit agreement
      registeredAt: new Date()
    }
  });
};

readonly registerUser: WorkUsingObservable<RegistrationApiRequest> = (request) => {
  return this.api.register(request).pipe(delay(1200));
};
```

**What's Happening**:
- Form collects firstName, lastName separately
- API expects fullName as single string
- Map function combines names and adds metadata
- Map function validates password match (could also be form validator)
- Handler receives transformed RegistrationApiRequest, not form data

---

## Best Practices

### When to Use IsValid vs IsModified vs IsEqual

**Use `dbxActionFormIsValid`**:
- Business rules that can't be form validators
- Async validation (check username availability)
- Cross-field validation (end date after start date)
- External API checks

**Use `dbxActionFormIsEqual`**:
- Comparing current value to initial/default value
- Tracking "unsaved changes" state
- Determining if form has been modified
- More intuitive than isModified for comparison scenarios

**Use `dbxActionFormIsModified`**:
- Direct control over what "modified" means
- When you want logic that isn't a simple equality check
- Alternative to isEqual (don't use both)

**General Rule**: Use `isEqual` for comparing to baseline, use `isValid` for business rules.

---

### Form Validation vs Action Validation

**Form Validators** (Angular):
- Field-level validation (required, email, min/max)
- Synchronous checks
- Built into form controls
- Prevents form completion

**Action Validation** (`dbxActionFormIsValid`):
- Business logic validation
- Asynchronous checks (API calls)
- Cross-field or complex rules
- Runs after form is complete
- Rejects action if fails

**Example**:
```typescript
// Form validator: Email format
<input matInput dbxFormInput="email" type="email" required>

// Action validator: Email not already registered
readonly validateEmail: IsValidFunction<FormData> = (value) => {
  return this.api.checkEmailAvailable(value.email);
};
```

---

### Handling Form Errors vs Action Errors

**Form Errors**:
- Validation errors (required field, invalid email)
- Shown by form fields (Angular Material error messages)
- Prevent form completion

**Action Errors**:
- API errors (network failure, server error)
- Business logic errors (insufficient permissions)
- Shown by `dbxActionError` or `dbxActionSnackbarError`

**Display Strategy**:
```html
<form dbxActionForm>
  <mat-form-field>
    <input matInput dbxFormInput="email" type="email" required>
    <mat-error>Email is required</mat-error>  <!-- Form error -->
  </mat-form-field>
</form>

<dbx-error dbxActionError></dbx-error>  <!-- Action error -->
```

---

### Value Mapping Patterns

**When to Use Mapping**:
1. Form structure differs from API structure
2. Need to add metadata (timestamps, IDs)
3. Need to transform values (combine fields, format dates)
4. Need to sanitize input (trim, lowercase)

**Example Patterns**:

**Combining Fields**:
```typescript
// Form: firstName, lastName
// API: fullName
return of({
  value: {
    fullName: `${form.firstName} ${form.lastName}`
  }
});
```

**Adding Metadata**:
```typescript
return of({
  value: {
    ...formValue,
    updatedAt: new Date(),
    updatedBy: this.currentUser.id
  }
});
```

**Sanitizing**:
```typescript
return of({
  value: {
    email: formValue.email.toLowerCase().trim(),
    username: formValue.username.trim()
  }
});
```

---

### Form Safety and Unsaved Changes

**Use `dbxActionFormSafety`**:
- Prevents accidental data loss
- Warns user before navigation
- Auto-mode tries to save first

**Example**:
```html
<div dbxAction
     [dbxActionHandler]="save"
     dbxActionFormSafety="auto">
  <!-- User can't navigate away without saving or confirming -->
</div>
```

**Modes**:
- `'auto'`: Best user experience (tries to save, warns if can't)
- `'dialog'`: Always shows warning if modified
- `'none'`: No protection (use with caution)

---

### Testing Form Actions

**Test Form Handler Independently**:
```typescript
it('should submit form data', (done) => {
  const component = new MyComponent();
  const testData = { name: 'Test', email: 'test@example.com' };

  component.submitForm(testData).subscribe({
    next: (result) => {
      expect(result.success).toBe(true);
      done();
    }
  });
});
```

**Test Validation Functions**:
```typescript
it('should validate age >= 18', (done) => {
  const component = new MyComponent();

  component.validateUser({ name: 'Test', age: 16 }).subscribe({
    next: (isValid) => {
      expect(isValid).toBe(false);
      done();
    }
  });
});
```

**Test Modified Detection**:
```typescript
it('should detect modified form', (done) => {
  const component = new MyComponent();
  const changed = { name: 'Changed', email: 'new@example.com' };

  component.isFormEqual(changed).subscribe({
    next: (isEqual) => {
      expect(isEqual).toBe(false);  // Not equal = is modified
      done();
    }
  });
});
```

---

## Related Skills

- **[dbx-core-actions](/skills/dbx-core-actions)**: Core action system foundation
- **[dbx-web-actions](/skills/dbx-web-actions)**: Web interaction directives (buttons, dialogs, snackbars)

---

## Summary

The **dbx-form-actions** directives provide seamless form integration with the dbxAction system:

- **DbxActionFormDirective**: Binds form as action value source
  - 5 configurable inputs for validation and modification tracking
  - Automatic form locking during action execution
  - Disabled state management based on form validity
- **DbxActionFormSafetyDirective**: Prevents navigation with unsaved changes
- **DbxFormActionDialogComponent**: Quick form dialogs without custom components

Use these directives to create robust form submission flows with validation, modified tracking, and error handling - all declaratively in your templates.
