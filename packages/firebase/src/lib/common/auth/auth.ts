import { Maybe, PhoneNumber } from '@dereekb/util';

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
  phoneNumber?: Maybe<PhoneNumber>;
};

/**
 * A string key used to test for ownership of a particular set of objects.
 *
 * For instance, a database model (or its parent) may have an ownership key associated with it that is compared with the user's current claims.
 */
export type FirebaseAuthOwnershipKey = string;
