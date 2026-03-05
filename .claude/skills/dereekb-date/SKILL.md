---
name: date
description: Advanced date/time utilities from @dereekb/date - built on date-fns with support for timezones, recurring patterns (RRule), date ranges, cells, calendars, and expiration handling.
---

# @dereekb/date

## Overview

**@dereekb/date** provides advanced date and time utilities built on top of date-fns, offering comprehensive support for complex date operations, timezones, recurring patterns, and calendar management.

**Package Location:** `packages/date/`

**Key Features:**
- Date cells and scheduling (date blocks, time slots)
- Date ranges with timezone support
- Recurring patterns via RRule (RFC 5545)
- Timezone handling and conversion
- Expiration tracking and management
- Date queries and filtering
- Calendar utilities
- Built on date-fns for robust date operations

**Dependencies:**
- date-fns (peer dependency)
- date-fns-tz (timezones)
- rrule (recurrence rules)
- @dereekb/util

**Package Architecture:**
```
@dereekb/util
    ↓
@dereekb/date (+ date-fns, rrule)
    ↓
Used by: @dereekb/firebase, @dereekb/dbx-core
```

## Module Organization (5 modules)

### Date
Core date utilities including cells, ranges, formatting, and time operations.

**Location:** `packages/date/src/lib/date/`

**Key Concepts:**
- **Date Cells**: Discrete time blocks (15min, 30min, hourly, daily)
- **Date Ranges**: Start/end date pairs with operations
- **Formatting**: Consistent date/time string formatting
- **Time Operations**: Minutes, durations, rounding
- **Calendars**: Calendar utilities and date grids

**Representative Exports:**

**Date Cell System:**
- `DateCell` type - Discrete time block identifier
- `DateCellIndex` - Numeric index of date cell
- `DateCellFactory` - Create date cells from dates
- `dateCellFactory(config)` - Configure cell factory (15min, 30min, hourly, daily)
- `dateFromDateCell(cell)` - Convert cell to Date
- `dateCellRange(start, end)` - Create cell range
- `DateCellSchedule` - Weekly schedule of date cells
- `DateCellScheduleDay` - Single day schedule

**Date Ranges:**
- `DateRange` interface - Start/end date pair
- `dateRange(start, end)` - Create date range
- `dateRangeWithDuration(start, duration)` - Range from duration
- `dateRangesOverlap(a, b)` - Check overlap
- `mergeDateRanges(ranges)` - Combine ranges
- `dateRangeString(range)` - Format as string
- `parseDateRangeString(str)` - Parse from string

**Formatting:**
- `formatToISO(date)` - ISO 8601 format
- `formatToDate(date)` - Date-only format
- `formatToTime(date)` - Time-only format
- `formatToDateTime(date)` - Full date-time format
- `customDateFormat(date, format)` - Custom format string

**Time Operations:**
- `Minutes` type - Number of minutes
- `addMinutes(date, minutes)` - Add time
- `diffInMinutes(start, end)` - Calculate difference
- `minutesToDuration(minutes)` - Convert to duration
- `Duration` type - Time duration
- `durationToMinutes(duration)` - Convert to minutes

**Calendar Utilities:**
- `CalendarDate` - Calendar date representation
- `calendarMonth(date)` - Get month calendar
- `calendarWeek(date)` - Get week dates
- `daysInMonth(date)` - Days count

**Rounding:**
- `roundDownToMinute(date, minutes)` - Round down
- `roundUpToMinute(date, minutes)` - Round up
- `roundToNearestMinute(date, minutes)` - Nearest

**Unix Time:**
- `unixTimestamp(date)` - Date to unix seconds
- `dateFromUnixTime(unix)` - Unix to Date
- `unixTimeRange(range)` - Range to unix pair

**Common Patterns:**
```typescript
import {
  DateCell,
  dateCellFactory,
  DateRange,
  dateRange,
  dateRangesOverlap,
  formatToISO,
  addMinutes
} from '@dereekb/date';

// Date cells (time blocks)
const factory = dateCellFactory({ type: '30min' });
const cell = factory.cellForDate(new Date());
const date = factory.dateFromCell(cell);

// Date ranges
const range: DateRange = dateRange(startDate, endDate);
const overlaps = dateRangesOverlap(range1, range2);

// Formatting
const iso = formatToISO(date); // "2024-01-15T14:30:00Z"

// Time math
const later = addMinutes(now, 30);
```

