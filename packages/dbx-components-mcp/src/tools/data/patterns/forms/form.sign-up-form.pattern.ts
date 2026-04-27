import type { ExamplePattern } from '../form-patterns.js';

export const FORM_PATTERN_SIGN_UP_FORM: ExamplePattern = {
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
};
