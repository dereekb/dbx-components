import type { ExamplePattern } from '../form-patterns.js';

export const FORM_PATTERN_DATE_RANGE_FILTER: ExamplePattern = {
  slug: 'date-range-filter',
  name: 'Date range filter',
  summary: 'Start and end dates side by side, labelled "From" / "To".',
  usesFormSlugs: ['date-range-row', 'date-time'],
  snippets: {
    minimal: `dbxForgeDateRangeRow({ start: { label: 'From' }, end: { label: 'To' } })`,
    brief: `const rangeRow = dbxForgeDateRangeRow({
  required: true,
  start: { key: 'from', label: 'From' },
  end: { key: 'to', label: 'To' }
});`,
    full: `import { dbxForgeDateRangeRow, dbxForgeTextField } from '@dereekb/dbx-form';

export const filterFormConfig: FormConfig<FilterValue> = {
  fields: [
    dbxForgeTextField({ key: 'q', label: 'Search' }),
    dbxForgeDateRangeRow({
      required: true,
      start: { key: 'from', label: 'From' },
      end: { key: 'to', label: 'To' }
    })
  ]
};

export interface FilterValue {
  readonly q?: string;
  readonly from: Date;
  readonly to: Date;
}`
  },
  notes: 'Use `dbxForgeDateTimeRangeRow` instead when you want a time-of-day range on a single day. Use `dbxForgeFixedDateRangeField` for inline calendar-style picking with a fixed range length.'
};