**Use Cases:**
- Scheduling and calendar systems
- Time slot booking
- Meeting availability
- Date range filtering
- Time-based queries

### Expires
Expiration tracking and management utilities.

**Location:** `packages/date/src/lib/expires/`

**Key Concepts:**
- Expiration dates and checking
- Time-to-live (TTL) calculations
- Expiration policies
- Auto-expiring data

**Representative Exports:**
- `Expires` interface - Expiration data structure
- `expiresAt(date)` - Create expiration
- `isExpired(expires)` - Check if expired
- `expiresIn(minutes)` - Create TTL-based expiration
- `timeUntilExpiration(expires)` - Minutes until expires
- `expirationDate(expires)` - Get Date of expiration
- `ExpirationPolicy` - Policy for expiration behavior
- `expirationPolicy(config)` - Create policy

**Common Patterns:**
```typescript
import { Expires, expiresAt, isExpired, expiresIn } from '@dereekb/date';

// Create expiration
const expires: Expires = expiresAt(futureDate);
const ttlExpires: Expires = expiresIn(30); // 30 minutes

// Check expiration
if (isExpired(token.expires)) {
  // Token has expired
  refreshToken();
}

// Time remaining
const minutesLeft = timeUntilExpiration(session.expires);
if (minutesLeft < 5) {
  showExpirationWarning();
}
```

**Use Cases:**
- Session management
- Cache expiration
- Token expiration
- Temporary data
- Time-limited access

### Query
Date query utilities for filtering and searching by date.

**Location:** `packages/date/src/lib/query/`

**Key Concepts:**
- Date-based queries
- Date filters
- Date range queries
- Query builders

**Representative Exports:**
- `DateQuery` interface - Date query structure
- `dateQuery(config)` - Create date query
- `dateQueryFilter(query)` - Create filter function
- `dateInQuery(date, query)` - Check if date matches
- `DateRangeQuery` - Query with date range
- `dateRangeQuery(start, end)` - Create range query

**Common Patterns:**
```typescript
import { dateQuery, dateQueryFilter, DateRangeQuery } from '@dereekb/date';

// Date range query
const query: DateRangeQuery = {
  start: startDate,
  end: endDate
};

// Filter events by date
const filter = dateQueryFilter(query);
const matchingEvents = events.filter(event =>
  filter(event.date)
);

// Check if date matches query
if (dateInQuery(someDate, query)) {
  // Date is in range
}
```

**Use Cases:**
- Event filtering
- Date range searches
- Historical data queries
- Report date ranges

### RRule
Recurring date patterns using RRule (RFC 5545 recurrence rules).

**Location:** `packages/date/src/lib/rrule/`

**Key Concepts:**
- Recurrence rules (daily, weekly, monthly, yearly)
- Recurring event generation
- RRule parsing and serialization
- Custom recurrence patterns

**Representative Exports:**
- `DateRecurrence` interface - Recurrence configuration
- `dateRecurrence(config)` - Create recurrence
- `recurrenceDates(recurrence, range)` - Generate dates
- `RRuleString` type - RFC 5545 RRule string
- `parseRRule(string)` - Parse RRule string
- `toRRuleString(recurrence)` - Serialize to RRule
- `RRuleExtension` - Extend RRule functionality
- `rruleExtension(config)` - Create extension

**Common Patterns:**
```typescript
import {
  DateRecurrence,
  dateRecurrence,
  recurrenceDates,
  parseRRule,
  toRRuleString
} from '@dereekb/date';

// Weekly recurrence
const weekly: DateRecurrence = dateRecurrence({
  freq: 'WEEKLY',
  interval: 1,
  byweekday: ['MO', 'WE', 'FR'],
  dtstart: startDate
});

// Generate occurrence dates
const dates = recurrenceDates(weekly, {
  start: now,
  end: futureDate
});

// Parse RRule string
const rrule = 'FREQ=DAILY;INTERVAL=2;COUNT=10';
const recurrence = parseRRule(rrule);

// Serialize to RRule string
const rruleStr = toRRuleString(recurrence);
```

