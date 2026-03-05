---
name: dbx-core
description: Overview of @dereekb/dbx-core - foundational platform-agnostic Angular utilities package. Use when working with dbx-core components, understanding the package architecture, or needing guidance on router, storage, context, authentication, or environment services. For specialized topics, see dbx-injection (dynamic components), dbx-filter (filter state), or dbx-value-pipes (value transformation).
---

# DBX Core (@dereekb/dbx-core)

## Overview

**@dereekb/dbx-core** is the foundational package of the DBX component ecosystem, providing platform-agnostic Angular utilities and components that work in any Angular environment (web, mobile, SSR).

**Package Location:** `packages/dbx-core/`

**Key Features:**
- Platform-agnostic Angular utilities (no browser-specific code)
- Reusable patterns for common Angular tasks
- Base abstractions for routing, state management, and actions
- Foundation for @dereekb/dbx-web and other DBX packages

## Specialized Skills

For detailed guidance on specific dbx-core features, use these specialized skills:

- **dbx-injection** - Dynamic component injection, `DbxInjectionComponent`, `DbxInjectionContextDirective`
- **dbx-filter** - Filter state management with `FilterMap`, filter sources and connectors
- **dbx-value-pipes** - Value transformation pipes (`cutText`, `getValue`, `dollarAmount`, date pipes)

## Core Modules

### Injection

