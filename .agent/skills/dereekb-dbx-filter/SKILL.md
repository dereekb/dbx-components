---
name: dbx-filter
description: Reactive filter state management system from @dereekb/dbx-core. Use when managing filter state across components, creating filter sources, connecting filters with FilterMap, implementing filter presets, or building filterable lists/tables. Triggers on mentions of FilterMap, FilterSource, DbxFilterMapSourceConnectorDirective, filter state management, or ClickableFilterPreset.
---

# DBX Filter (@dereekb/dbx-core)

## Overview

**dbx-filter** provides a reactive filter state management system for Angular applications. It enables components to share and manage filter state using RxJS observables, with support for multiple filter keys, default values, presets, and connector directives.

**Key Features:**
- Centralized filter state with `FilterMap`
- Multiple independent filter keys in one map
- Filter source and connector directives
- Preset and partial preset support
- Type-safe filter definitions

## Core Concepts

### FilterMap

The central manager for filter state. It maintains multiple filters identified by keys and provides observables for each.

**Usage:**
```typescript
import { FilterMap } from '@dereekb/rxjs';

interface MyFilter {
  search?: string;
  date?: Date;
  status?: string;
}

@Component({
  providers: [FilterMap],
  template: `...`
})
export class MyComponent implements OnDestroy {
  readonly filterMap = inject(FilterMap<MyFilter>);

  readonly searchFilterKey = 'search';
  readonly filter$ = this.filterMap.filterForKey(this.searchFilterKey);

  constructor() {
    // Set default filter
    this.filterMap.addDefaultFilterObs(this.searchFilterKey, of({ status: 'active' }));
  }

  ngOnDestroy() {
    this.filterMap.destroy();
  }
}
```

**Key Methods:**
- `filterForKey(key)` - Get filter observable for a specific key
- `addDefaultFilterObs(key, obs)` - Set default filter for a key
- `setFilter(key, filter)` - Manually set filter value
- `destroy()` - Clean up resources

### FilterSource & FilterSourceDirective

Provides filter observables that can be consumed by other components.

**Abstract Base Class:**
```typescript
import { AbstractFilterSourceDirective } from '@dereekb/dbx-core';

@Directive({
  selector: '[myFilterSource]',
  providers: provideFilterSourceDirective(MyFilterSourceDirective),
  standalone: true
})
export class MyFilterSourceDirective extends AbstractFilterSourceDirective<MyFilter> {
  // Automatically manages filter$ observable
}
```

**Using a Filter Source:**
```typescript
@Component({
  template: `
    <div myFilterSource>
      <!-- Filter source is provided here -->
    </div>
  `
})
export class MyComponent {
  readonly filterSource = inject(FilterSource<MyFilter>);

  ngOnInit() {
    this.filterSource.filter$.subscribe(filter => {
      console.log('Filter changed:', filter);
    });
  }
}
```

### Filter Connector Directives

Connect filters between sources and consumers.

**DbxFilterMapSourceConnectorDirective:**

Connects a FilterMap key to be a FilterSource:

```typescript
import { DbxFilterMapSourceConnectorDirective } from '@dereekb/dbx-core';

@Component({
  template: `
    <div [dbxFilterMapSourceConnector]="filterKey">
      <!-- This div now provides FilterSource from FilterMap -->
      <child-component></child-component>
    </div>
  `,
  imports: [DbxFilterMapSourceConnectorDirective]
})
export class ParentComponent {
  readonly filterKey = 'myFilter';
}
```

**DbxFilterConnectSourceDirective:**

Connects a component to a FilterSource and FilterMap:

```typescript
import { DbxFilterConnectSourceDirective } from '@dereekb/dbx-core';

@Component({
  template: `
    <div [dbxFilterConnectSource]="filterKey">
      <!-- Connects parent FilterSource to local FilterMap -->
    </div>
  `,
  imports: [DbxFilterConnectSourceDirective]
})
```

## Filter Presets

### ClickableFilterPreset

Preset filter configurations that can be selected by users.

```typescript
import { ClickableFilterPreset } from '@dereekb/dbx-core';

interface MyFilter extends FilterWithPreset<'all' | 'active' | 'archived'> {
  status?: string;
  preset?: 'all' | 'active' | 'archived';
}

const presets: ClickableFilterPreset<MyFilter>[] = [
  {
    preset: 'all',
    title: 'All Items',
    icon: 'list',
    presetValue: { preset: 'all' }
  },
  {
    preset: 'active',
    title: 'Active',
    icon: 'check_circle',
    presetValue: { preset: 'active', status: 'active' }
  },
  {
    preset: 'archived',
    title: 'Archived',
    icon: 'archive',
    presetValue: { preset: 'archived', status: 'archived' }
  }
];
```

### ClickablePartialFilterPreset

Partial filter presets that modify only specific filter properties:

```typescript
import { ClickablePartialFilterPreset } from '@dereekb/dbx-core';

interface MyFilter {
  search?: string;
  showHidden?: boolean;
}

const partialPresets: ClickablePartialFilterPreset<MyFilter>[] = [
  {
    title: 'Show Hidden',
    icon: 'visibility',
    partialPresetValue: { showHidden: true },
    isActive: (filter) => filter?.showHidden === true
  },
  {
    title: 'Hide Hidden',
    icon: 'visibility_off',
    partialPresetValue: { showHidden: false },
    isActive: (filter) => filter?.showHidden === false
  }
];
```

## Common Patterns

### Multiple Filter Keys

Manage multiple independent filters in one component:

```typescript
@Component({
  providers: [FilterMap],
  template: `
    <div [dbxFilterMapSourceConnector]="listFilterKey">
      <app-list></app-list>
    </div>

    <div [dbxFilterMapSourceConnector]="detailFilterKey">
      <app-detail></app-detail>
    </div>
  `
})
export class MyComponent implements OnDestroy {
  readonly filterMap = inject(FilterMap<MyFilter>);

  readonly listFilterKey = 'list';
  readonly detailFilterKey = 'detail';

  readonly listFilter$ = this.filterMap.filterForKey(this.listFilterKey);
  readonly detailFilter$ = this.filterMap.filterForKey(this.detailFilterKey);

  constructor() {
    this.filterMap.addDefaultFilterObs(this.listFilterKey, of({}));
    this.filterMap.addDefaultFilterObs(this.detailFilterKey, of({}));
  }

  ngOnDestroy() {
    this.filterMap.destroy();
  }
}
```

### Filter with Presets

Use presets to provide quick filter options:

```typescript
import { DOC_INTERACTION_TEST_PRESETS } from './presets';

@Component({
  providers: [FilterMap],
  template: `
    <app-filter-preset-menu
      [presets]="presets"
      [dbxFilterConnectSource]="filterKey">
    </app-filter-preset-menu>

    <div [dbxFilterMapSourceConnector]="filterKey">
      <app-filtered-list></app-filtered-list>
    </div>
  `
})
export class MyComponent {
  readonly filterMap = inject(FilterMap<MyFilter>);
  readonly filterKey = 'main';
  readonly presets = DOC_INTERACTION_TEST_PRESETS;

  constructor() {
    this.filterMap.addDefaultFilterObs(this.filterKey, of({}));
  }
}
```

### Display Filter State

Convert filter to display information for UI:

```typescript
@Component({...})
export class MyComponent {
  readonly filter$ = this.filterMap.filterForKey(this.filterKey);

  readonly displayForFilter$: Observable<DbxButtonDisplay> = this.filter$.pipe(
    map((filter) => {
      if (filter?.date) {
        return {
          icon: 'event',
          text: formatToISO8601DayStringForSystem(filter.date)
        };
      } else {
        return {
          icon: 'event',
          text: 'No Date'
        };
      }
    })
  );
}
```

### Convert Filter to Signal

Use Angular signals with filters:

```typescript
import { toSignal } from '@angular/core/rxjs-interop';

@Component({...})
export class MyComponent {
  readonly filter$ = this.filterMap.filterForKey(this.filterKey);
  readonly filterSignal = toSignal(this.filter$);

  // Use in template or computed signals
}
```

### Filter Transformation

Transform filters before passing to child components:

```typescript
@Component({
  providers: [FilterMap]
})
export class ParentComponent {
  readonly filterMap = inject(FilterMap<MyFilter>);
  readonly rawFilter$ = this.filterMap.filterForKey('raw');

  readonly transformedFilter$ = this.rawFilter$.pipe(
    map(filter => ({
      ...filter,
      // Add computed properties
      hasFilters: !!(filter.search || filter.date)
    }))
  );
}
```

## Best Practices

### Filter Map Lifecycle

✅ **Do**: Provide FilterMap at component level
```typescript
@Component({
  providers: [FilterMap]
})
export class MyComponent implements OnDestroy {
  ngOnDestroy() {
    this.filterMap.destroy();
  }
}
```

❌ **Don't**: Forget to destroy FilterMap
```typescript
@Component({
  providers: [FilterMap]
})
export class MyComponent {
  // Missing ngOnDestroy - memory leak!
}
```

### Type-Safe Filters

✅ **Do**: Define filter interfaces
```typescript
interface MyFilter {
  search?: string;
  dateRange?: { start: Date; end: Date };
  status?: 'active' | 'archived';
}

const filterMap = inject(FilterMap<MyFilter>);
```

❌ **Don't**: Use untyped filters
```typescript
const filterMap = inject(FilterMap); // No type safety
```

### Default Filters

✅ **Do**: Set meaningful defaults
```typescript
constructor() {
  this.filterMap.addDefaultFilterObs(
    this.filterKey,
    of({ status: 'active', limit: 20 })
  );
}
```

### Connector Organization

✅ **Do**: Use connectors to establish clear filter hierarchies
```typescript
<div [dbxFilterMapSourceConnector]="parentKey">
  <child [dbxFilterConnectSource]="childKey"></child>
</div>
```

## Integration with DBX Web

DBX Web provides additional filter components:

- **Filter Popover Buttons** - Buttons that open filter popovers
- **Filter Preset Menus** - Menus for selecting filter presets
- **Filter Preset Components** - Displays active preset state

Example:
```typescript
import { DbxFilterPopoverButtonComponent } from '@dereekb/dbx-web';

<dbx-filter-popover-button
  [dbxFilterConnectSource]="filterKey"
  [display]="displayForFilter$">
</dbx-filter-popover-button>
```

## Package Location

```
packages/dbx-core/src/lib/filter/
├── filter.content.ts                        # Provider helpers
├── filter.abstract.source.directive.ts      # FilterSourceDirective base
├── filter.source.directive.ts               # Basic filter source
├── filter.connector.directive.ts            # DbxFilterConnectorDirective
├── filter.connect.source.directive.ts       # DbxFilterConnectSourceDirective
├── filter.map.connector.directive.ts        # DbxFilterMapConnectorDirective
├── filter.map.source.directive.ts           # DbxFilterMapSourceConnectorDirective
├── filter.preset.ts                         # Preset types
└── filter.module.ts                         # Module exports
```

## Related Skills

- **dbx-core** - Overview of all @dereekb/dbx-core utilities
- **dereekb-rxjs-loading** - FilterMap is from @dereekb/rxjs package
