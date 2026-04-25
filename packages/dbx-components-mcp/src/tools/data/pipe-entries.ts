/**
 * Pipe cluster reference data for `dbx_pipe_lookup`.
 *
 * Curated entries describing the @dereekb/dbx-core Angular pipe surface —
 * value pipes (`dollarAmount`, `cutText`, `getValue` / `getValueOnce`),
 * the async helper (`asObservable`), the `prettyjson` debug pipe, and the
 * full date pipe family (distance, range, timezone, format helpers).
 *
 * Entries are pure data — no classes, no async init. Slugs are kebab-case
 * and unique. Pipe names match the live `@Pipe({ name })` value verbatim
 * (no fabricated entries).
 */

import { type Maybe } from '@dereekb/util';

/**
 * Kebab-case identifier used to look up a pipe entry. Unique within the
 * pipe registry.
 */
export type PipeRegistrySlug = string;

/**
 * The Angular pipe selector name as declared in `@Pipe({ name })` and used
 * inside templates (e.g. `{{ value | dollarAmount }}`).
 */
export type AngularPipeName = string;

/**
 * Fully-qualified TypeScript class name exported from the pipe module
 * (e.g. `DollarAmountPipe`).
 */
export type TypeScriptClassName = string;

/**
 * A serialized TypeScript type expression rendered for documentation
 * purposes (e.g. `Maybe<DateOrDateString>`, `Observable<T>`).
 */
export type TypeScriptTypeExpression = string;

/**
 * An npm package import path (e.g. `@dereekb/dbx-core`).
 */
export type NpmPackagePath = string;

/**
 * A repo-relative source file path (e.g.
 * `packages/dbx-core/src/lib/pipe/value/dollar.pipe.ts`).
 */
export type RepoRelativeSourcePath = string;

/**
 * Categorization for browse-friendly catalog grouping. Mirrors the on-disk
 * folder structure of `packages/dbx-core/src/lib/pipe/`.
 */
export type PipeCategory = 'value' | 'date' | 'async' | 'misc';

/**
 * Whether the pipe is `pure: true` (default — runs only when the reference
 * to its inputs change) or `pure: false` (runs on every change detection).
 */
export type PipePurity = 'pure' | 'impure';

/**
 * A documented argument supplied to the pipe transform on top of the piped
 * value (e.g. `{{ value | dollarAmount:'N/A' }}` — `'N/A'` is `defaultIfNull`).
 */
export interface PipeEntryArgInfo {
  readonly name: string;
  readonly type: TypeScriptTypeExpression;
  readonly description: string;
  readonly required: boolean;
}

/**
 * A single curated pipe entry surfaced through `dbx_pipe_lookup`.
 */
export interface PipeEntryInfo {
  readonly slug: PipeRegistrySlug;
  readonly category: PipeCategory;
  readonly pipeName: AngularPipeName;
  readonly className: TypeScriptClassName;
  readonly module: NpmPackagePath;
  readonly inputType: TypeScriptTypeExpression;
  readonly outputType: TypeScriptTypeExpression;
  readonly purity: PipePurity;
  readonly description: string;
  readonly args: readonly PipeEntryArgInfo[];
  readonly relatedSlugs: readonly PipeRegistrySlug[];
  readonly skillRefs: readonly string[];
  readonly sourcePath: RepoRelativeSourcePath;
  readonly example: string;
}

const DBX_CORE_MODULE: NpmPackagePath = '@dereekb/dbx-core';

