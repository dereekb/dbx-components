
export type FirebaseLoginMethodType = string;
export type FirebaseLoginMethodCategory = string;

export type KnownFirebaseLoginMethodType = 'email' | 'phone' | 'google' | 'facebook' | 'github' | 'twitter' | 'apple' | 'microsoft' | 'anonymous'; // TODO: Add more


export const DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY = 'default';
export const OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY = 'oauth';

export type KnownFirebaseLoginMethodCategory = typeof DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY | typeof OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY;

export type DbxFirebaseLoginMode = 'login' | 'register';
