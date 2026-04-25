/**
 * Alias table + resolver for forge (`dbx_form_*`) entry topics.
 *
 * Maps common synonyms, factory-name shortcuts, and category keywords to
 * canonical registry slugs. Kept simple (case-insensitive string map) because
 * the registry is small enough that fuzzy search picks up the long tail.
 *
 * Forge-only by design — other clusters (`lookup-model`, `lookup-action`, etc.)
 * keep their alias tables inline since synonyms differ wildly across domains.
 */

/**
 * Aliases keyed by their lowercased form, values are canonical slugs.
 * Extend as real query traffic reveals new synonyms.
 */
const ALIASES: Record<string, string> = {
  // text variants
  'text-field': 'text',
  textfield: 'text',
  input: 'text',
  'input-field': 'text',
  'text-area-field': 'text-area',
  textarea: 'text-area',
  multiline: 'text-area',

  // number variants
  'number-field': 'number',
  numeric: 'number',
  int: 'number',
  integer: 'number',
  slider: 'number-slider',

  // boolean variants
  bool: 'toggle',
  switch: 'toggle',
  check: 'checkbox',

  // date variants
  datepicker: 'date',
  'date-picker': 'date',
  datetime: 'date-time',
  'datetime-field': 'date-time',
  timestamp: 'date-time',
  'date-range': 'date-range-row',
  daterange: 'date-range-row',
  'datetime-range': 'date-time-range-row',
  'time-range': 'date-time-range-row',

  // selection variants
  chips: 'pickable-chip',
  'chip-list': 'pickable-chip',
  multiselect: 'pickable-chip',
  autocomplete: 'searchable-text',
  typeahead: 'searchable-text',
  dropdown: 'value-selection',
  select: 'value-selection',
  combobox: 'value-selection',

  // text variants (specialized)
  email: 'email',
  'email-field': 'email',
  password: 'password-field',
  'password-input': 'password-field',
  phonenumber: 'phone',
  'phone-number': 'phone',
  tel: 'phone',
  zip: 'zip-code',
  zipcode: 'zip-code',
  'rich-text': 'text-editor',
  html: 'text-editor',
  editor: 'text-editor',

  // layout variants
  array: 'array-field',
  list: 'array-field',
  repeatable: 'array-field',
  section: 'section-wrapper',
  subsection: 'subsection-wrapper',
  style: 'style-wrapper',
  flex: 'flex-layout',
  expand: 'expand-wrapper',
  collapse: 'expand-wrapper',

  // composites
  address: 'address-group',
  'address-form': 'address-group',
  login: 'username-password-login-fields',
  signin: 'username-password-login-fields',
  signup: 'username-password-login-fields'
};

/**
 * Normalizes `topic` (trim, lowercase) and maps through the alias table. If no
 * alias matches, returns the normalized topic unchanged so downstream lookups
 * can try the topic as a slug / factory name / produces value directly.
 */
export function resolveTopicAlias(topic: string): string {
  const normalized = topic.trim().toLowerCase();
  const result = ALIASES[normalized] ?? normalized;
  return result;
}

/**
 * Returns every alias → canonical-slug mapping. Useful for docs/introspection.
 */
export function getAliasMap(): Readonly<Record<string, string>> {
  return ALIASES;
}
