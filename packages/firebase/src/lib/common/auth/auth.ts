import { Maybe } from '@dereekb/util';

/**
 * Firebase User Identifier (UID)
 */
export type FirebaseAuthUserId = string;

/**
 * Firebase Auth Token interface
 */
export type FirebaseAuthToken = {
  email?: Maybe<string>;
  emailVerified?: Maybe<boolean>;
  phoneNumber?: Maybe<string>;
};
