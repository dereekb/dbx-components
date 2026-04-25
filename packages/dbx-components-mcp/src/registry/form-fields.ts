/**
 * Form Field Registry.
 *
 * Canonical metadata for @dereekb/dbx-form helpers — field factories
 * (e.g. `dbxForgeTextField`), composite builders (e.g. `dbxForgeDateRangeRow`),
 * and layout primitives (e.g. `dbxForgeRow`). The three-tier taxonomy is
 * documented in the `dbx__ref__dbx-forge-field` skill.
 *
 * The PRIMARY search index is `produces` — the output primitive each entry
 * yields. "I need a Date", "I need a RowField" is the most common AI query
 * shape, and the registry is small enough (<40 entries) that filtering further
 * by tier or inspecting config properties is cheap after the primitive match.
 *
 * Entries are slug-keyed (`'text'`, `'date-range-row'`, `'row'`). Slugs are
 * kebab-case and unique across all three tiers.
 */

import type { PropertyInfo } from './index.js';

/**
 * Builder tier from the form-field skill.
 *
 *   - `field-factory`     dbxForgeFieldFunction / dbxForgeMaterialFormFieldWrappedFieldFunction — registers a type
 *   - `composite-builder` plain function composing other form entries — does NOT register a type
 *   - `primitive`         core layout helper (row, group, array, section)
 */
export type FormTier = 'field-factory' | 'composite-builder' | 'primitive';

/**
 * Which form factory helper a field-factory entry is built with.
 *
 *   - `unwrapped`                    `dbxForgeFieldFunction` (field renders its own chrome)
 *   - `material-form-field-wrapped`  `dbxForgeMaterialFormFieldWrappedFieldFunction` (wrapped in mat-form-field)
 */
export type FormFieldWrapperPattern = 'unwrapped' | 'material-form-field-wrapped';

/**
 * What a composite builder's naming suffix advertises it returns.
 *
 *   - `Row`     `dbxForgeXRow`     → `RowField`
 *   - `Group`   `dbxForgeXGroup`   → `GroupField`
 *   - `Fields`  `dbxForgeXFields`  → `FieldDef[]`
 *   - `Field`   `dbxForgeXField`   → single field (composite array fields keep `Field`)
 *   - `Wrapper` `dbxForgeXWrapper` → WrapperConfig or composed layout wrapped in a toggle/expand
 *   - `Layout`  `dbxForgeXLayout`  → GroupField with responsive flex configuration
 */
export type FormCompositeSuffix = 'Row' | 'Group' | 'Fields' | 'Field' | 'Wrapper' | 'Layout';

/**
 * Documentation of the common output primitives. `produces` on an entry is a
 * raw `string` (entries can produce arbitrary form-model types like `'string'`,
 * `'number'`, `'Date'`, `'T'`, `'T[]'`, `'AddressValue'`, ...). These are the
 * canonical layout outputs that commonly show up in the catalog.
 */
export type FormLayoutPrimitive = 'RowField' | 'GroupField' | 'ArrayField' | 'SectionField' | 'FieldDef[]' | 'WrapperConfig';

/**
 * Whether an entry's output is an array / collection.
 *
 *   - `yes`       entry always produces a collection (field's form value is an
 *                 array, OR composite returns `FieldDef[]`).
 *   - `no`        entry produces a single value / single field.
 *   - `optional`  entry can be configured either way (e.g. searchable-chip in
 *                 single-select vs multi-select mode).
 */
export type FormArrayOutput = 'yes' | 'no' | 'optional';

// MARK: Entry shapes
interface FormEntryBase {
  /** Unique registry slug (kebab-case). Used for lookup. */
  readonly slug: string;
  /** Exported factory/builder function name (e.g. `'dbxForgeTextField'`). */
  readonly factoryName: string;
  /**
   * PRIMARY INDEX. The output primitive this entry produces.
   *
   * Field factories: the form-model value type (e.g. `'string'`, `'number'`,
   * `'boolean'`, `'Date'`, `'T'`, `'T[]'`).
   * Composite builders: the composed return type (e.g. `'RowField'`,
   * `'GroupField'`, `'FieldDef[]'`, `'ArrayField'`).
   * Primitives: the layout field / wrapper type returned (`'RowField'`,
   * `'GroupField'`, `'ArrayField'`, `'WrapperConfig'`, ...).
   */
  readonly produces: string;
  /**
   * Whether this entry's output is an array. Complements `produces` — lets
   * callers ask "I need a single X" vs "I need a list of X" without parsing
   * the type string.
   */
  readonly arrayOutput: FormArrayOutput;
  /** Prose description of what the entry builds and when to reach for it. */
  readonly description: string;
  /** Path within `packages/dbx-form/src/lib/form/` where the export is defined. */
  readonly sourcePath: string;
  /** Full copy-paste-ready usage example. */
  readonly example: string;
  /** Smallest valid invocation. */
  readonly minimalExample: string;
  /** Noteworthy config properties beyond `key` / `label` / `required` (which are assumed). */
  readonly config: Record<string, PropertyInfo>;
}

/**
 * A field factory: registers an ng-form field type via
 * `dbxForgeFieldFunction` or `dbxForgeMaterialFormFieldWrappedFieldFunction`.
 */
export interface FormFieldFactoryInfo extends FormEntryBase {
  readonly tier: 'field-factory';
  readonly wrapperPattern: FormFieldWrapperPattern;
  /** Underlying ng-form dynamic-forms type string (e.g. `'input'`, `'textarea'`, `'datepicker'`, `'toggle'`, `'slider'`). */
  readonly ngFormType: string;
  /** TypeScript config interface name (e.g. `'DbxForgeTextFieldConfig'`). */
  readonly configInterface: string;
  /** Generic signature if the factory accepts type parameters (e.g. `'<T = unknown>'`). */
  readonly generic?: string;
}

/**
 * A composite builder: composes other form entries into a layout. Does not
 * register a new ng-form type.
 */
export interface FormCompositeBuilderInfo extends FormEntryBase {
  readonly tier: 'composite-builder';
  /** Which suffix the builder uses — mirrors its return shape. */
  readonly suffix: FormCompositeSuffix;
  /** TypeScript config interface name (descriptive, not `DbxForgeFieldFunctionDef`-based). */
  readonly configInterface: string;
  /** Slugs of other form entries this composite composes from. */
  readonly composesFromSlugs: readonly string[];
}

/**
 * A layout primitive: core library helper that composites wrap (e.g. `dbxForgeRow`).
 */
export interface FormPrimitiveInfo extends FormEntryBase {
  readonly tier: 'primitive';
  /** Layout field type this primitive returns. Accepts any string for flexibility; common values enumerated in {@link FormLayoutPrimitive}. */
  readonly returns: string;
  /** TypeScript config interface name if the primitive accepts a config object. */
  readonly configInterface?: string;
}

