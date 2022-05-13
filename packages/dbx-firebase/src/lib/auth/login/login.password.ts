import { TextPasswordFieldPasswordParameters } from "@dereekb/dbx-form";

export interface DbxFirebaseAuthLoginPasswordConfig extends TextPasswordFieldPasswordParameters { }

export const DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG: DbxFirebaseAuthLoginPasswordConfig = {
  minLength: 6
};
