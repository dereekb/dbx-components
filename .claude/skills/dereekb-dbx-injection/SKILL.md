---
name: dbx-injection
description: Dynamic Angular component injection system from @dereekb/dbx-core. Use when dynamically injecting components at runtime, creating component configurations, displaying components in dialogs, or switching between views temporarily. Triggers on mentions of DbxInjectionComponent, DbxInjectionContextDirective, dynamic component injection, or component configuration creation.
---

# DBX Injection (@dereekb/dbx-core)

## Overview

**dbx-injection** provides a type-safe system for dynamically injecting Angular components at runtime. It's the foundation for displaying arbitrary components in dialogs, popovers, dynamic content areas, and temporary view contexts throughout the DBX ecosystem.

**Key Features:**
- Type-safe dynamic component injection
- Component initialization with data and custom injectors
- Temporary view switching with context management
- Template and ViewRef injection support

## Core Components

### DbxInjectionComponent

The primary component for injecting dynamic content into a view.

**Usage:**
```typescript
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';

@Component({
  template: `
    <dbx-injection [config]="dynamicConfig"></dbx-injection>
  `,
  imports: [DbxInjectionComponent]
})
export class MyComponent {
  dynamicConfig: DbxInjectionComponentConfig = {
    componentClass: MyDynamicComponent,
    init: (instance) => {
      instance.data = this.data;
    }
  };
}
```

**Inputs:**
- `config` - Observable or value of `DbxInjectionComponentConfig<T>`
- `template` - Observable or value of `DbxInjectionTemplateConfig<T>` (for template/ViewRef injection)

### DbxInjectionContextDirective

A directive for temporarily switching between views and injected components, similar to `*ngIf` but without destroying the original view.

**Usage:**
```typescript
import { DbxInjectionContextDirective, DbxInjectionContext } from '@dereekb/dbx-core';

@Component({
  template: `
    <div *dbxInjectionContext>
      <!-- Original content that can be temporarily hidden -->
      <p>Default view content</p>
    </div>
  `,
  imports: [DbxInjectionContextDirective]
})
export class MyComponent {
  readonly context = inject(DbxInjectionContext);

  async showTempComponent() {
    // Temporarily show a different component
    const result = await this.context.showContext({
      config: {
        componentClass: ConfirmationComponent,
        data: { message: 'Are you sure?' }
      },
      use: async (instance) => {
        // Wait for user interaction
        return instance.confirmed;
      }
    });

    // Original view is restored after promise resolves
    console.log('User confirmed:', result);
  }
}
```

**Key Methods:**
- `showContext<T, O>(config)` - Shows a component and returns a promise
- `resetContext()` - Clears the current context
- `setConfig(config)` - Manually set the injection config

## Configuration Types

### DbxInjectionComponentConfig

Configuration for injecting a component dynamically.

```typescript
interface DbxInjectionComponentConfig<T = unknown> {
  // Type of Component to initialize
  readonly componentClass: Type<T>;

  // (Optional) providers to provide to the existing injector
  readonly providers?: Maybe<StaticProvider[]>;

  // (Optional) Custom parent injector to use when creating the component
  readonly injector?: Maybe<Injector>;

  // (Optional) Module ref to use when creating the component
  readonly ngModuleRef?: NgModuleRef<unknown>;

  // (Optional) Custom initialization code when an instance is created
  readonly init?: Maybe<(instance: T) => void>;

  // Optional data to inject into the component
  readonly data?: Maybe<unknown>;
}
```

**Accessing Injected Data:**

The injected data is available via the `DBX_INJECTION_COMPONENT_DATA` injection token:

```typescript
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';

@Component({
  selector: 'my-dynamic-component',
  template: `<p>{{ data.message }}</p>`
})
export class MyDynamicComponent {
  readonly data = inject(DBX_INJECTION_COMPONENT_DATA);
}
```

### DbxInjectionTemplateConfig

Configuration for injecting templates or view refs.

```typescript
interface DbxInjectionTemplateConfig<T = unknown> {
  // Template ref to display
  readonly templateRef?: Maybe<TemplateRef<T>>;

  // View ref to inject
  readonly viewRef?: Maybe<ViewRef>;
}
```

### DbxInjectionContextConfig

Configuration used with `DbxInjectionContextDirective.showContext()`.

```typescript
interface DbxInjectionContextConfig<T> {
  // The component configuration
  config: DbxInjectionComponentConfig<T>;

  // Function that uses the component instance and returns a result
  use: (instance: T) => PromiseOrValue<O>;
}
```

## Common Patterns

### Dialog Content Injection

Display a component in a dialog:

```typescript
import { MatDialog } from '@angular/material/dialog';
import { DbxInjectionDialogComponent } from '@dereekb/dbx-web';

@Component({...})
export class MyComponent {
  readonly dialog = inject(MatDialog);

  openDialog() {
    this.dialog.open(DbxInjectionDialogComponent, {
      data: {
        componentClass: MyDialogContentComponent,
        init: (instance) => {
          instance.title = 'Hello';
          instance.data = this.data;
        }
      } as DbxInjectionComponentConfig
    });
  }
}
```

### Temporary View Context

Use `DbxInjectionContextDirective` for temporary overlays or confirmations:

```typescript
@Component({
  template: `
    <div *dbxInjectionContext>
      <button (click)="showConfirmation()">Delete Item</button>
    </div>
  `
})
export class MyComponent {
  readonly context = inject(DbxInjectionContext);

  async showConfirmation() {
    try {
      await this.context.showContext({
        config: {
          componentClass: ConfirmDeleteComponent,
          data: { itemName: 'Important File' }
        },
        use: async (instance) => {
          // Wait for confirmation
          if (!instance.confirmed) {
            throw new Error('Cancelled');
          }
        }
      });

      // User confirmed - proceed with deletion
      this.deleteItem();
    } catch (e) {
      // User cancelled - do nothing
    }
  }
}
```

### Custom Providers

Inject custom providers into the dynamic component:

```typescript
const config: DbxInjectionComponentConfig = {
  componentClass: MyComponent,
  providers: [
    { provide: MY_TOKEN, useValue: myValue },
    MyService
  ],
  init: (instance) => {
    // Instance has access to MY_TOKEN and MyService
  }
};
```

### Factory Pattern

Create reusable injection configurations:

```typescript
export type UserDetailInjectionFactory =
  DbxInjectionComponentConfigFactory<string, UserDetailComponent>;

export const userDetailInjectionFactory: UserDetailInjectionFactory = (userId) => ({
  componentClass: UserDetailComponent,
  init: (instance) => {
    instance.userId = userId;
  }
});

// Usage
const config = userDetailInjectionFactory('user-123');
```

### Merging Configurations

Combine multiple partial configurations:

```typescript
import { mergeDbxInjectionComponentConfigs } from '@dereekb/dbx-core';

const baseConfig: Partial<DbxInjectionComponentConfig> = {
  providers: [CommonService]
};

const specificConfig: Partial<DbxInjectionComponentConfig> = {
  componentClass: MyComponent,
  init: (instance) => instance.data = this.data
};

const mergedConfig = mergeDbxInjectionComponentConfigs([
  baseConfig,
  specificConfig
]);
```

## Best Practices

### Type Safety

✅ **Do**: Type your injection configs with the component type
```typescript
const config: DbxInjectionComponentConfig<MyComponent> = {
  componentClass: MyComponent,
  init: (instance) => {
    instance.typedProperty = 'value'; // Fully typed!
  }
};
```

❌ **Don't**: Use untyped configs
```typescript
const config: DbxInjectionComponentConfig = {
  componentClass: MyComponent,
  init: (instance) => {
    instance.prop = 'value'; // No type checking!
  }
};
```

### Data Injection

✅ **Do**: Use the `data` property for simple data passing
```typescript
config: {
  componentClass: MyComponent,
  data: { userId: '123', mode: 'edit' }
}
```

✅ **Do**: Use `init` for complex initialization
```typescript
config: {
  componentClass: MyComponent,
  init: (instance) => {
    instance.complexSetup();
    instance.subscribeToSources();
  }
}
```

### Cleanup

✅ **Do**: Implement `OnDestroy` in injected components
```typescript
@Component({...})
export class MyInjectedComponent implements OnDestroy {
  ngOnDestroy() {
    // Clean up subscriptions, timers, etc.
  }
}
```

### Context Management

✅ **Do**: Handle promise rejections when using `showContext`
```typescript
try {
  await this.context.showContext({...});
} catch (e) {
  // User cancelled or error occurred
}
```

## Integration with DBX Web

**DbxInjectionDialogComponent** (from `@dereekb/dbx-web`) uses dbx-injection to display components in Material dialogs:

```typescript
import { DbxInjectionDialogComponent } from '@dereekb/dbx-web';

this.dialog.open(DbxInjectionDialogComponent, {
  data: injectionConfig // DbxInjectionComponentConfig
});
```

## Package Location

```
packages/dbx-core/src/lib/injection/
├── injection.ts                      # Config types and DBX_INJECTION_COMPONENT_DATA token
├── injection.component.ts            # DbxInjectionComponent
├── injection.context.directive.ts    # DbxInjectionContextDirective
├── injection.context.ts              # DbxInjectionContext interface
└── injection.instance.ts             # Internal instance management
```

## Related Skills

- **dbx-core** - Overview of all @dereekb/dbx-core utilities
- **dbx-web-actions** - Uses dbx-injection for action dialogs and popovers