**Use Cases:**
- Recurring events (meetings, tasks)
- Subscription renewals
- Scheduled notifications
- Repeating availability
- Calendar event series

### Timezone
Timezone handling and conversion utilities.

**Location:** `packages/date/src/lib/timezone/`

**Key Concepts:**
- Timezone conversion
- Timezone-aware date operations
- Timezone validation
- UTC/local time conversion

**Representative Exports:**
- `Timezone` type - Timezone identifier (IANA)
- `systemTimezone()` - Get system timezone
- `toTimezone(date, tz)` - Convert to timezone
- `fromTimezone(date, tz)` - Convert from timezone
- `dateInTimezone(date, tz)` - Date string in timezone
- `timezoneOffset(tz, date)` - Get offset
- `isValidTimezone(tz)` - Validate timezone
- `timezoneValidator()` - Create validator

**Common Patterns:**
```typescript
import {
  Timezone,
  systemTimezone,
  toTimezone,
  fromTimezone,
  isValidTimezone
} from '@dereekb/date';

// Get system timezone
const userTz: Timezone = systemTimezone(); // "America/Los_Angeles"

// Convert to user's timezone
const localDate = toTimezone(utcDate, userTz);

// Convert from user's timezone to UTC
const utcDate = fromTimezone(localDate, userTz);

// Validate timezone
if (isValidTimezone(timezone)) {
  // Valid IANA timezone
}

// Get timezone offset
const offset = timezoneOffset('America/New_York', date);
```

**Use Cases:**
- Multi-timezone applications
- Scheduling across timezones
- User preference timezones
- International date display
- Timezone conversion

## Common Patterns

### Scheduling with Date Cells
```typescript
import {
  dateCellFactory,
  DateCellSchedule,
  dateFromDateCell
} from '@dereekb/date';

// Create 30-minute time slots
const factory = dateCellFactory({ type: '30min' });

// Build availability schedule
const schedule: DateCellSchedule = {
  monday: [8, 9, 10, 11, 14, 15, 16, 17], // Cell indices
  tuesday: [8, 9, 10, 11, 14, 15, 16, 17],
  // ... other days
};

// Convert cells to actual dates
const availableSlots = schedule.monday.map(cell =>
  dateFromDateCell(cell)
);
```

### Recurring Events with RRule
```typescript
import {
  dateRecurrence,
  recurrenceDates,
  DateRange,
  dateRange
} from '@dereekb/date';

// Every Monday at 2pm for 10 weeks
const recurrence = dateRecurrence({
  freq: 'WEEKLY',
  interval: 1,
  byweekday: ['MO'],
  byhour: [14],
  count: 10,
  dtstart: new Date()
});

// Generate all dates
const range: DateRange = dateRange(
  new Date(),
  addWeeks(new Date(), 12)
);

const meetingDates = recurrenceDates(recurrence, range);
```

### Timezone-Aware Date Ranges
```typescript
import {
  dateRange,
  toTimezone,
  fromTimezone,
  Timezone
} from '@dereekb/date';

const userTz: Timezone = 'America/Los_Angeles';

// User selects dates in their timezone
const localStart = new Date('2024-01-15T09:00:00');
const localEnd = new Date('2024-01-15T17:00:00');

// Convert to UTC for storage
const utcRange = dateRange(
  fromTimezone(localStart, userTz),
  fromTimezone(localEnd, userTz)
);

// Convert back for display
const displayStart = toTimezone(utcRange.start, userTz);
```

### Expiration with Auto-Refresh
```typescript
import { Expires, expiresIn, isExpired, timeUntilExpiration } from '@dereekb/date';

class TokenManager {
  private token: string;
  private expires: Expires;

  constructor() {
    this.refreshToken();
  }

  getToken(): string {
    // Auto-refresh if expiring soon
    if (timeUntilExpiration(this.expires) < 5) {
      this.refreshToken();
    }
    return this.token;
  }

  private refreshToken() {
    this.token = fetchNewToken();
    this.expires = expiresIn(60); // 60 minutes
  }
}
```

