---
name: dbx-value-pipes
description: Angular value transformation pipes from @dereekb/dbx-core. Use when transforming values in templates, formatting currency/numbers, truncating text, resolving getters, or working with date/time formatting. Triggers on mentions of pipe usage, GetValuePipe, CutTextPipe, DollarAmountPipe, date formatting pipes, or value transformation in Angular templates.
---

# DBX Value Pipes (@dereekb/dbx-core)

## Overview

**dbx-value-pipes** provides a comprehensive set of Angular pipes for value transformation in templates. These pipes handle common data formatting needs including text manipulation, getter resolution, currency formatting, and date/time operations.

**Key Features:**
- Value getter resolution with `getValue`
- Text truncation with `cutText`
- Currency formatting with `dollarAmount`
- Extensive date/time formatting pipes
- Observable conversion with `asObservable`
- JSON pretty-printing with `prettyJson`

## Value Pipes

### GetValuePipe / GetValueOncePipe

Resolves `GetterOrValue<T>` types - values that can be either a direct value or a function that returns a value.

```typescript
import { GetValuePipe, GetValueOncePipe } from '@dereekb/dbx-core';

@Component({
  template: `
    <!-- Non-pure pipe - re-evaluates on change detection -->
    <p>{{ getter | getValue }}</p>

    <!-- Pure pipe - evaluates once -->
    <p>{{ getter | getValueOnce }}</p>

    <!-- With arguments -->
    <p>{{ getter | getValue:args }}</p>
  `,
  imports: [GetValuePipe, GetValueOncePipe]
})
export class MyComponent {
  // Can be a value
  getter: GetterOrValue<string> = 'Hello';

  // Or a function
  getter: GetterOrValue<string> = () => 'World';

  // Or a function with arguments
  getter: GetterOrValue<string> = (args) => `Hello ${args.name}`;
  args = { name: 'Claude' };
}
```

**Key Differences:**
- `getValue` - Non-pure pipe, re-evaluates on every change detection
- `getValueOnce` - Pure pipe, evaluates once per input reference change

### CutTextPipe

Truncates text to a maximum length and adds ellipsis.

```typescript
import { CutTextPipe } from '@dereekb/dbx-core';

@Component({
  template: `
    <!-- Cut to 50 characters -->
    <p>{{ longText | cutText:50 }}</p>

    <!-- Custom end text -->
    <p>{{ longText | cutText:50:'...' }}</p>

    <!-- Handles null/undefined -->
    <p>{{ maybeText | cutText:20 }}</p>
  `,
  imports: [CutTextPipe]
})
export class MyComponent {
  longText = 'This is a very long piece of text that will be truncated';
  maybeText: string | undefined = undefined;
}
```

**Parameters:**
- `maxLength: number` - Maximum length before truncation
- `endText?: string` - Custom ellipsis text (default: '...')

### DollarAmountPipe

Formats numbers as dollar amounts with proper currency formatting.

```typescript
import { DollarAmountPipe } from '@dereekb/dbx-core';

@Component({
  template: `
    <!-- Format as currency -->
    <p>{{ price | dollarAmount }}</p>
    <!-- Output: $12.99 -->

    <!-- Handle null with default -->
    <p>{{ maybePrice | dollarAmount:'N/A' }}</p>
    <!-- Output: N/A (if maybePrice is null) -->

    <!-- Large amounts -->
    <p>{{ largeAmount | dollarAmount }}</p>
    <!-- Output: $1,234.56 -->
  `,
  imports: [DollarAmountPipe]
})
export class MyComponent {
  price = 12.99;
  maybePrice: number | null = null;
  largeAmount = 1234.56;
}
```

**Parameters:**
- `input: Maybe<number>` - The number to format
- `defaultIfNull?: string` - Default text when input is null/undefined

## Date Pipes

DBX Core provides extensive date formatting pipes for various use cases.

### Common Date Pipes

```typescript
import {
  DateDayRangePipe,
  DateTimeRangePipe,
  DateDistancePipe,
  TimezoneAbbreviationPipe
} from '@dereekb/dbx-core';

@Component({
  template: `
    <!-- Format date range: "Jan 1 - Jan 5" -->
    <p>{{ dateRange | dateDayRange }}</p>

    <!-- Format date/time range: "Jan 1, 2pm - 3pm" -->
    <p>{{ dateTimeRange | dateTimeRange }}</p>

    <!-- Time distance: "2 hours ago" -->
    <p>{{ pastDate | dateDistance }}</p>

    <!-- Timezone abbreviation: "PST" -->
    <p>{{ timezone | timezoneAbbreviation }}</p>
  `,
  imports: [
    DateDayRangePipe,
    DateTimeRangePipe,
    DateDistancePipe,
    TimezoneAbbreviationPipe
  ]
})
export class MyComponent {
  dateRange = { start: new Date('2024-01-01'), end: new Date('2024-01-05') };
  dateTimeRange = { start: new Date(), end: addHours(new Date(), 1) };
  pastDate = subHours(new Date(), 2);
  timezone = 'America/Los_Angeles';
}
```

### Available Date Pipes

**Range Formatting:**
- `dateDayRange` - Format day ranges (e.g., "Jan 1 - Jan 5")
- `dateDayTimeRange` - Format day with time ranges
- `dateTimeRange` - Format full date/time ranges
- `dateTimeRangeOnly` - Time range only (e.g., "2pm - 3pm")

**Distance/Relative:**
- `dateDistance` - Relative time (e.g., "2 hours ago")
- `dateFormatDistance` - Custom distance formatting
- `dateRangeDistance` - Distance for date ranges
- `timeDistance` - Time-only distance