**→ See the [dbx-injection](#) skill for detailed guidance**

Dynamic component injection system for displaying components at runtime.

**Quick Example:**
```typescript
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';

const config: DbxInjectionComponentConfig = {
  componentClass: MyDynamicComponent,
  init: (instance) => instance.data = this.data
};
```

**Common Use Cases:**
- Displaying components in dialogs
- Temporary view contexts
- Dynamic content areas

### Filter

**→ See the [dbx-filter](#) skill for detailed guidance**

Reactive filter state management for sharing filter state across components.

**Quick Example:**
```typescript
import { FilterMap } from '@dereekb/rxjs';

@Component({
  providers: [FilterMap]
})
export class MyComponent {
  readonly filterMap = inject(FilterMap<MyFilter>);
  readonly filter$ = this.filterMap.filterForKey('main');
}
```

**Common Use Cases:**
- Filterable lists and tables
- Search interfaces
- Filter presets and partial filters

### Pipes

**→ See the [dbx-value-pipes](#) skill for detailed guidance**

Angular pipes for value transformation in templates.

**Quick Examples:**
```typescript
<!-- Text truncation -->
{{ longText | cutText:50 }}

<!-- Currency formatting -->
{{ price | dollarAmount }}

<!-- Getter resolution -->
{{ getter | getValue }}

<!-- Date range formatting -->
{{ dateRange | dateDayRange }}
```

### Router

UI-Router and Angular Router integration with type-safe navigation abstractions.

**Key Exports:**
- `DbxRouterService` - Abstract router service for navigation
- `Anchor`, `SegueRef` - Type-safe navigation types
- Anchor components and directives
- Route guards for auth and model-based routing

**Example:**
```typescript
import { DbxRouterService, Anchor } from '@dereekb/dbx-core';

@Component({...})
export class MyComponent {
  readonly router = inject(DbxRouterService);

  navigateToDetail(id: string) {
    const anchor: Anchor = {
      ref: 'app.users.detail',
      refParams: { id }
    };
    this.router.go(anchor);
  }
}
```

**Template Usage:**
```html
<dbx-anchor [anchor]="userDetailAnchor">View User</dbx-anchor>
```

**Package Location:** `packages/dbx-core/src/lib/router/`

### Storage

Client-side storage abstractions for localStorage, sessionStorage, and memory storage.

**Key Exports:**
- `FullLocalStorageObject` - LocalStorage wrapper
- `StorageAccessor` - Type-safe storage access
- Storage providers for dependency injection

**Example:**
```typescript
import { FullLocalStorageObject } from '@dereekb/dbx-core';

const storage = new FullLocalStorageObject(localStorage);

// Check availability
if (storage.isAvailable) {
  storage.setItem('key', 'value');
  const value = storage.getItem('key');
}
```

**Package Location:** `packages/dbx-core/src/lib/storage/`

### Context

Context management and store utilities using RxJS for hierarchical state management.

**Key Exports:**
- `DbxAppContextService` - App context state with ngrx
- `AbstractDbxDirectiveWithContextStore` - Base directive with context
- Context provider utilities

**Example:**
```typescript
import { DbxAppContextService } from '@dereekb/dbx-core';

@Component({...})
export class MyComponent {
  readonly context = inject(DbxAppContextService);

  ngOnInit() {
    this.context.state$.subscribe(state => {
      console.log('App context:', state);
    });
  }
}
```

**Package Location:** `packages/dbx-core/src/lib/context/`

### Auth

Authentication and authorization abstractions.

**Key Exports:**
- `DbxAuthService` - Abstract auth service for user state and roles
- Route guards for authentication
- Auth state observables

**Example:**
```typescript
import { DbxAuthService } from '@dereekb/dbx-core';

@Component({...})
export class MyComponent {
  readonly auth = inject(DbxAuthService);

  ngOnInit() {
    this.auth.isLoggedIn$.subscribe(loggedIn => {
      console.log('User logged in:', loggedIn);
    });

    this.auth.authUserState$.subscribe(userState => {
      console.log('User state:', userState);
    });
  }
}
```

**Key Observables:**
- `isLoggedIn$` - Whether user is logged in
- `isOnboarded$` - Whether user completed onboarding
- `authUserState$` - Current user state
- `authRoles$` - User roles
- `userIdentifier$` - User identifier

**Package Location:** `packages/dbx-core/src/lib/auth/`

### Environment

Environment configuration access for Angular applications.

**Key Exports:**
- `DbxAppEnviromentService` - Environment service
- `DbxAppEnviroment` - Environment interface

**Example:**
```typescript
import { DbxAppEnviromentService } from '@dereekb/dbx-core';

@Component({...})
export class MyComponent {
  readonly env = inject(DbxAppEnviromentService);

  ngOnInit() {
    console.log('Is production:', this.env.isProduction);
    console.log('Is staging:', this.env.isStaging);
    console.log('Is testing:', this.env.isTesting);

    // Get typed environment
    const customEnv = this.env.getEnvironment<MyCustomEnv>();
  }
}
```

**Package Location:** `packages/dbx-core/src/lib/environment/`

### Action

**→ See the [dbx-core-actions](#) skill for detailed guidance on actions**

Action handlers and action stores for managing asynchronous operations with loading/error states.

**Quick Example:**
```typescript
import { DbxActionStore } from '@dereekb/dbx-core';

readonly saveAction = new DbxActionStore({
  action: (value) => this.service.save(value)
});
```

**Package Location:** `packages/dbx-core/src/lib/action/`

### Button

Button components and directives for action integration and consistent button behavior.

**Key Exports:**
- Action button directives
- Button spacer components
- Loading and disabled state management

**Package Location:** `packages/dbx-core/src/lib/button/`

### Subscription

RxJS subscription management utilities for automatic cleanup.

**Key Exports:**
- `AbstractSubscriptionDirective` - Base directive with automatic unsubscription

**Example:**
```typescript
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';

@Component({...})
export class MyComponent extends AbstractSubscriptionDirective implements OnInit {
  ngOnInit() {
    // Subscription automatically cleaned up on destroy
    this.sub = this.data$.subscribe(data => {
      this.processData(data);
    });
  }
}
```

**Package Location:** `packages/dbx-core/src/lib/subscription/`

## Common Patterns

### Type-Safe Navigation

Define anchor constants for reusable navigation:

```typescript
export const APP_ANCHORS = {
  home: { ref: 'app.home' } as Anchor,
  userList: { ref: 'app.users.list' } as Anchor,
  userDetail: (id: string): Anchor => ({
    ref: 'app.users.detail',
    refParams: { id }
  })
};

// Usage in template
<dbx-anchor [anchor]="APP_ANCHORS.userDetail(user.id)">
  View Details
</dbx-anchor>
```

### Hierarchical Context

Use context stores for parent-child state sharing:

```typescript
// Parent provides context
@Component({
  providers: [MyContextStore]
})
export class ParentComponent {
  constructor(readonly context: MyContextStore) {
    context.next({ data: 'shared' });
  }
}

// Child injects parent's context
@Component({...})
export class ChildComponent {
  constructor(readonly context: MyContextStore) {
    // Gets parent's context automatically
  }
}
```

### Subscription Management

Always extend `AbstractSubscriptionDirective` for automatic cleanup:

```typescript
export class MyComponent extends AbstractSubscriptionDirective implements OnInit {
  ngOnInit() {
    this.sub = this.source$.subscribe(/* ... */);
    // Automatically unsubscribed on destroy
  }
}
```

## Best Practices

### Subscription Management

✅ **Do**: Extend `AbstractSubscriptionDirective` for components/directives
```typescript
export class MyComponent extends AbstractSubscriptionDirective {
  // Subscriptions automatically cleaned up
}
```

❌ **Don't**: Manually manage subscriptions without cleanup
```typescript
export class MyComponent {
  ngOnInit() {
    this.source$.subscribe(); // Memory leak!
  }
}
```

### Context Injection

✅ **Do**: Use hierarchical context providers
```typescript
@Component({
  providers: [MyContextStore]
})
export class ParentComponent {
  constructor(readonly context: MyContextStore) {}
}
```

### Type-Safe Routing

✅ **Do**: Define anchor constants for reusability
```typescript
export const MY_ANCHORS = {
  list: { ref: 'app.items.list' } as Anchor,
  detail: (id: string): Anchor => ({ ref: 'app.items.detail', refParams: { id } })
};
```

## Package Architecture

DBX Core is designed to be extended by platform-specific packages:

```
@dereekb/util (Pure TS utilities, no Angular)
    ↓
@dereekb/rxjs (RxJS utilities, no Angular)
    ↓
@dereekb/dbx-core (Angular utilities, platform-agnostic)
    ↓
@dereekb/dbx-web (Browser-specific Angular components)
    ↓
Application Code
```

## Related Packages

- **@dereekb/dbx-web** - Web-specific components built on dbx-core (Material Design, browser APIs)
- **@dereekb/util** - Pure TypeScript utilities (no Angular dependency)
- **@dereekb/rxjs** - RxJS utilities and patterns (FilterMap, LoadingState, etc.)

## Module Imports

Import specific modules to reduce bundle size:

```typescript
import { DbxRouterAnchorModule } from '@dereekb/dbx-core';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { DbxValuePipeModule } from '@dereekb/dbx-core';
```

Or use barrel imports for convenience:

```typescript
import {
  DbxRouterService,
  DbxInjectionComponent,
  Anchor,
  FilterMap
} from '@dereekb/dbx-core';
```

## Related Skills

- **dbx-injection** - Dynamic component injection (detailed)
- **dbx-filter** - Filter state management (detailed)
- **dbx-value-pipes** - Value transformation pipes (detailed)
- **dbx-core-actions** - Action system (detailed)
- **dbx-web** - Web-specific DBX components
- **angular-component** - Building Angular components
- **angular-signals** - Angular signals and reactive state
