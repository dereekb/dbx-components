---
name: dbx-components-test-dates
description: >
  Guide for running and writing date/timezone tests in the dbx-components workspace using Vitest.
  Use this skill whenever working with the @dereekb/date package tests, debugging timezone-sensitive
  failures, running date tests in a specific timezone, writing new date test cases, or when a date
  test fails and you need to understand the test setup. Also use when the user mentions timezone
  testing, TZ environment variable with tests, or date-related test failures in this workspace.
---

# Date Testing in dbx-components

The `@dereekb/date` package has 600+ tests that validate date/timezone logic across multiple timezones. This guide covers how the system works, how to run tests effectively, and how to write new tests following project conventions.

## How the Test Setup Works

### Timezone injection via environment variable

The Vitest config at `packages/date/vitest.config.mts` reads the `TZ` environment variable to determine which timezone the test suite runs under:

```ts
const timezone = process.env.TZ ?? Intl.DateTimeFormat()?.resolvedOptions()?.timeZone ?? 'utc';
```

This timezone value is passed into the test environment and used for JUnit report naming (e.g., `america-chicago.date.junit.xml`). When you set `TZ=America/Chicago`, every `new Date()` call and `Intl` operation inside the test process behaves as if the system clock is in Chicago.

### The wrapDateTests wrapper

Every date test file wraps its tests with `wrapDateTests()` from `packages/date/src/test.spec.ts`:

```ts
import { wrapDateTests } from '../../test.spec';

wrapDateTests(() => {
  describe('myFunction()', () => {
    it('should do something', () => { /* ... */ });
  });
});
```

This wrapper creates a top-level `describe` block labeled with the current timezone (e.g., `America/Chicago > myFunction() > should do something`), making test output clear about which timezone produced a failure.

### Real timers

Date test files typically call `vi.useRealTimers()` in a `beforeEach` to ensure they're working with the actual system clock, not mocked timers:

```ts
beforeEach(() => {
  vi.useRealTimers();
});
```

## Running Date Tests

### Run specific tests in a specific timezone

This is the most common operation. Use the `TZ` env var with `test-skip-build` and Vitest's `--testNamePattern` (`-t`) flag to target specific tests:

```bash
# Run tests matching "calculateTimezoneOffset" in America/Chicago
TZ=America/Chicago && echo $TZ && TZ=$TZ pnpm nx test-skip-build date --testNamePattern="calculateTimezoneOffset"

# Run tests in a specific file only
TZ=America/Chicago && echo $TZ && TZ=$TZ pnpm nx test-skip-build date --testPathPattern="date.timezone.spec"

# Combine both: specific file + specific test name
TZ=Pacific/Auckland && echo $TZ && TZ=$TZ pnpm nx test-skip-build date --testPathPattern="date.timezone.spec" --testNamePattern="daylight savings"
```

The `echo $TZ` confirms the timezone was set correctly in the output.

### Run all tests in a single timezone

```bash
TZ=America/Anchorage && echo $TZ && TZ=$TZ pnpm nx test-skip-build date
```

This runs all 600+ tests. Only do this when you need a full pass/fail for a specific timezone - it produces a lot of output.

### Common timezones to test with

Pick timezones that exercise different edge cases:

| Timezone | Offset | Why it's useful |
|---|---|---|
| `UTC` | +0:00 | Baseline, no offset |
| `America/Chicago` | -6/-5 | US Central, has DST |
| `America/New_York` | -5/-4 | US Eastern, has DST |
| `America/Anchorage` | -9/-8 | Large negative offset |
| `Pacific/Auckland` | +12/+13 | Next-day offset, has DST |
| `Pacific/Kiritimati` | +14 | Maximum positive offset |
| `Asia/Tokyo` | +9 | No DST, large positive |

When debugging a timezone-specific failure, test with the failing timezone plus UTC as a baseline comparison.

### Test targets in project.json

The `date` project defines these timezone test targets (all run sequentially with `parallel: false`):

- **`test-skip-build`** - Single run, uses current `TZ` or system default
- **`test-timezones-usa`** - Runs across 5 US timezones
- **`test-timezones-world`** - Runs across 7 international timezones
- **`test-timezones-local`** - Runs across all 12 timezones (comprehensive)

These batch targets are for CI or full validation. For development and debugging, run individual timezones with targeted test patterns.

## Writing New Date Tests

### File structure

Place test files alongside their implementation files in `packages/date/src/lib/`:

```
packages/date/src/lib/date/
├── date.timezone.ts
├── date.timezone.spec.ts    ← test file
├── date.format.ts
├── date.format.spec.ts      ← test file
```

### Basic test template

```ts
import { wrapDateTests } from '../../test.spec';
// import the functions you're testing
import { myDateFunction } from './my-date-module';

beforeEach(() => {
  vi.useRealTimers();
});

wrapDateTests(() => {
  describe('myDateFunction()', () => {
    it('should handle a basic date', () => {
      const result = myDateFunction(new Date('2024-06-15T12:00:00.000Z'));
      expect(result).toBeSameDayAs(new Date('2024-06-15T00:00:00.000Z'));
    });
  });
});
```

### Custom date matchers

The workspace provides custom Vitest matchers from `@dereekb/vitest` (auto-registered via setup). Use them instead of manual comparisons:

**Comparison matchers:**
- `expect(date).toBeBefore(otherDate)`
- `expect(date).toBeAfter(otherDate)`

**Same-period matchers:**
- `expect(date).toBeSameSecondAs(otherDate)`
- `expect(date).toBeSameMinuteAs(otherDate)`
- `expect(date).toBeSameHourAs(otherDate)`
- `expect(date).toBeSameDayAs(otherDate)`
- `expect(date).toBeSameWeekAs(otherDate)`
- `expect(date).toBeSameMonthAs(otherDate)`
- `expect(date).toBeSameQuarterAs(otherDate)`
- `expect(date).toBeSameYearAs(otherDate)`

**Day-of-week matchers:**
- `expect(date).toBeMonday()` through `expect(date).toBeSunday()`

These produce clear error messages with ISO timestamps, which is much more helpful for debugging than a raw `toBe()` comparison on timestamps.

### Testing timezone-sensitive logic

When writing tests for functions that behave differently across timezones, use explicit UTC timestamps so the test is deterministic regardless of system timezone:

```ts
// Good: explicit UTC timestamp, behavior varies by TZ
const utcNoon = new Date('2024-03-10T12:00:00.000Z');

// Bad: ambiguous, depends on system timezone
const noon = new Date(2024, 2, 10, 12, 0, 0);
```

For DST edge cases, test dates right around the transition boundary. For example, America/Chicago springs forward on March 10, 2024 at 2:00 AM local (08:00 UTC):

```ts
describe('daylight savings', () => {
  const justBefore = new Date('2024-03-10T07:59:59.000Z'); // 1:59 AM CST
  const atChange = new Date('2024-03-10T08:00:00.000Z');   // 3:00 AM CDT (skips 2 AM)

  it('should handle the offset before DST', () => {
    // offset is -6 hours (CST)
  });

  it('should handle the offset after DST', () => {
    // offset is -5 hours (CDT)
  });
});
```

### Keeping test runs focused

There are 600+ tests in this package. When developing or debugging, always filter:

```bash
# By test name pattern
--testNamePattern="specific test description"

# By file path pattern
--testPathPattern="date.timezone.spec"

# Both together for maximum precision
--testPathPattern="date.cell.spec" --testNamePattern="dateCellSchedule"
```

This prevents flooding your output with unrelated test results and keeps iteration fast.