/**
 * Any entry in the form registry.
 */
export type FormFieldInfo = FormFieldFactoryInfo | FormCompositeBuilderInfo | FormPrimitiveInfo;

/**
 * Presentation order for tiers in listings.
 */
export const FORM_TIER_ORDER: readonly FormTier[] = ['field-factory', 'composite-builder', 'primitive'];

// MARK: Helpers for compact entry authoring
const NO_EXTRA_CONFIG: Record<string, PropertyInfo> = {};

// MARK: Registry
export const FORM_FIELDS: readonly FormFieldInfo[] = [
  // =====================================================================
  // FIELD FACTORIES
  // =====================================================================

  // ----- text / text-variant factories ----------------------------------
  {
    slug: 'text',
    factoryName: 'dbxForgeTextField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeTextFieldConfig',
    description: 'Single-line text input. Supports text/email/password input types, autocomplete attribute, regex pattern validation, and idempotent string transforms (trim, case changes, etc.).',
    sourcePath: 'field/value/text/text.field.ts',
    config: {
      inputType: { name: 'inputType', type: "'text' | 'password' | 'email'", description: 'HTML input type. Email adds an email validator automatically.', required: false, default: 'text' },
      pattern: { name: 'pattern', type: 'string | RegExp', description: 'Regex validation pattern. RegExp values are converted to their `.source` string.', required: false },
      idempotentTransform: { name: 'idempotentTransform', type: 'TransformStringFunctionConfig', description: 'Idempotent string transformation applied as a value parser (e.g. trim, uppercase).', required: false },
      autocomplete: { name: 'autocomplete', type: 'string', description: 'HTML autocomplete attribute (e.g. "email", "off").', required: false }
    },
    example: `const emailField = dbxForgeTextField({\n  key: 'email',\n  label: 'Email',\n  required: true,\n  inputType: 'email',\n  props: { placeholder: 'user@example.com' }\n});`,
    minimalExample: `dbxForgeTextField({ key: 'name', label: 'Name' })`
  },
  {
    slug: 'text-area',
    factoryName: 'dbxForgeTextAreaField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'textarea',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeTextAreaFieldConfig',
    description: 'Multi-line textarea input. Supports row count, autocomplete attribute, pattern validation (RegExp → string conversion), and default value.',
    sourcePath: 'field/value/text/textarea.field.ts',
    config: {
      rows: { name: 'rows', type: 'number', description: 'Number of visible text rows.', required: false, default: 3 },
      defaultValue: { name: 'defaultValue', type: 'string', description: 'Initial value when `value` is not supplied. Defaults to empty string.', required: false, default: '' },
      pattern: { name: 'pattern', type: 'string | RegExp', description: 'Regex validation pattern. RegExp values are converted to their `.source` string.', required: false }
    },
    example: `const bioField = dbxForgeTextAreaField({\n  key: 'bio',\n  label: 'Biography',\n  rows: 5,\n  maxLength: 500\n});`,
    minimalExample: `dbxForgeTextAreaField({ key: 'notes', label: 'Notes' })`
  },
  {
    slug: 'name',
    factoryName: 'dbxForgeNameField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeNameFieldConfig',
    description: 'Pre-configured text field for capturing a full name with sensible min/max length defaults.',
    sourcePath: 'field/value/text/text.additional.field.ts',
    config: {
      minLength: { name: 'minLength', type: 'number', description: 'Minimum character length.', required: false },
      maxLength: { name: 'maxLength', type: 'number', description: 'Maximum character length.', required: false }
    },
    example: `dbxForgeNameField({ key: 'fullName', label: 'Full Name', required: true })`,
    minimalExample: `dbxForgeNameField({ key: 'name' })`
  },
  {
    slug: 'email',
    factoryName: 'dbxForgeEmailField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeEmailFieldConfig',
    description: 'Text field pre-configured with email input type and email validator. Prefer this over configuring `dbxForgeTextField` with `inputType: "email"` directly.',
    sourcePath: 'field/value/text/text.additional.field.ts',
    config: {
      autocomplete: { name: 'autocomplete', type: 'string | false', description: 'HTML autocomplete attribute; pass false to disable browser autofill.', required: false }
    },
    example: `dbxForgeEmailField({ key: 'email', label: 'Email', required: true })`,
    minimalExample: `dbxForgeEmailField({ key: 'email' })`
  },
  {
    slug: 'city',
    factoryName: 'dbxForgeCityField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeCityFieldConfig',
    description: 'City name input enforcing `ADDRESS_CITY_MAX_LENGTH`. Typically used inside the address composite set.',
    sourcePath: 'field/value/text/text.additional.field.ts',
    config: NO_EXTRA_CONFIG,
    example: `dbxForgeCityField({ required: true })`,
    minimalExample: `dbxForgeCityField({})`
  },
  {
    slug: 'state',
    factoryName: 'dbxForgeStateField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeStateFieldConfig',
    description: 'US state input. When `asCode: true`, validates two-letter codes and auto-uppercases input via an idempotent transform.',
    sourcePath: 'field/value/text/text.additional.field.ts',
    config: {
      asCode: { name: 'asCode', type: 'boolean', description: 'Enforce 2-letter state code pattern and auto-uppercase input.', required: false }
    },
    example: `dbxForgeStateField({ asCode: true, required: true })`,
    minimalExample: `dbxForgeStateField({})`
  },
  {
    slug: 'country',
    factoryName: 'dbxForgeCountryField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeCountryFieldConfig',
    description: 'Country name input enforcing `ADDRESS_COUNTRY_MAX_LENGTH`. Typically used inside the address composite set.',
    sourcePath: 'field/value/text/text.additional.field.ts',
    config: NO_EXTRA_CONFIG,
    example: `dbxForgeCountryField({ required: true })`,
    minimalExample: `dbxForgeCountryField({})`
  },
  {
    slug: 'zip-code',
    factoryName: 'dbxForgeZipCodeField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeZipCodeFieldConfig',
    description: 'US zip code input with pattern validation and max-length enforcement.',
    sourcePath: 'field/value/text/text.additional.field.ts',
    config: NO_EXTRA_CONFIG,
    example: `dbxForgeZipCodeField({ required: true })`,
    minimalExample: `dbxForgeZipCodeField({})`
  },
  {
    slug: 'lat-lng',
    factoryName: 'dbxForgeLatLngTextField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeLatLngTextFieldConfig',
    description: 'Latitude/longitude coordinate input with decimal-degree pattern validation.',
    sourcePath: 'field/value/text/text.additional.field.ts',
    config: NO_EXTRA_CONFIG,
    example: `dbxForgeLatLngTextField({ key: 'coords', label: 'Coordinates' })`,
    minimalExample: `dbxForgeLatLngTextField({ key: 'coords' })`
  },
  {
    slug: 'address-line',
    factoryName: 'dbxForgeAddressLineField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeAddressLineFieldConfig',
    description: 'Street address line input. The `line` prop controls which line (1 or 2) — it affects key and label generation.',
    sourcePath: 'field/value/text/text.address.field.ts',
    config: {
      line: { name: 'line', type: '0 | 1 | 2', description: 'Address line number; affects key and label generation.', required: false, default: 1 }
    },
    example: `dbxForgeAddressLineField({ line: 2 })`,
    minimalExample: `dbxForgeAddressLineField({})`
  },

  // ----- number + slider ------------------------------------------------
  {
    slug: 'number',
    factoryName: 'dbxForgeNumberField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'number',
    arrayOutput: 'no',
    configInterface: 'DbxForgeNumberFieldConfig',
    description: 'Numeric input (HTML `type="number"`). Supports min/max/step constraints, optional step enforcement (divisibility validator), and idempotent number transforms.',
    sourcePath: 'field/value/number/number.field.ts',
    config: {
      min: { name: 'min', type: 'number', description: 'Minimum allowed value.', required: false },
      max: { name: 'max', type: 'number', description: 'Maximum allowed value.', required: false },
      step: { name: 'step', type: 'number', description: 'Step increment applied to the HTML `step` attribute via `meta`.', required: false },
      enforceStep: { name: 'enforceStep', type: 'boolean', description: 'When true, adds a custom divisibility validator. Requires `step` to be set.', required: false, default: false },
      idempotentTransform: { name: 'idempotentTransform', type: 'TransformNumberFunctionConfig', description: 'Idempotent number transformation applied as a value parser.', required: false }
    },
    example: `dbxForgeNumberField({ key: 'quantity', label: 'Quantity', min: 1, max: 100, step: 1, enforceStep: true })`,
    minimalExample: `dbxForgeNumberField({ key: 'count', label: 'Count' })`
  },
  {
    slug: 'number-slider',
    factoryName: 'dbxForgeNumberSliderField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'slider',
    produces: 'number',
    arrayOutput: 'no',
    configInterface: 'DbxForgeNumberSliderFieldConfig',
    description: 'Material slider wrapped in a form-field container. Supports thumb label, tick interval, and step-derived tick spacing.',
    sourcePath: 'field/value/number/slider.field.ts',
    config: {
      thumbLabel: { name: 'thumbLabel', type: 'boolean', description: 'Show the thumb label while sliding.', required: false, default: true },
      tickInterval: { name: 'tickInterval', type: 'number | false', description: 'Tick interval; `false` disables ticks.', required: false },
      step: { name: 'step', type: 'number', description: 'Slider step increment. Defaults tickInterval to 1 when set.', required: false }
    },
    example: `dbxForgeNumberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10, step: 1 })`,
    minimalExample: `dbxForgeNumberSliderField({ key: 'v', min: 0, max: 100 })`
  },

  // ----- boolean --------------------------------------------------------
  {
    slug: 'toggle',
    factoryName: 'dbxForgeToggleField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'toggle',
    produces: 'boolean',
    arrayOutput: 'no',
    configInterface: 'DbxForgeToggleFieldConfig',
    description: 'Material slide toggle. Renders inside a styled outline box by default so it visually matches surrounding outlined form fields; pass `styledBox: false` to opt out.',
    sourcePath: 'field/value/boolean/boolean.field.ts',
    config: {
      styledBox: { name: 'styledBox', type: 'boolean', description: 'When true (default), wraps the toggle in `.dbx-forge-styled-box` for visual parity with outlined form fields.', required: false, default: true }
    },
    example: `dbxForgeToggleField({ key: 'active', label: 'Active', value: true })`,
    minimalExample: `dbxForgeToggleField({ key: 'enabled', label: 'Enabled' })`
  },
  {
    slug: 'checkbox',
    factoryName: 'dbxForgeCheckboxField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'checkbox',
    produces: 'boolean',
    arrayOutput: 'no',
    configInterface: 'DbxForgeCheckboxFieldConfig',
    description: 'Material checkbox. Shares the styled-outline-box opt-out with toggle.',
    sourcePath: 'field/value/boolean/boolean.field.ts',
    config: {
      styledBox: { name: 'styledBox', type: 'boolean', description: 'When true (default), wraps the checkbox in `.dbx-forge-styled-box`.', required: false, default: true }
    },
    example: `dbxForgeCheckboxField({ key: 'agree', label: 'I agree to the terms' })`,
    minimalExample: `dbxForgeCheckboxField({ key: 'ok', label: 'OK' })`
  },

  // ----- phone + duration ----------------------------------------------
  {
    slug: 'phone',
    factoryName: 'dbxForgePhoneField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'phone',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgePhoneFieldConfig',
    description: 'International phone number input backed by ngx-mat-input-tel. Supports preferred-country lists, search, and optional extension input.',
    sourcePath: 'field/value/phone/phone.field.ts',
    config: {
      preferredCountries: { name: 'preferredCountries', type: 'string[]', description: 'ISO country codes pinned to the top of the selector.', required: false },
      onlyCountries: { name: 'onlyCountries', type: 'string[]', description: 'Restrict dropdown to specific ISO country codes.', required: false },
      enableSearch: { name: 'enableSearch', type: 'boolean', description: 'Enable search in the country selector.', required: false, default: true },
      allowExtension: { name: 'allowExtension', type: 'boolean', description: 'Allow phone extension input.', required: false, default: false }
    },
    example: `dbxForgePhoneField({ key: 'phone', label: 'Phone', preferredCountries: ['US', 'CA'] })`,
    minimalExample: `dbxForgePhoneField({ key: 'phone' })`
  },
  {
    slug: 'time-duration',
    factoryName: 'dbxForgeTimeDurationField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'timeduration',
    produces: 'TimeDurationValue',
    arrayOutput: 'no',
    configInterface: 'DbxForgeTimeDurationFieldConfig',
    description: 'Duration input with popover picker. Output shape varies by `valueMode` — number (ms/s/…), string, or structured object.',
    sourcePath: 'field/value/duration/duration.field.ts',
    config: {
      outputUnit: { name: 'outputUnit', type: 'TimeUnit', description: 'Unit of the output value (ms, s, m, h, d).', required: false, default: 'ms' },
      valueMode: { name: 'valueMode', type: 'TimeDurationFieldValueMode', description: 'Output shape (number, string, object).', required: false, default: 'number' },
      allowedUnits: { name: 'allowedUnits', type: 'TimeUnit[]', description: 'Time units available in the field.', required: false },
      pickerUnits: { name: 'pickerUnits', type: 'TimeUnit[]', description: 'Units shown in the popover picker.', required: false }
    },
    example: `dbxForgeTimeDurationField({ key: 'duration', label: 'Duration', outputUnit: 'm' })`,
    minimalExample: `dbxForgeTimeDurationField({ key: 'dur' })`
  },

  // ----- date family ---------------------------------------------------
  {
    slug: 'date',
    factoryName: 'dbxForgeDateField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'datepicker',
    produces: 'Date',
    arrayOutput: 'no',
    configInterface: 'DbxForgeDateFieldConfig',
    description: 'Material datepicker (date-only, no time). For time-of-day picking use the `date-time` field; for ranges use `date-range-row` or `date-time-range-row`.',
    sourcePath: 'field/value/date/date.field.ts',
    config: NO_EXTRA_CONFIG,
    example: `dbxForgeDateField({ key: 'startDate', label: 'Start Date', required: true })`,
    minimalExample: `dbxForgeDateField({ key: 'when', label: 'When' })`
  },
  {
    slug: 'date-time',
    factoryName: 'dbxForgeDateTimeField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'datetime',
    produces: 'DateTimeValue',
    arrayOutput: 'no',
    configInterface: 'DbxForgeDateTimeFieldConfig',
    description: 'Combined date-time picker with timezone, value mode (DATE_STRING / TIMESTAMP / Date), and time mode (REQUIRED / OPTIONAL / NONE). Powers `date-range-row` and `date-time-range-row`.',
    sourcePath: 'field/value/date/datetime.field.ts',
    config: {
      timezone: { name: 'timezone', type: 'string', description: 'Timezone for conversion (e.g. "America/New_York").', required: false },
      valueMode: { name: 'valueMode', type: 'DbxDateTimeValueMode', description: 'Output format (DATE_STRING, TIMESTAMP, Date).', required: false },
      timeMode: { name: 'timeMode', type: 'DbxDateTimeFieldTimeMode', description: 'Time selection behavior (REQUIRED, OPTIONAL, NONE).', required: false }
    },
    example: `dbxForgeDateTimeField({ key: 'when', label: 'When', timezone: 'America/New_York' })`,
    minimalExample: `dbxForgeDateTimeField({ key: 'when' })`
  },
  {
    slug: 'fixed-date-range',
    factoryName: 'dbxForgeFixedDateRangeField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'fixeddaterange',
    produces: 'DbxForgeFixedDateRangeValue',
    arrayOutput: 'no',
    configInterface: 'DbxForgeFixedDateRangeFieldConfig',
    description: 'Inline calendar-style date-range picker with fixed range length (e.g. "7 days from start"). Wrapped in a Material form-field container with a custom selection strategy.',
    sourcePath: 'field/value/date/fixeddaterange.field.ts',
    config: {
      dateRangeInput: { name: 'dateRangeInput', type: 'DateRangeInputConfig', description: 'Range input type and distance configuration.', required: false },
      pickerConfig: { name: 'pickerConfig', type: 'PickerConfig', description: 'Calendar picker limits, presets, and behavior.', required: false }
    },
    example: `dbxForgeFixedDateRangeField({ key: 'range', label: 'Date Range' })`,
    minimalExample: `dbxForgeFixedDateRangeField({ key: 'range' })`
  },

  // ----- selection — generic T / T[] ----------------------------------
  {
    slug: 'pickable-chip',
    factoryName: 'dbxForgePickableChipField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'dbx-pickable-chip',
    produces: 'T | T[]',
    arrayOutput: 'optional',
    configInterface: 'DbxForgePickableChipFieldConfig<T, M, H>',
    generic: '<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>',
    description: 'Selection field rendering selected values as Material chips. Defaults to multi-select; flip to single-select via the underlying props.',
    sourcePath: 'field/selection/pickable/pickable-chip.field.ts',
    config: {
      loadValues: { name: 'loadValues (props)', type: 'Observable<T[]> | () => Observable<T[]>', description: 'Function/observable producing the list of selectable values.', required: true },
      displayForValue: { name: 'displayForValue (props)', type: '(values: T[]) => Observable<DisplayValue[]>', description: 'Display renderer for selected values.', required: true },
      maxPicks: { name: 'maxPicks (props)', type: 'number', description: 'Maximum number of items that can be selected.', required: false }
    },
    example: `dbxForgePickableChipField<Tag>({ key: 'tags', label: 'Tags', props: { loadValues: () => loadTags$, displayForValue: displayTag } })`,
    minimalExample: `dbxForgePickableChipField({ key: 'tags', props: { loadValues: () => of([]), displayForValue: (v) => of([]) } })`
  },
  {
    slug: 'pickable-list',
    factoryName: 'dbxForgePickableListField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'dbx-pickable-list',
    produces: 'T | T[]',
    arrayOutput: 'optional',
    configInterface: 'DbxForgePickableListFieldConfig<T, M, H>',
    generic: '<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>',
    description: 'Scrollable-list variant of `pickable-chip` — same API, different presentation. Prefer this when the option set is large.',
    sourcePath: 'field/selection/pickable/pickable-list.field.ts',
    config: {
      loadValues: { name: 'loadValues (props)', type: 'Observable<T[]> | () => Observable<T[]>', description: 'Function/observable producing the list of selectable values.', required: true },
      displayForValue: { name: 'displayForValue (props)', type: '(values: T[]) => Observable<DisplayValue[]>', description: 'Display renderer for selected values.', required: true }
    },
    example: `dbxForgePickableListField<Item>({ key: 'items', props: { loadValues, displayForValue } })`,
    minimalExample: `dbxForgePickableListField({ key: 'items', props: { loadValues: () => of([]), displayForValue: (v) => of([]) } })`
  },
  {
    slug: 'searchable-text',
    factoryName: 'dbxForgeSearchableTextField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'dbx-searchable-text',
    produces: 'T',
    arrayOutput: 'no',
    configInterface: 'DbxForgeSearchableTextFieldConfig<T, M, H>',
    generic: '<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>',
    description: 'Single-value autocomplete field with search-as-you-type. Optionally allows free-form typed strings as values.',
    sourcePath: 'field/selection/searchable/searchable-text.field.ts',
    config: {
      search: { name: 'search (props)', type: '(text: string) => Observable<T[]>', description: 'Async search function.', required: true },
      displayForValue: { name: 'displayForValue (props)', type: '(values: T[]) => Observable<DisplayValue[]>', description: 'Display renderer.', required: true },
      allowStringValues: { name: 'allowStringValues (props)', type: 'boolean', description: 'Allow typed strings to be stored directly as values.', required: false }
    },
    example: `dbxForgeSearchableTextField<User>({ key: 'user', props: { search, displayForValue } })`,
    minimalExample: `dbxForgeSearchableTextField({ key: 'q', props: { search: () => of([]), displayForValue: (v) => of([]) } })`
  },
  {
    slug: 'searchable-chip',
    factoryName: 'dbxForgeSearchableChipField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'dbx-searchable-chip',
    produces: 'T | T[]',
    arrayOutput: 'optional',
    configInterface: 'DbxForgeSearchableChipFieldConfig<T, M, H>',
    generic: '<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>',
    description: 'Multi-value autocomplete with chips. Defaults to multi-select; supports free-form text entry when `allowStringValues` is set.',
    sourcePath: 'field/selection/searchable/searchable-chip.field.ts',
    config: {
      search: { name: 'search (props)', type: '(text: string) => Observable<T[]>', description: 'Async search function.', required: true },
      displayForValue: { name: 'displayForValue (props)', type: '(values: T[]) => Observable<DisplayValue[]>', description: 'Display renderer.', required: true },
      allowStringValues: { name: 'allowStringValues (props)', type: 'boolean', description: 'Allow typed strings as chip values.', required: false }
    },
    example: `dbxForgeSearchableChipField<Tag>({ key: 'tags', props: { search, displayForValue } })`,
    minimalExample: `dbxForgeSearchableChipField({ key: 'tags', props: { search: () => of([]), displayForValue: (v) => of([]) } })`
  },
  {
    slug: 'searchable-string-chip',
    factoryName: 'dbxForgeSearchableStringChipField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'dbx-searchable-chip',
    produces: 'string | string[]',
    arrayOutput: 'optional',
    configInterface: 'DbxForgeSearchableStringChipFieldConfig<M>',
    description: 'String-value specialization of `searchable-chip`. `allowStringValues` is forced true — use for free-form tag entry.',
    sourcePath: 'field/selection/searchable/searchable-chip.field.ts',
    config: {
      search: { name: 'search (props)', type: '(text: string) => Observable<string[]>', description: 'Async search function.', required: true },
      displayForValue: { name: 'displayForValue (props)', type: '(values: string[]) => Observable<DisplayValue[]>', description: 'Display renderer.', required: true }
    },
    example: `dbxForgeSearchableStringChipField({ key: 'tags', props: { search, displayForValue } })`,
    minimalExample: `dbxForgeSearchableStringChipField({ key: 'tags', props: { search: () => of([]), displayForValue: (v) => of([]) } })`
  },
  {
    slug: 'list-selection',
    factoryName: 'dbxForgeListSelectionField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'dbx-list-selection',
    produces: 'K[]',
    arrayOutput: 'yes',
    configInterface: 'DbxForgeListSelectionFieldConfig<T, C, K>',
    generic: '<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey>',
    description: 'Multi-select backed by a lazy-loadable custom list component. Use when you need complete control over item layout and pagination.',
    sourcePath: 'field/selection/list/list.field.ts',
    config: {
      listComponentClass: { name: 'listComponentClass (props)', type: 'Observable<Type<C>>', description: 'Custom list component class (can be lazy-loaded).', required: true },
      readKey: { name: 'readKey (props)', type: '(item: T) => K', description: 'Extract the identifier from each item.', required: true },
      state$: { name: 'state$ (props)', type: 'Observable<ListLoadingState<T>>', description: 'Observable providing the items to select.', required: true },
      loadMore: { name: 'loadMore (props)', type: '() => void', description: 'Trigger loading more items for pagination.', required: false }
    },
    example: `dbxForgeListSelectionField<Item, MyListComponent, string>({ key: 'items', props: { listComponentClass, readKey: (i) => i.id, state$ } })`,
    minimalExample: `dbxForgeListSelectionField({ key: 'items', props: { listComponentClass: of(MyListComp), readKey: (i) => i.id, state$: NEVER } })`
  },
  {
    slug: 'value-selection',
    factoryName: 'dbxForgeValueSelectionField',
    tier: 'field-factory',
    wrapperPattern: 'material-form-field-wrapped',
    ngFormType: 'dbx-value-selection',
    produces: 'T',
    arrayOutput: 'no',
    configInterface: 'DbxForgeValueSelectionFieldConfig<T>',
    generic: '<T = unknown>',
    description: 'Single-select dropdown over a static or async value list. Simpler than `source-select` when metadata lookup is unnecessary.',
    sourcePath: 'field/selection/list/list.field.ts',
    config: {
      options: { name: 'options (props)', type: 'MatSelectOption<T>[] | Observable<MatSelectOption<T>[]>', description: 'Options to render in the dropdown.', required: true }
    },
    example: `dbxForgeValueSelectionField<string>({ key: 'status', props: { options: [{ value: 'active', label: 'Active' }] } })`,
    minimalExample: `dbxForgeValueSelectionField({ key: 'v', props: { options: [] } })`
  },
  {
    slug: 'source-select',
    factoryName: 'dbxForgeSourceSelectField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'dbx-source-select',
    produces: 'T | T[]',
    arrayOutput: 'optional',
    configInterface: 'DbxForgeSourceSelectFieldConfig<T, M>',
    generic: '<T extends PrimativeKey = PrimativeKey, M = unknown>',
    description: 'Selection field that stores just the value key (`T`) but resolves full metadata (`M`) async for display. Use for reference fields where the form should store only the id.',
    sourcePath: 'field/selection/sourceselect/sourceselect.field.ts',
    config: {
      valueReader: { name: 'valueReader (props)', type: '(meta: M) => T', description: 'Extract the value identifier from metadata.', required: true },
      metaLoader: { name: 'metaLoader (props)', type: '(values: T[]) => Observable<M[]>', description: 'Async function that loads metadata for selected values.', required: true },
      displayForValue: { name: 'displayForValue (props)', type: '(values: DisplayValue[]) => Observable<DisplayValue[]>', description: 'Display renderer.', required: true },
      multiple: { name: 'multiple (props)', type: 'boolean', description: 'Allow multiple selections.', required: false }
    },
    example: `dbxForgeSourceSelectField<string, User>({ key: 'userId', props: { valueReader: (u) => u.id, metaLoader, displayForValue } })`,
    minimalExample: `dbxForgeSourceSelectField({ key: 'v', props: { valueReader: (m) => m.id, metaLoader: () => of([]), displayForValue: (v) => of([]) } })`
  },
  {
    slug: 'checklist',
    factoryName: 'dbxForgeChecklistField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'multi-checkbox',
    produces: 'T[]',
    arrayOutput: 'yes',
    configInterface: 'DbxForgeChecklistFieldConfig<T>',
    generic: '<T = unknown>',
    description: 'Multi-checkbox group. Use for small static option sets where every option is visible at once.',
    sourcePath: 'field/checklist/checklist.field.ts',
    config: {
      options: { name: 'options (props)', type: '(MatSelectOption | MatOptGroup)[]', description: 'Array of checkbox options or option groups.', required: true }
    },
    example: `dbxForgeChecklistField<string>({ key: 'flags', props: { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } })`,
    minimalExample: `dbxForgeChecklistField({ key: 'v', props: { options: [] } })`
  },

  // ----- editors / component ------------------------------------------
  {
    slug: 'text-editor',
    factoryName: 'dbxForgeTextEditorField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'texteditor',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeTextEditorFieldConfig',
    description: 'Rich HTML text editor (ngx-editor). Output is the serialized HTML string.',
    sourcePath: 'field/texteditor/texteditor.field.ts',
    config: {
      minLength: { name: 'minLength', type: 'number', description: 'Minimum HTML content length.', required: false },
      maxLength: { name: 'maxLength', type: 'number', description: 'Maximum HTML content length.', required: false }
    },
    example: `dbxForgeTextEditorField({ key: 'content', label: 'Body', maxLength: 10000 })`,
    minimalExample: `dbxForgeTextEditorField({ key: 'content' })`
  },
  {
    slug: 'component-field',
    factoryName: 'dbxForgeComponentField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'component',
    produces: 'T',
    arrayOutput: 'no',
    configInterface: 'DbxForgeComponentFieldConfig<T>',
    generic: '<T = unknown>',
    description: 'Escape hatch — injects any Angular component as the field renderer via DbxInjection. Use when no existing form field fits.',
    sourcePath: 'field/component/component.field.ts',
    config: {
      props: { name: 'props', type: 'DbxForgeComponentFieldProps<T>', description: 'Component injection config (component class + data).', required: true }
    },
    example: `dbxForgeComponentField<MyValue>({ key: 'custom', props: { component: MyCustomComp } })`,
    minimalExample: `dbxForgeComponentField({ key: 'x', props: { component: MyComp } })`
  },

  // ----- auth / login helpers ------------------------------------------
  {
    slug: 'password-field',
    factoryName: 'dbxForgeTextPasswordField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeTextPasswordFieldConfig',
    description: 'Password input (HTML `type="password"`) with secure autocomplete defaults.',
    sourcePath: 'template/login.ts',
    config: {
      autocomplete: { name: 'autocomplete', type: 'string', description: 'HTML autocomplete attribute.', required: false, default: 'current-password' }
    },
    example: `dbxForgeTextPasswordField({ key: 'password', required: true })`,
    minimalExample: `dbxForgeTextPasswordField({ key: 'password' })`
  },
  {
    slug: 'verify-password-field',
    factoryName: 'dbxForgeTextVerifyPasswordField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeTextPasswordFieldConfig',
    description: 'Companion to `password-field` for sign-up flows. Defaults `autocomplete` to `new-password`. Pair with `password-with-verify-fields` for cross-field equality validation.',
    sourcePath: 'template/login.ts',
    config: {
      autocomplete: { name: 'autocomplete', type: 'string', description: 'HTML autocomplete attribute.', required: false, default: 'new-password' }
    },
    example: `dbxForgeTextVerifyPasswordField({ key: 'verifyPassword' })`,
    minimalExample: `dbxForgeTextVerifyPasswordField({ key: 'verifyPassword' })`
  },
  {
    slug: 'username-login-field',
    factoryName: 'dbxForgeUsernameLoginField',
    tier: 'field-factory',
    wrapperPattern: 'unwrapped',
    ngFormType: 'input',
    produces: 'string',
    arrayOutput: 'no',
    configInterface: 'DbxForgeUsernameLoginFieldUsernameConfigInput',
    description: 'Username field for login forms. Accepts `"email"` or `"username"` as shorthand presets, or a full config object.',
    sourcePath: 'template/login.ts',
    config: {
      username: { name: 'username', type: "'email' | 'username' | DbxForgeUsernameLoginFieldUsernameConfig", description: 'Preset or custom config controlling email-vs-username behavior.', required: true }
    },
    example: `dbxForgeUsernameLoginField({ username: 'email' })`,
    minimalExample: `dbxForgeUsernameLoginField({ username: 'username' })`
  },

  // =====================================================================
  // COMPOSITE BUILDERS
  // =====================================================================

  {
    slug: 'date-range-row',
    factoryName: 'dbxForgeDateRangeRow',
    tier: 'composite-builder',
    suffix: 'Row',
    produces: 'RowField',
    arrayOutput: 'no',
    configInterface: 'DbxForgeDateRangeRowConfig',
    description: 'Two-column row of start/end date-time fields configured for date-only picking. Use when you need a paired start/end date range laid out horizontally.',
    sourcePath: 'field/value/date/daterange.field.ts',
    composesFromSlugs: ['date-time', 'row'],
    config: {
      required: { name: 'required', type: 'boolean', description: 'Whether both fields are required.', required: false, default: false },
      start: { name: 'start', type: 'Partial<DbxForgeDateRangeFieldDateConfig>', description: 'Overrides merged into the start field.', required: false },
      end: { name: 'end', type: 'Partial<DbxForgeDateRangeFieldDateConfig>', description: 'Overrides merged into the end field.', required: false },
      timezone: { name: 'timezone', type: 'string', description: 'Timezone propagated to both underlying date-time fields.', required: false }
    },
    example: `dbxForgeDateRangeRow({ required: true, start: { key: 'from', label: 'From' }, end: { key: 'to', label: 'To' } })`,
    minimalExample: `dbxForgeDateRangeRow()`
  },
  {
    slug: 'date-time-range-row',
    factoryName: 'dbxForgeDateTimeRangeRow',
    tier: 'composite-builder',
    suffix: 'Row',
    produces: 'RowField',
    arrayOutput: 'no',
    configInterface: 'DbxForgeDateTimeRangeRowConfig',
    description: 'Two-column row of time-only pickers for selecting a time range within a single day.',
    sourcePath: 'field/value/date/datetimerange.field.ts',
    composesFromSlugs: ['date-time', 'row'],
    config: {
      required: { name: 'required', type: 'boolean', description: 'Whether both time fields are required.', required: false },
      start: { name: 'start', type: 'Partial<DbxForgeDateTimeRangeFieldTimeConfig>', description: 'Per-field overrides for the start time picker.', required: false },
      end: { name: 'end', type: 'Partial<DbxForgeDateTimeRangeFieldTimeConfig>', description: 'Per-field overrides for the end time picker.', required: false }
    },
    example: `dbxForgeDateTimeRangeRow({ start: { label: 'From' }, end: { label: 'Until' } })`,
    minimalExample: `dbxForgeDateTimeRangeRow()`
  },
  {
    slug: 'address-fields',
    factoryName: 'dbxForgeAddressFields',
    tier: 'composite-builder',
    suffix: 'Fields',
    produces: 'FieldDef[]',
    arrayOutput: 'no',
    configInterface: 'DbxForgeAddressFieldsConfig',
    description: 'Flat array of address fields (line(s), city, state, zip, optional country) with a sensible flex layout. Drop directly into a parent `fields: []`.',
    sourcePath: 'field/value/text/text.address.field.ts',
    composesFromSlugs: ['address-line', 'city', 'state', 'zip-code', 'country'],
    config: {
      required: { name: 'required', type: 'boolean', description: 'Whether every field is required.', required: false, default: true },
      includeLine2: { name: 'includeLine2', type: 'boolean', description: 'Include the secondary address line.', required: false, default: true },
      includeCountry: { name: 'includeCountry', type: 'boolean', description: 'Include the country field.', required: false, default: true }
    },
    example: `dbxForgeAddressFields({ required: true, includeCountry: false })`,
    minimalExample: `dbxForgeAddressFields()`
  },
  {
    slug: 'address-group',
    factoryName: 'dbxForgeAddressGroup',
    tier: 'composite-builder',
    suffix: 'Group',
    produces: 'GroupField',
    arrayOutput: 'no',
    configInterface: 'DbxForgeAddressGroupConfig',
    description: "Wraps `address-fields` in a `GroupField` so the address is stored as a nested object under one key. Prefer this when the rest of the form doesn't want address fields flattened.",
    sourcePath: 'field/value/text/text.address.field.ts',
    composesFromSlugs: ['address-fields', 'group'],
    config: {
      key: { name: 'key', type: 'string', description: 'Group key for the nested address object.', required: false, default: 'address' }
    },
    example: `dbxForgeAddressGroup({ key: 'billingAddress' })`,
    minimalExample: `dbxForgeAddressGroup()`
  },
  {
    slug: 'address-list',
    factoryName: 'dbxForgeAddressListField',
    tier: 'composite-builder',
    suffix: 'Field',
    produces: 'ArrayField',
    arrayOutput: 'yes',
    configInterface: 'DbxForgeAddressListFieldConfig',
    description: 'Repeatable array of addresses built on top of `array-field` + `address-group`. Keeps the `Field` suffix because it returns a single composite field whose value is an array of addresses.',
    sourcePath: 'field/value/text/text.address.field.ts',
    composesFromSlugs: ['address-group', 'array-field'],
    config: {
      maxAddresses: { name: 'maxAddresses', type: 'number', description: 'Maximum number of addresses allowed.', required: false, default: 6 }
    },
    example: `dbxForgeAddressListField({ maxAddresses: 3 })`,
    minimalExample: `dbxForgeAddressListField()`
  },
  {
    slug: 'toggle-wrapper',
    factoryName: 'dbxForgeToggleWrapper',
    tier: 'composite-builder',
    suffix: 'Wrapper',
    produces: 'RowField',
    arrayOutput: 'no',
    configInterface: 'DbxForgeToggleWrapperConfig',
    description: 'Wraps content fields in a Material slide toggle — the toggle state controls conditional visibility of the inner fields.',
    sourcePath: 'field/wrapper/wrapper.ts',
    composesFromSlugs: ['toggle', 'group'],
    config: {
      fields: { name: 'fields', type: 'FieldDef[]', description: 'Fields to reveal when the toggle is on.', required: true },
      label: { name: 'label', type: 'string', description: 'Toggle label.', required: false },
      defaultOpen: { name: 'defaultOpen', type: 'boolean', description: 'Initial toggle state.', required: false, default: false }
    },
    example: `dbxForgeToggleWrapper({ label: 'Advanced', fields: [dbxForgeTextField({ key: 'note' })] })`,
    minimalExample: `dbxForgeToggleWrapper({ fields: [] })`
  },
  {
    slug: 'expand-wrapper',
    factoryName: 'dbxForgeExpandWrapper',
    tier: 'composite-builder',
    suffix: 'Wrapper',
    produces: 'RowField',
    arrayOutput: 'no',
    configInterface: 'DbxForgeExpandWrapperConfig',
    description: 'Wraps content fields behind a button or text "expand" control. Use for optional sections like "Show advanced options".',
    sourcePath: 'field/wrapper/wrapper.ts',
    composesFromSlugs: ['group'],
    config: {
      fields: { name: 'fields', type: 'FieldDef[]', description: 'Fields to show when expanded.', required: true },
      label: { name: 'label', type: 'string', description: 'Expand trigger label.', required: false },
      buttonType: { name: 'buttonType', type: "'button' | 'text'", description: 'Expand trigger visual style.', required: false, default: 'text' },
      defaultOpen: { name: 'defaultOpen', type: 'boolean', description: 'Initial expand state.', required: false, default: false }
    },
    example: `dbxForgeExpandWrapper({ label: 'Show details', fields: [dbxForgeTextField({ key: 'note' })] })`,
    minimalExample: `dbxForgeExpandWrapper({ fields: [] })`
  },
  {
    slug: 'flex-layout',
    factoryName: 'dbxForgeFlexLayout',
    tier: 'composite-builder',
    suffix: 'Layout',
    produces: 'GroupField',
    arrayOutput: 'no',
    configInterface: 'DbxForgeFlexLayoutConfig',
    description: 'Responsive flex group — children lay out horizontally at wide breakpoints and stack at narrow ones. Per-field `size` overrides the default column weight.',
    sourcePath: 'field/wrapper/flex/flex.wrapper.ts',
    composesFromSlugs: ['group'],
    config: {
      fieldConfigs: { name: 'fieldConfigs', type: '(FieldDef | { field: FieldDef; size: DbxFlexSize })[]', description: 'Fields or field+size pairs.', required: true },
      breakpoint: { name: 'breakpoint', type: 'ScreenMediaWidthType', description: 'Breakpoint below which fields stack vertically.', required: false },
      size: { name: 'size', type: 'DbxFlexSize', description: 'Default flex size for fields without their own.', required: false, default: 2 }
    },
    example: `dbxForgeFlexLayout({ fieldConfigs: [dbxForgeTextField({ key: 'a' }), dbxForgeTextField({ key: 'b' })] })`,
    minimalExample: `dbxForgeFlexLayout({ fieldConfigs: [] })`
  },
  {
    slug: 'password-with-verify-fields',
    factoryName: 'dbxForgeTextPasswordWithVerifyField',
    tier: 'composite-builder',
    suffix: 'Fields',
    produces: 'FieldDef[]',
    arrayOutput: 'no',
    configInterface: 'DbxForgeTextPasswordWithVerifyFieldConfig',
    description: 'Password + verify-password pair with cross-field equality validation wired up. Drop-in for sign-up flows.',
    sourcePath: 'template/login.ts',
    composesFromSlugs: ['password-field', 'verify-password-field'],
    config: {
      password: { name: 'password', type: 'DbxForgeTextPasswordFieldConfig', description: 'Override config for the primary password field.', required: false },
      verifyPassword: { name: 'verifyPassword', type: 'DbxForgeTextPasswordFieldConfig', description: 'Override config for the verify password field.', required: false }
    },
    example: `dbxForgeTextPasswordWithVerifyField({ password: { required: true } })`,
    minimalExample: `dbxForgeTextPasswordWithVerifyField({})`
  },
  {
    slug: 'username-password-login-fields',
    factoryName: 'dbxForgeUsernamePasswordLoginFields',
    tier: 'composite-builder',
    suffix: 'Fields',
    produces: 'FieldDef[]',
    arrayOutput: 'no',
    configInterface: 'DbxForgeUsernameLoginFieldsConfig',
    description: 'Complete login/signup field set: username, password, and optional verify-password. Drop into the top-level `fields: []`.',
    sourcePath: 'template/login.ts',
    composesFromSlugs: ['username-login-field', 'password-field', 'verify-password-field'],
    config: {
      username: { name: 'username', type: 'DbxForgeUsernameLoginFieldUsernameConfigInput', description: 'Username preset or full config.', required: true },
      verifyPassword: { name: 'verifyPassword', type: 'boolean | DbxForgeTextPasswordFieldConfig', description: 'Include a verify-password field. Pass `true` or override config.', required: false }
    },
    example: `dbxForgeUsernamePasswordLoginFields({ username: 'email', verifyPassword: true })`,
    minimalExample: `dbxForgeUsernamePasswordLoginFields({ username: 'email' })`
  },

  // =====================================================================
  // PRIMITIVES
  // =====================================================================

  {
    slug: 'row',
    factoryName: 'dbxForgeRow',
    tier: 'primitive',
    produces: 'RowField',
    arrayOutput: 'no',
    returns: 'RowField',
    configInterface: 'DbxForgeRowConfig',
    description: 'Flex row that lays child fields out in columns. Child fields typically carry a `col` property (1–12) for grid placement.',
    sourcePath: 'field/wrapper/wrapper.ts',
    config: {
      fields: { name: 'fields', type: 'RowAllowedChildren[]', description: 'Child fields to render as row columns.', required: true }
    },
    example: `dbxForgeRow({ fields: [ { ...dbxForgeTextField({ key: 'first' }), col: 6 }, { ...dbxForgeTextField({ key: 'last' }), col: 6 } ] })`,
    minimalExample: `dbxForgeRow({ fields: [] })`
  },
  {
    slug: 'group',
    factoryName: 'dbxForgeGroup',
    tier: 'primitive',
    produces: 'GroupField',
    arrayOutput: 'no',
    returns: 'GroupField',
    configInterface: 'DbxForgeGroupConfig',
    description: "Group container nesting child fields so their values roll up into one object under the group's key.",
    sourcePath: 'field/wrapper/wrapper.ts',
    config: {
      fields: { name: 'fields', type: 'GroupAllowedChildren[]', description: 'Child field definitions.', required: true }
    },
    example: `dbxForgeGroup({ key: 'profile', fields: [dbxForgeTextField({ key: 'name' })] })`,
    minimalExample: `dbxForgeGroup({ key: 'g', fields: [] })`
  },
  {
    slug: 'array-field',
    factoryName: 'dbxForgeArrayField',
    tier: 'primitive',
    produces: 'ArrayField',
    arrayOutput: 'yes',
    returns: 'ArrayField',
    configInterface: 'DbxForgeArrayFieldConfig',
    description: 'Repeatable array wrapper with add/remove/drag-to-reorder controls. Template fields are cloned per item. Internally built with `dbxForgeFieldFunction` but categorized as a primitive because composites wrap it.',
    sourcePath: 'field/wrapper/array-field/array-field.ts',
    config: {
      template: { name: 'template', type: "ContainerField['fields']", description: 'Template fields rendered per array item.', required: true },
      props: { name: 'props', type: 'DbxForgeArrayFieldWrapperProps', description: 'Label, hint, add/remove text.', required: false }
    },
    example: `dbxForgeArrayField({ key: 'tags', template: [dbxForgeTextField({ key: 'value' })] })`,
    minimalExample: `dbxForgeArrayField({ key: 'items', template: [] })`
  },
  {
    slug: 'section-wrapper',
    factoryName: 'dbxForgeSectionWrapper',
    tier: 'primitive',
    produces: 'WrapperConfig',
    arrayOutput: 'no',
    returns: 'WrapperConfig',
    configInterface: 'DbxForgeSectionWrapper',
    description: "Section wrapper config — attach via a field's `wrappers: []` array for a semantic section with header and optional card elevation.",
    sourcePath: 'field/wrapper/section/section.wrapper.ts',
    config: {
      headerConfig: { name: 'headerConfig', type: 'DbxSectionHeaderConfig', description: 'Header text and heading level.', required: true },
      elevate: { name: 'elevate', type: 'boolean', description: 'Apply elevated card styling.', required: false }
    },
    example: `dbxForgeSectionWrapper({ headerConfig: { text: 'Contact Details' } })`,
    minimalExample: `dbxForgeSectionWrapper({ headerConfig: { text: 'X' } })`
  },
  {
    slug: 'subsection-wrapper',
    factoryName: 'dbxForgeSubsectionWrapper',
    tier: 'primitive',
    produces: 'WrapperConfig',
    arrayOutput: 'no',
    returns: 'WrapperConfig',
    configInterface: 'DbxForgeSectionWrapper',
    description: 'Subsection variant of `section-wrapper` — defaults to heading level 4 and `subsection: true`.',
    sourcePath: 'field/wrapper/section/section.wrapper.ts',
    config: {
      headerConfig: { name: 'headerConfig', type: 'DbxSectionHeaderConfig', description: 'Subsection header configuration.', required: true }
    },
    example: `dbxForgeSubsectionWrapper({ headerConfig: { text: 'Options' } })`,
    minimalExample: `dbxForgeSubsectionWrapper({ headerConfig: { text: 'X' } })`
  },
  {
    slug: 'style-wrapper',
    factoryName: 'dbxForgeStyleWrapper',
    tier: 'primitive',
    produces: 'WrapperConfig',
    arrayOutput: 'no',
    returns: 'WrapperConfig',
    configInterface: 'DbxForgeStyleWrapper',
    description: 'Style wrapper config — applies dynamic CSS classes (`ngClass`) and/or inline styles (`ngStyle`) to any field via its `wrappers: []`.',
    sourcePath: 'field/wrapper/style/style.wrapper.ts',
    config: {
      classGetter: { name: 'classGetter', type: 'MaybeObservableOrValue<string>', description: 'Static or observable CSS class names.', required: false },
      styleGetter: { name: 'styleGetter', type: 'MaybeObservableOrValue<DbxForgeStyleObject>', description: 'Static or observable inline styles.', required: false }
    },
    example: `dbxForgeStyleWrapper({ classGetter: 'highlighted' })`,
    minimalExample: `dbxForgeStyleWrapper({})`
  }
];
