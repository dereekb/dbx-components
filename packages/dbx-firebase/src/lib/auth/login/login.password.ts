import { type TextPasswordFieldPasswordParameters } from '@dereekb/dbx-form';

export type DbxFirebaseAuthLoginPasswordConfig = TextPasswordFieldPasswordParameters;

export const DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG: DbxFirebaseAuthLoginPasswordConfig = {
  minLength: 6
};
