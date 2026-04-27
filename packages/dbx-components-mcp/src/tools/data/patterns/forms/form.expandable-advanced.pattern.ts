import type { ExamplePattern } from '../form-patterns.js';

export const FORM_PATTERN_EXPANDABLE_ADVANCED: ExamplePattern = {
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
};
