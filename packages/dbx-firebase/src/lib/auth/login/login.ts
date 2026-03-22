/**
 * String identifier for a Firebase authentication method (e.g., 'email', 'google').
 */
export type FirebaseLoginMethodType = string;
/**
 * Category grouping for login methods (e.g., 'default', 'oauth').
 */
export type FirebaseLoginMethodCategory = string;

/**
 * Known Firebase login method types supported by the login UI.
 */
export type KnownFirebaseLoginMethodType = 'email' | 'phone' | 'google' | 'facebook' | 'github' | 'twitter' | 'apple' | 'microsoft' | 'anonymous'; // TODO: Add more

/**
 * Category for built-in login methods (email, phone, anonymous).
 */
export const DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY = 'default';
/**
 * Category for OAuth-based login methods (Google, Facebook, etc.).
 */
export const OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY = 'oauth';

/**
 * Known categories for Firebase login methods.
 */
export type KnownFirebaseLoginMethodCategory = typeof DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY | typeof OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY;

/**
 * Mode for the login UI — either signing in or creating a new account.
 */
export type DbxFirebaseLoginMode = 'login' | 'register' | 'link' | 'unlink';
