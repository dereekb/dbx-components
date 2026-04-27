import type { ExamplePattern } from '../form-patterns.js';

export const FORM_PATTERN_CONTACT_FORM: ExamplePattern = {
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
};
