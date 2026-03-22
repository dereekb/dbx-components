import { type Maybe } from '@dereekb/util';
import { type FirebaseLoginMethodType, type KnownFirebaseLoginMethodType } from './login';

/**
 * Map of Firebase provider IDs to known login method types.
 *
 * @example
 * ```ts
 * FIREBASE_PROVIDER_ID_TO_LOGIN_METHOD_TYPE_MAP['google.com']; // 'google'
 * ```
 */
export const FIREBASE_PROVIDER_ID_TO_LOGIN_METHOD_TYPE_MAP: Record<string, KnownFirebaseLoginMethodType> = {
  'google.com': 'google',
  'facebook.com': 'facebook',
  'github.com': 'github',
  'twitter.com': 'twitter',
  'apple.com': 'apple',
  'microsoft.com': 'microsoft',
  phone: 'phone',
  password: 'email'
};

/**
 * Map of known login method types to Firebase provider IDs.
 *
 * @example
 * ```ts
 * LOGIN_METHOD_TYPE_TO_FIREBASE_PROVIDER_ID_MAP['google']; // 'google.com'
 * ```
 */
export const LOGIN_METHOD_TYPE_TO_FIREBASE_PROVIDER_ID_MAP: Record<string, string> = {
  google: 'google.com',
  facebook: 'facebook.com',
  github: 'github.com',
  twitter: 'twitter.com',
  apple: 'apple.com',
  microsoft: 'microsoft.com',
  phone: 'phone',
  email: 'password'
};

/**
 * Converts a Firebase provider ID (e.g., 'google.com') to its corresponding login method type (e.g., 'google').
 *
 * @param providerId - The Firebase provider ID.
 * @returns The matching login method type, or undefined if unknown.
 *
 * @example
 * ```ts
 * firebaseProviderIdToLoginMethodType('google.com'); // 'google'
 * firebaseProviderIdToLoginMethodType('unknown.com'); // undefined
 * ```
 */
export function firebaseProviderIdToLoginMethodType(providerId: string): Maybe<FirebaseLoginMethodType> {
  return FIREBASE_PROVIDER_ID_TO_LOGIN_METHOD_TYPE_MAP[providerId];
}

/**
 * Converts a login method type (e.g., 'google') to its corresponding Firebase provider ID (e.g., 'google.com').
 *
 * @param type - The login method type.
 * @returns The matching Firebase provider ID, or undefined if unknown.
 *
 * @example
 * ```ts
 * loginMethodTypeToFirebaseProviderId('google'); // 'google.com'
 * loginMethodTypeToFirebaseProviderId('unknown'); // undefined
 * ```
 */
export function loginMethodTypeToFirebaseProviderId(type: FirebaseLoginMethodType): Maybe<string> {
  return LOGIN_METHOD_TYPE_TO_FIREBASE_PROVIDER_ID_MAP[type];
}
