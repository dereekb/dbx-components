/**
 * Curated dbx-form compositions used by the `dbx_form_examples` tool.
 *
 * Each entry shows how to compose multiple form entries into a complete,
 * copy-paste-ready `FormConfig`. The per-field registry already surfaces
 * minimal single-field examples via `dbx_form_lookup` — PATTERNS is deliberately
 * about MULTI-field compositions that answer "how do I build a ___ form?"
 *
 * Authored prose, not generated — keep entries tight and grounded in working
 * idioms from the dbx-form source.
 */

export type ExampleDepth = 'minimal' | 'brief' | 'full';

export interface ExamplePattern {
  /** Slug used as the pattern key and in `dbx_form_examples pattern="..."` calls. */
  readonly slug: string;
  /** Short display name. */
  readonly name: string;
  /** One-sentence description of what the pattern builds. */
  readonly summary: string;
  /** Form slugs that this pattern composes from. Useful for cross-linking. */
  readonly usesFormSlugs: readonly string[];
  /** Code snippets at increasing levels of detail. */
  readonly snippets: {
    readonly minimal: string;
    readonly brief: string;
    readonly full: string;
  };
  /** Optional supplementary notes appended to `full` depth. */
  readonly notes?: string;
}

export const EXAMPLE_PATTERNS: readonly ExamplePattern[] = [
  {
    slug: 'contact-form',
    name: 'Contact form',
    summary: 'Name + email + phone + multi-line message, arranged in a single column.',
    usesFormSlugs: ['name', 'email', 'phone', 'text-area'],
    snippets: {
      minimal: `[
  dbxForgeNameField({ key: 'name', required: true }),
  dbxForgeEmailField({ key: 'email', required: true }),
  dbxForgePhoneField({ key: 'phone' }),
  dbxForgeTextAreaField({ key: 'message', label: 'Message', rows: 4, required: true })
]`,
      brief: `// FormConfig.fields
const contactFields: FieldDef[] = [
  dbxForgeNameField({ key: 'name', required: true }),
  dbxForgeEmailField({ key: 'email', required: true }),
  dbxForgePhoneField({ key: 'phone' }),
  dbxForgeTextAreaField({ key: 'message', label: 'Message', rows: 4, required: true })
];`,
      full: `import { dbxForgeNameField, dbxForgeEmailField, dbxForgePhoneField, dbxForgeTextAreaField } from '@dereekb/dbx-form';

export const contactFormConfig: FormConfig<ContactFormValue> = {
  fields: [
    dbxForgeNameField({ key: 'name', label: 'Your name', required: true }),
    dbxForgeEmailField({ key: 'email', required: true }),
    dbxForgePhoneField({ key: 'phone', label: 'Phone (optional)' }),
    dbxForgeTextAreaField({ key: 'message', label: 'Message', rows: 5, required: true, maxLength: 2000 })
  ]
};

export interface ContactFormValue {
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly message: string;
}`
    }
  },
  {
    slug: 'sign-up-form',
    name: 'Sign-up form',
    summary: 'Email-based username + password with confirmation, all wired up for cross-field equality via the login composite.',
    usesFormSlugs: ['username-password-login-fields', 'username-login-field', 'password-field', 'verify-password-field'],
    snippets: {
      minimal: `dbxForgeUsernamePasswordLoginFields({ username: 'email', verifyPassword: true })`,
      brief: `// Sign-up form — uses the login composite with verifyPassword enabled
const signUpFields = dbxForgeUsernamePasswordLoginFields({
  username: 'email',
  verifyPassword: true
});`,
      full: `import { dbxForgeUsernamePasswordLoginFields } from '@dereekb/dbx-form';

export const signUpFormConfig: FormConfig<SignUpValue> = {
  fields: dbxForgeUsernamePasswordLoginFields({
    username: 'email',
    password: { required: true },
    verifyPassword: true
  })
};

export interface SignUpValue {
  readonly username: string;
  readonly password: string;
  readonly verifyPassword: string;
}`
    },
    notes: 'Pass `username: "username"` for plain-text username fields instead of email. Omit `verifyPassword` (or set to `false`) for a login form rather than sign-up.'
  },
  {
    slug: 'login-form',
    name: 'Login form',
    summary: 'Email + password, no verification.',
    usesFormSlugs: ['username-password-login-fields'],
    snippets: {
      minimal: `dbxForgeUsernamePasswordLoginFields({ username: 'email' })`,
      brief: `const loginFields = dbxForgeUsernamePasswordLoginFields({ username: 'email' });`,
      full: `import { dbxForgeUsernamePasswordLoginFields } from '@dereekb/dbx-form';

export const loginFormConfig: FormConfig<LoginValue> = {
  fields: dbxForgeUsernamePasswordLoginFields({ username: 'email' })
};

export interface LoginValue {
  readonly username: string;
  readonly password: string;
}`
    }
  },
  {
    slug: 'address-form',
    name: 'Address form',
    summary: 'Full US-style address (line 1, optional line 2, city, state, zip, optional country) as a nested group.',
    usesFormSlugs: ['address-group', 'address-fields', 'address-line', 'city', 'state', 'zip-code', 'country'],
    snippets: {
      minimal: `dbxForgeAddressGroup({ key: 'address' })`,
      brief: `// Nested under \`address\` in the form value
const addressField = dbxForgeAddressGroup({ key: 'billingAddress' });`,
      full: `import { dbxForgeAddressGroup } from '@dereekb/dbx-form';

export const checkoutFormConfig: FormConfig<CheckoutValue> = {
  fields: [
    dbxForgeAddressGroup({ key: 'shipping' }),
    dbxForgeAddressGroup({ key: 'billing' })
  ]
};

export interface CheckoutValue {
  readonly shipping: AddressValue;
  readonly billing: AddressValue;
}`
    },
    notes: 'Use `dbxForgeAddressFields({})` (plural) to get the bare FieldDef[] for inlining into an existing parent instead of a nested group. Use `dbxForgeAddressListField()` for a repeatable list of addresses.'
  },
  {
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
  },
  {
    slug: 'tag-picker',
    name: 'Tag picker',
    summary: 'Multi-select searchable chips over a string tag list.',
    usesFormSlugs: ['searchable-string-chip', 'searchable-chip', 'pickable-chip'],
    snippets: {
      minimal: `dbxForgeSearchableStringChipField({
  key: 'tags',
  props: { search: (text) => searchTags(text), displayForValue: (values) => of(values.map(valueAsDisplay)) }
})`,
      brief: `const tagField = dbxForgeSearchableStringChipField({
  key: 'tags',
  label: 'Tags',
  hint: 'Type to search or add a new tag',
  props: {
    search: (text) => searchTags(text),
    displayForValue: (values) => of(values.map(valueAsDisplay))
  }
});`,
      full: `import { dbxForgeSearchableStringChipField } from '@dereekb/dbx-form';
import { of } from 'rxjs';

const searchTags = (text: string) => inject(TagService).search(text);
const valueAsDisplay = (v: string) => ({ value: v, label: v });

export const articleFormConfig: FormConfig<ArticleValue> = {
  fields: [
    dbxForgeTextField({ key: 'title', required: true }),
    dbxForgeSearchableStringChipField({
      key: 'tags',
      label: 'Tags',
      hint: 'Type to search or add a new tag',
      props: {
        search: searchTags,
        displayForValue: (values) => of(values.map(valueAsDisplay)),
        allowStringValues: true
      }
    })
  ]
};

export interface ArticleValue {
  readonly title: string;
  readonly tags?: string[];
}`
    },
    notes: 'Switch to `dbxForgeSearchableChipField<T>()` when your tags are objects rather than strings. Use `dbxForgePickableChipField<T>()` for a static (non-searched) option set.'
  },
  {
    slug: 'expandable-advanced',
    name: 'Expandable "advanced" options',
    summary: 'Always-visible required fields with a collapsible bucket of optional advanced settings below.',
    usesFormSlugs: ['expand-wrapper', 'toggle', 'number', 'text'],
    snippets: {
      minimal: `dbxForgeExpandWrapper({
  label: 'Show advanced options',
  fields: [dbxForgeNumberField({ key: 'timeoutMs', label: 'Timeout (ms)' })]
})`,
      brief: `const fields = [
  dbxForgeTextField({ key: 'name', required: true }),
  dbxForgeExpandWrapper({
    label: 'Show advanced options',
    fields: [
      dbxForgeNumberField({ key: 'timeoutMs', label: 'Timeout (ms)', min: 0 }),
      dbxForgeToggleField({ key: 'enableDebug', label: 'Debug mode' })
    ]
  })
];`,
      full: `import { dbxForgeTextField, dbxForgeToggleField, dbxForgeNumberField, dbxForgeExpandWrapper } from '@dereekb/dbx-form';

export const settingsFormConfig: FormConfig<SettingsValue> = {
  fields: [
    dbxForgeTextField({ key: 'name', label: 'Name', required: true }),
    dbxForgeExpandWrapper({
      label: 'Show advanced options',
      buttonType: 'text',
      fields: [
        dbxForgeNumberField({ key: 'timeoutMs', label: 'Timeout (ms)', min: 0, step: 100 }),
        dbxForgeToggleField({ key: 'enableDebug', label: 'Debug mode' })
      ]
    })
  ]
};

export interface SettingsValue {
  readonly name: string;
  readonly timeoutMs?: number;
  readonly enableDebug?: boolean;
}`
    },
    notes: "Switch to `dbxForgeToggleWrapper` when you want a slide toggle (rather than a text/button expand control) to drive visibility. Use `dbxForgeSectionWrapper` via a field's `wrappers: []` for always-visible labelled sections."
  }
];

/**
 * Looks up an example pattern by its slug.
 */
export function getExamplePattern(slug: string): ExamplePattern | undefined {
  const lowered = slug.trim().toLowerCase();
  const result = EXAMPLE_PATTERNS.find((p) => p.slug === lowered);
  return result;
}
