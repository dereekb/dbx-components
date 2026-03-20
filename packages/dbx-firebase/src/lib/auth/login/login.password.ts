import { type TextPasswordFieldPasswordParameters } from '@dereekb/dbx-form';

/**
 * Password validation configuration for Firebase email/password login forms.
 */
export type DbxFirebaseAuthLoginPasswordConfig = TextPasswordFieldPasswordParameters;

/**
 * Default password config requiring a minimum of 6 characters (Firebase Auth minimum).
 */
export const DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG: DbxFirebaseAuthLoginPasswordConfig = {
  minLength: 6
};