## Best Practices

### DO:
- **Use DateCell for scheduling** - Discrete time blocks prevent edge cases
- **Store dates in UTC** - Convert to user timezone for display only
- **Use RRule for recurring events** - Standard, well-tested format
- **Validate timezones** - Always check user-provided timezone strings
- **Use date-fns functions** - @dereekb/date builds on date-fns
- **Handle timezone conversions carefully** - Always specify source and target timezones

### DON'T:
- **Don't store dates in local timezone** - Always use UTC for storage
- **Don't manually parse RRule strings** - Use provided parsers
- **Don't assume timezone** - Always explicitly specify timezone
- **Don't ignore expiration checks** - Check before using expired data
- **Don't create custom recurrence logic** - Use RRule standard
- **Don't mix Date and string types** - Use Date objects consistently

### Performance:
- Date cell operations are O(1) for lookups
- RRule date generation is cached when possible
- Timezone conversions use date-fns-tz (optimized)
- Date range operations are optimized for common cases

## Integration with Other Packages

### @dereekb/util
```typescript
import { Maybe } from '@dereekb/util';
import { DateRange, dateRange } from '@dereekb/date';

// Combine util types with date utilities
function createOptionalRange(
  start: Maybe<Date>,
  end: Maybe<Date>
): Maybe<DateRange> {
  return start && end ? dateRange(start, end) : undefined;
}
```

### @dereekb/firebase
```typescript
import { dateRange, Expires } from '@dereekb/date';
import { FirestoreDocument } from '@dereekb/firebase';

// Store date ranges in Firestore
interface EventDoc {
  range: DateRange;
  expires: Expires;
}
```

### @dereekb/dbx-core
```typescript
import { DateRange, formatToDate } from '@dereekb/date';
import { Component } from '@angular/core';

// Use in Angular components
@Component({
  template: `
    <div>{{ range.start | date:'short' }} - {{ range.end | date:'short' }}</div>
  `
})
export class EventComponent {
  range: DateRange;
}
```

## Related Packages

### Direct Dependencies:
- **[@dereekb/util](../../../packages/util/)** - Foundational utilities
  - Use util's date module for basic operations
  - Use @dereekb/date for complex timezone/recurrence operations
- **date-fns** - Core date operations
- **rrule** - Recurrence rule handling

### Packages that Depend on @dereekb/date:
- **[@dereekb/firebase](../../../packages/firebase/)** - Uses DateRange, Expires
- **[@dereekb/dbx-core](../../../packages/dbx-core/)** - Uses date formatting, ranges

### When to Use Other Packages:
- **Need basic date operations?** → Use @dereekb/util (date module)
- **Need Angular date pipes?** → Use @angular/common (DatePipe)
- **Need Firebase Timestamps?** → Use @dereekb/firebase (extends date utilities)

## Quick Module Finder

**I need to...**
- Work with time slots/blocks → `date` module (DateCell)
- Handle date ranges → `date` module (DateRange)
- Format dates → `date` module (formatting utilities)
- Track expiration → `expires` module
- Filter by date → `query` module
- Create recurring events → `rrule` module
- Handle timezones → `timezone` module

## Additional Resources

- **Package Catalog:** [.agent/PACKAGES.md](../../PACKAGES.md)
- **Source Code:** [packages/date/src/lib/](../../../packages/date/src/lib/)
- **Changelog:** [packages/date/CHANGELOG.md](../../../packages/date/CHANGELOG.md)
- **date-fns docs:** https://date-fns.org/
- **RRule spec:** RFC 5545 (iCalendar)

## Package Stats

- **Modules:** 5 modules (date, expires, query, rrule, timezone)
- **Dependencies:** date-fns, date-fns-tz, rrule, @dereekb/util
- **Used By:** @dereekb/firebase, @dereekb/dbx-core
- **Key Features:** DateCell, RRule, Timezone conversion
