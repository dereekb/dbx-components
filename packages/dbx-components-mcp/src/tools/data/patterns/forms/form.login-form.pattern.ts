import type { ExamplePattern } from '../form-patterns.js';

export const FORM_PATTERN_LOGIN_FORM: ExamplePattern = {
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
};