export const PIPE_ENTRIES: readonly PipeEntryInfo[] = [
  // MARK: value
  {
    slug: 'dollar-amount',
    category: 'value',
    pipeName: 'dollarAmount',
    className: 'DollarAmountPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<number>',
    outputType: 'Maybe<string>',
    purity: 'pure',
    description: 'Formats a numeric value as a US dollar currency string (`$19.50`). Optionally falls back to a custom default string when the input is `null` or `undefined`.',
    args: [{ name: 'defaultIfNull', type: 'Maybe<string>', description: 'String to display when the input is `null` or `undefined`. Defaults to formatting `null` through `dollarAmountString`.', required: false }],
    relatedSlugs: [],
    skillRefs: ['dbx-value-pipes'],
    sourcePath: 'packages/dbx-core/src/lib/pipe/value/dollar.pipe.ts',
    example: `<span>{{ amount | dollarAmount }}</span>
<!-- $19.50 -->

<span>{{ nullValue | dollarAmount:'N/A' }}</span>
<!-- N/A -->`
  },
  {
    slug: 'cut-text',
    category: 'value',
    pipeName: 'cutText',
    className: 'CutTextPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<string>',
    outputType: 'Maybe<string>',
    purity: 'pure',
    description: 'Truncates the input string to a maximum length and appends a suffix (`…` by default).',
    args: [
      { name: 'maxLength', type: 'number', description: 'Maximum allowed length before truncation.', required: true },
      { name: 'endText', type: 'Maybe<string>', description: 'Suffix appended when truncation occurs.', required: false }
    ],
    relatedSlugs: [],
    skillRefs: ['dbx-value-pipes'],
    sourcePath: 'packages/dbx-core/src/lib/pipe/value/cuttext.pipe.ts',
    example: `<span>{{ 'Hello World' | cutText:5 }}</span>
<!-- Hello… -->

<span>{{ longText | cutText:20:'--' }}</span>`
  },
  {
    slug: 'get-value',
    category: 'value',
    pipeName: 'getValue',
    className: 'GetValuePipe',
    module: DBX_CORE_MODULE,
    inputType: 'GetterOrValue<T>',
    outputType: 'T',
    purity: 'impure',
    description: 'Resolves a `GetterOrValue<T>` to its underlying value. Impure — re-evaluates on every change-detection cycle so getter functions whose return value changes over time stay live.',
    args: [{ name: 'args', type: 'A | undefined', description: 'Optional argument forwarded to the getter function.', required: false }],
    relatedSlugs: ['get-value-once'],
    skillRefs: ['dbx-value-pipes'],
    sourcePath: 'packages/dbx-core/src/lib/pipe/value/getvalue.pipe.ts',
    example: `<span>{{ myGetterOrValue | getValue }}</span>
<span>{{ myGetterFn | getValue:someArg }}</span>`
  },
  {
    slug: 'get-value-once',
    category: 'value',
    pipeName: 'getValueOnce',
    className: 'GetValueOncePipe',
    module: DBX_CORE_MODULE,
    inputType: 'GetterOrValue<T>',
    outputType: 'T',
    purity: 'pure',
    description: 'Pure variant of `getValue`. Resolves a `GetterOrValue<T>` once per input reference change. Use when the getter is stable.',
    args: [{ name: 'args', type: 'A | undefined', description: 'Optional argument forwarded to the getter function.', required: false }],
    relatedSlugs: ['get-value'],
    skillRefs: ['dbx-value-pipes'],
    sourcePath: 'packages/dbx-core/src/lib/pipe/value/getvalue.pipe.ts',
    example: `<span>{{ myGetterOrValue | getValueOnce }}</span>`
  },
  // MARK: async
  {
    slug: 'as-observable',
    category: 'async',
    pipeName: 'asObservable',
    className: 'AsObservablePipe',
    module: DBX_CORE_MODULE,
    inputType: 'ObservableOrValueGetter<T>',
    outputType: 'Observable<T>',
    purity: 'pure',
    description: 'Normalizes a value, getter, or `Observable` into an `Observable` so it can be paired with the standard `async` pipe.',
    args: [],
    relatedSlugs: [],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/async/asobservable.pipe.ts',
    example: `<span>{{ valueOrGetter | asObservable | async }}</span>`
  },
  // MARK: misc
  {
    slug: 'prettyjson',
    category: 'misc',
    pipeName: 'prettyjson',
    className: 'PrettyJsonPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<unknown>',
    outputType: 'Maybe<string>',
    purity: 'pure',
    description: 'Pretty-prints a value as JSON with configurable indentation. Logs and returns `"ERROR"` when serialization throws.',
    args: [{ name: 'spacing', type: 'number', description: 'Indent spaces; defaults to `2`.', required: false }],
    relatedSlugs: [],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/misc/prettyjson.pipe.ts',
    example: `<pre>{{ myObject | prettyjson }}</pre>
<pre>{{ myObject | prettyjson:4 }}</pre>`
  },
  // MARK: date — conversion
  {
    slug: 'to-js-date',
    category: 'date',
    pipeName: 'toJsDate',
    className: 'ToJsDatePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateOrDateString>',
    outputType: 'Maybe<Date>',
    purity: 'pure',
    description: 'Converts a `DateOrDateString` (string ISO/RFC date or `Date`) into a JS `Date`. Returns `undefined` when the input is missing or invalid.',
    args: [],
    relatedSlugs: ['date-distance', 'date-format-distance'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/tojsdate.pipe.ts',
    example: `<span>{{ '2024-01-05T12:00:00Z' | toJsDate | date:'short' }}</span>`
  },
  {
    slug: 'to-minutes',
    category: 'date',
    pipeName: 'toMinutes',
    className: 'ToMinutesPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Milliseconds',
    outputType: 'Minutes',
    purity: 'pure',
    description: 'Converts a duration in `Milliseconds` to whole `Minutes` via `millisecondsToMinutes`.',
    args: [],
    relatedSlugs: ['minutes-string'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/tominutes.pipe.ts',
    example: `<span>{{ 180000 | toMinutes }}</span>
<!-- 3 -->`
  },
  {
    slug: 'minutes-string',
    category: 'date',
    pipeName: 'minutesString',
    className: 'MinutesStringPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<Minutes | string>',
    outputType: 'Maybe<string>',
    purity: 'impure',
    description: 'Renders a `Minutes` value as a human-readable duration with auto unit scaling (`90 minutes`, `~5 hours`, `~4 days`). A `~` prefix marks rounded values.',
    args: [],
    relatedSlugs: ['to-minutes'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/minutesstring.pipe.ts',
    example: `<span>{{ 90 | minutesString }}</span>
<!-- 90 minutes -->

<span>{{ 250 | minutesString }}</span>
<!-- ~5 hours -->`
  },
  {
    slug: 'timezone-abbreviation',
    category: 'date',
    pipeName: 'timezoneAbbreviation',
    className: 'TimezoneAbbreviationPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<TimezoneString>',
    outputType: 'Maybe<string>',
    purity: 'impure',
    description: 'Returns the abbreviation (`EST`, `PDT`, …) for a `TimezoneString`, optionally relative to a reference `Date` for DST resolution.',
    args: [{ name: 'input', type: 'Maybe<Date>', description: 'Reference date used for DST resolution; defaults to now.', required: false }],
    relatedSlugs: ['system-date-to-target-date', 'target-date-to-system-date'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/timezoneabbreviation.pipe.ts',
    example: `<span>{{ 'America/New_York' | timezoneAbbreviation }}</span>
<!-- EST or EDT -->`
  },
  // MARK: date — distance
  {
    slug: 'date-distance',
    category: 'date',
    pipeName: 'dateDistance',
    className: 'DateDistancePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateOrDateString>',
    outputType: 'string',
    purity: 'impure',
    description: 'Formats the distance from a date to a reference date (defaults to now) — e.g. `3 hours ago`. Falls back to `unavailable` when null.',
    args: [
      { name: 'inputTo', type: 'Maybe<Date>', description: 'Reference date for the distance calculation.', required: false },
      { name: 'unavailable', type: 'string', description: 'Fallback string when input is null. Defaults to `Not Available`.', required: false }
    ],
    relatedSlugs: ['date-range-distance', 'date-format-distance', 'time-distance'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/datedistance.pipe.ts',
    example: `<span>{{ someDate | dateDistance }}</span>
<!-- 3 hours ago -->`
  },
  {
    slug: 'date-range-distance',
    category: 'date',
    pipeName: 'dateRangeDistance',
    className: 'DateRangeDistancePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<Date | DateRange>',
    outputType: 'string',
    purity: 'impure',
    description: 'Formats a `Date` or `DateRange` as a human-readable distance from now using `formatDateDistance`.',
    args: [{ name: 'unavailable', type: 'string', description: 'Fallback when input is null. Defaults to `Not Available`.', required: false }],
    relatedSlugs: ['date-distance'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/daterangedistance.pipe.ts',
    example: `<span>{{ someDate | dateRangeDistance }}</span>
<!-- 3 hours ago -->`
  },
  {
    slug: 'date-format-distance',
    category: 'date',
    pipeName: 'dateFormatDistance',
    className: 'DateFormatDistancePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateOrDateString>',
    outputType: 'Maybe<string>',
    purity: 'impure',
    description: 'Formats a date with an Angular `formatDate` pattern and appends the relative distance to now in parentheses.',
    args: [
      { name: 'format', type: 'string', description: 'Angular `formatDate` pattern (`MMM d, y`, `short`, …).', required: true },
      { name: 'includeSeconds', type: 'boolean', description: 'Forwarded to `formatDistanceToNow`. Defaults to `false`.', required: false }
    ],
    relatedSlugs: ['date-distance', 'date-format-from-to'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/dateformatdistance.pipe.ts',
    example: `<span>{{ someDate | dateFormatDistance:'MMM d, y' }}</span>
<!-- Jan 5, 2024 (3 days ago) -->`
  },
  {
    slug: 'date-format-from-to',
    category: 'date',
    pipeName: 'dateFormatFromTo',
    className: 'DateFormatFromToPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateOrDateString>',
    outputType: 'Maybe<string>',
    purity: 'pure',
    description: 'Formats a `from - to` time range given a start date, an Angular format string, and a duration in `Minutes`.',
    args: [
      { name: 'format', type: 'string', description: 'Angular `formatDate` pattern for the start.', required: true },
      { name: 'minutes', type: 'Minutes', description: 'Duration added to the start to compute the end.', required: true }
    ],
    relatedSlugs: ['date-time-range', 'date-format-distance'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/dateformatfromto.pipe.ts',
    example: `<span>{{ eventStart | dateFormatFromTo:'MMM d, h:mm a':90 }}</span>
<!-- Jan 5, 2:00 PM - 3:30 PM -->`
  },
  {
    slug: 'time-distance',
    category: 'date',
    pipeName: 'timeDistance',
    className: 'TimeDistancePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateOrDateString>',
    outputType: 'string',
    purity: 'impure',
    description: 'Distance string with suffix (e.g. `3 hours ago`, `in 2 days`) between input and a reference (defaults to now).',
    args: [
      { name: 'to', type: 'Maybe<Date>', description: 'Reference date. Defaults to now.', required: false },
      { name: 'unavailable', type: 'string', description: 'Fallback when input is null. Defaults to `Not Available`.', required: false }
    ],
    relatedSlugs: ['date-distance', 'time-countdown-distance'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/timedistance.pipe.ts',
    example: `<span>{{ someDate | timeDistance }}</span>
<!-- 3 hours ago -->`
  },
  {
    slug: 'time-countdown-distance',
    category: 'date',
    pipeName: 'timeCountdownDistance',
    className: 'TimeDistanceCountdownPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateOrDateString>',
    outputType: 'string',
    purity: 'impure',
    description: 'Countdown variant of `timeDistance`. If the target is in the past, returns `soonString` (`"Soon"` by default); otherwise the relative distance with suffix.',
    args: [
      { name: 'soonString', type: 'string', description: 'Returned when the target is in the past. Defaults to `Soon`.', required: false },
      { name: 'unavailable', type: 'string', description: 'Fallback when input is null. Defaults to `Not Available`.', required: false }
    ],
    relatedSlugs: ['time-distance'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/timedistance.pipe.ts',
    example: `<span>{{ futureDate | timeCountdownDistance }}</span>
<!-- in 3 hours, or "Soon" if past -->`
  },
  // MARK: date — range formatting
  {
    slug: 'date-time-range',
    category: 'date',
    pipeName: 'dateTimeRange',
    className: 'DateTimeRangePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateRange>',
    outputType: 'string',
    purity: 'pure',
    description: 'Formats a `DateRange` as a date+time range string using `formatToTimeRangeString`.',
    args: [{ name: 'unavailable', type: 'string', description: 'Fallback when input is null. Defaults to `Not Available`.', required: false }],
    relatedSlugs: ['date-time-range-only', 'date-day-range', 'date-day-time-range'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/datetimerange.pipe.ts',
    example: `<span>{{ dateRange | dateTimeRange }}</span>
<!-- Jan 5, 2:00 PM - 4:00 PM -->`
  },
  {
    slug: 'date-time-range-only',
    category: 'date',
    pipeName: 'dateTimeRangeOnly',
    className: 'DateTimeRangeOnlyPipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateRange>',
    outputType: 'string',
    purity: 'pure',
    description: 'Like `dateTimeRange`, but renders only the time portion (no date).',
    args: [{ name: 'unavailable', type: 'string', description: 'Fallback when input is null. Defaults to `Not Available`.', required: false }],
    relatedSlugs: ['date-time-range'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/datetimerangeonly.pipe.ts',
    example: `<span>{{ dateRange | dateTimeRangeOnly }}</span>
<!-- 2:00 PM - 4:00 PM -->`
  },
  {
    slug: 'date-time-range-only-distance',
    category: 'date',
    pipeName: 'dateTimeRangeOnlyDistance',
    className: 'DateTimeRangeOnlyDistancePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateRange>',
    outputType: 'string',
    purity: 'pure',
    description: 'Formats a `DateRange` as a distance string (`3 hours`) via `formatDateRangeDistance`. Accepts an optional `FormatDateRangeDistanceFunctionConfig`.',
    args: [
      { name: 'config', type: 'FormatDateRangeDistanceFunctionConfig | undefined', description: 'Customizes the distance output.', required: false },
      { name: 'unavailable', type: 'string', description: 'Fallback when input is null. Defaults to `Not Available`.', required: false }
    ],
    relatedSlugs: ['date-time-range', 'date-range-distance'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/datetimerangeonlydistance.pipe.ts',
    example: `<span>{{ dateRange | dateTimeRangeOnlyDistance }}</span>
<!-- 3 hours -->`
  },
  {
    slug: 'date-day-range',
    category: 'date',
    pipeName: 'dateDayRange',
    className: 'DateDayRangePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateRange>',
    outputType: 'string',
    purity: 'pure',
    description: 'Formats a `DateRange` as a day-only range string (`Jan 5 - Jan 8`) via `formatToDayRangeString`.',
    args: [{ name: 'unavailable', type: 'string', description: 'Fallback when input is null. Defaults to `Not Available`.', required: false }],
    relatedSlugs: ['date-time-range', 'date-day-time-range'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/datedayrange.pipe.ts',
    example: `<span>{{ dateRange | dateDayRange }}</span>
<!-- Jan 5 - Jan 8 -->`
  },
  {
    slug: 'date-day-time-range',
    category: 'date',
    pipeName: 'dateDayTimeRange',
    className: 'DateDayTimeRangePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<DateRange>',
    outputType: 'string',
    purity: 'pure',
    description: 'Formats a `DateRange` as a day+time range string via `formatToDayTimeRangeString`.',
    args: [{ name: 'unavailable', type: 'string', description: 'Fallback when input is null. Defaults to `Not Available`.', required: false }],
    relatedSlugs: ['date-time-range', 'date-day-range'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/datedaytimerange.pipe.ts',
    example: `<span>{{ dateRange | dateDayTimeRange }}</span>
<!-- Jan 5, 2:00 PM - Jan 8, 4:00 PM -->`
  },
  // MARK: date — timezone shifting
  {
    slug: 'system-date-to-target-date',
    category: 'date',
    pipeName: 'systemDateToTargetDate',
    className: 'SystemDateToTargetDatePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<Date>',
    outputType: 'Maybe<Date>',
    purity: 'impure',
    description: 'Converts a system (UTC-based) `Date` to the equivalent local `Date` in a target `TimezoneString` via `dateTimezoneUtcNormal`.',
    args: [{ name: 'timezone', type: 'Maybe<TimezoneString>', description: 'Target timezone for the conversion.', required: true }],
    relatedSlugs: ['target-date-to-system-date', 'timezone-abbreviation'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/systemdatetotargetdate.pipe.ts',
    example: `<span>{{ systemDate | systemDateToTargetDate:'America/New_York' | date:'short' }}</span>`
  },
  {
    slug: 'target-date-to-system-date',
    category: 'date',
    pipeName: 'targetDateToSystemDate',
    className: 'TargetDateToSystemDatePipe',
    module: DBX_CORE_MODULE,
    inputType: 'Maybe<Date>',
    outputType: 'Maybe<Date>',
    purity: 'impure',
    description: 'Inverse of `systemDateToTargetDate`. Converts a target-timezone `Date` back to the system (UTC-based) `Date`.',
    args: [{ name: 'timezone', type: 'Maybe<TimezoneString>', description: 'Source timezone of the input date.', required: true }],
    relatedSlugs: ['system-date-to-target-date', 'timezone-abbreviation'],
    skillRefs: [],
    sourcePath: 'packages/dbx-core/src/lib/pipe/date/targetdatetosystemdate.pipe.ts',
    example: `<span>{{ targetDate | targetDateToSystemDate:'America/New_York' | date:'short' }}</span>`
  }
];

export function getPipeEntries(): readonly PipeEntryInfo[] {
  return PIPE_ENTRIES;
}

export function getPipeEntry(slug: PipeRegistrySlug): Maybe<PipeEntryInfo> {
  const trimmed = slug.trim();
  return PIPE_ENTRIES.find((e) => e.slug === trimmed);
}

export function getPipeEntryByPipeName(pipeName: AngularPipeName): Maybe<PipeEntryInfo> {
  const trimmed = pipeName.trim();
  return PIPE_ENTRIES.find((e) => e.pipeName === trimmed);
}

export function getPipeEntryByClassName(className: TypeScriptClassName): Maybe<PipeEntryInfo> {
  const trimmed = className.trim();
  return PIPE_ENTRIES.find((e) => e.className === trimmed);
}