**Conversion:**
- `systemDateToTargetDate` - Convert system timezone to target
- `targetDateToSystemDate` - Convert target timezone to system
- `toJsDate` - Convert to JavaScript Date
- `toMinutes` - Convert to minutes
- `minutesString` - Format minutes as string

## Misc Pipes

### PrettyJsonPipe

Format JSON objects with proper indentation for display.

```typescript
import { PrettyJsonPipe } from '@dereekb/dbx-core';

@Component({
  template: `
    <!-- Pretty print JSON -->
    <pre>{{ data | prettyJson }}</pre>

    <!-- Custom indentation -->
    <pre>{{ data | prettyJson:4 }}</pre>
  `,
  imports: [PrettyJsonPipe]
})
export class MyComponent {
  data = { name: 'Claude', role: 'Assistant', active: true };
}
```

## Async Pipes

### AsObservablePipe

Convert non-observable values to observables for template async pipe usage.

```typescript
import { AsObservablePipe } from '@dereekb/dbx-core';

@Component({
  template: `
    <!-- Convert to observable then use async -->
    <p>{{ value | asObservable | async }}</p>

    <!-- Useful for unified template patterns -->
    <ng-container *ngIf="(value | asObservable | async) as data">
      {{ data }}
    </ng-container>
  `,
  imports: [AsObservablePipe, AsyncPipe]
})
export class MyComponent {
  value = 'Can be value or observable';
}
```

## Module Imports

Import specific pipe modules to reduce bundle size:

```typescript
// Individual modules
import { DbxValuePipeModule } from '@dereekb/dbx-core';
import { DbxDatePipeModule } from '@dereekb/dbx-core';
import { DbxMiscPipeModule } from '@dereekb/dbx-core';
import { DbxAsyncPipeModule } from '@dereekb/dbx-core';

@Component({
  imports: [DbxValuePipeModule, DbxDatePipeModule]
})
```

Or import individual pipes (recommended for standalone components):

```typescript
import { CutTextPipe, GetValuePipe, DollarAmountPipe } from '@dereekb/dbx-core';

@Component({
  imports: [CutTextPipe, GetValuePipe, DollarAmountPipe],
  standalone: true
})
```

## Common Patterns

### Chaining Pipes

Combine pipes for complex transformations:

```typescript
@Component({
  template: `
    <!-- Get value, then truncate -->
    <p>{{ getter | getValue | cutText:50 }}</p>

    <!-- Format as currency with default -->
    <p>{{ priceGetter | getValue | dollarAmount:'Free' }}</p>

    <!-- Convert to observable and use async -->
    <p>{{ value | asObservable | async | cutText:100 }}</p>
  `
})
```

### Conditional Formatting

Use pipes with conditional logic:

```typescript
@Component({
  template: `
    <!-- Show formatted or default -->
    <p>{{ price ? (price | dollarAmount) : 'Contact for pricing' }}</p>

    <!-- Conditional truncation -->
    <p [class.truncated]="text.length > 50">
      {{ text | cutText:50 }}
    </p>
  `
})
```

### Dynamic Pipe Parameters

Pass dynamic values to pipes:

```typescript
@Component({
  template: `
    <!-- Dynamic truncation length -->
    <p>{{ text | cutText:maxLength }}</p>

    <!-- Dynamic date formatting -->
    <p>{{ dateRange | dateDayRange:format }}</p>
  `
})
export class MyComponent {
  maxLength = 100;
  format = 'short';
}
```

## Best Practices

### Pure vs Impure Pipes

✅ **Do**: Use `getValueOnce` (pure) when value doesn't change frequently
```typescript
<p>{{ staticGetter | getValueOnce }}</p>
```

✅ **Do**: Use `getValue` (impure) when value changes dynamically
```typescript
<p>{{ dynamicGetter | getValue }}</p>
```

❌ **Don't**: Overuse impure pipes (performance impact)

### Null Safety

✅ **Do**: Handle null/undefined values
```typescript
<p>{{ maybeText | cutText:50 }}</p> <!-- Pipe handles null -->
<p>{{ maybePrice | dollarAmount:'N/A' }}</p> <!-- Explicit default -->
```

### Module Imports

✅ **Do**: Import only needed pipes for standalone components
```typescript
@Component({
  imports: [CutTextPipe, DollarAmountPipe],
  standalone: true
})
```

❌ **Don't**: Import all pipe modules globally (increases bundle size)

### Date Formatting

✅ **Do**: Use specialized date pipes for consistent formatting
```typescript
<p>{{ range | dateDayRange }}</p>
```

❌ **Don't**: Format dates manually in component logic
```typescript
// Avoid this - use pipes instead
get formattedDate() {
  return `${this.start.toLocaleDateString()} - ${this.end.toLocaleDateString()}`;
}
```

## Package Location

```
packages/dbx-core/src/lib/pipe/
├── value/
│   ├── cuttext.pipe.ts          # CutTextPipe
│   ├── getvalue.pipe.ts         # GetValuePipe, GetValueOncePipe
│   └── dollar.pipe.ts           # DollarAmountPipe
├── date/
│   ├── datedayrange.pipe.ts     # DateDayRangePipe
│   ├── datetimerange.pipe.ts    # DateTimeRangePipe
│   ├── datedistance.pipe.ts     # DateDistancePipe
│   └── ... (many more date pipes)
├── misc/
│   └── prettyjson.pipe.ts       # PrettyJsonPipe
├── async/
│   └── asobservable.pipe.ts     # AsObservablePipe
└── pipe.module.ts               # Combined module exports
```

## Related Skills

- **dbx-core** - Overview of all @dereekb/dbx-core utilities
- **angular-component** - Building Angular components that use pipes
