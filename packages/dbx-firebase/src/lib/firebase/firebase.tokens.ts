import { InjectionToken } from '@angular/core';
import { type FirebaseApp } from 'firebase/app';
import { type AppCheck } from 'firebase/app-check';
import { type Auth } from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';
import { type Functions } from 'firebase/functions';
import { type FirebaseStorage } from 'firebase/storage';

/**
 * Injection token for the Firebase App instance.
 */
export const FIREBASE_APP_TOKEN = new InjectionToken<FirebaseApp>('FirebaseApp');

/**
 * Injection token for the Firebase Auth instance.
 */
export const FIREBASE_AUTH_TOKEN = new InjectionToken<Auth>('FirebaseAuth');

/**
 * Injection token for the Firestore instance.
 */
export const FIREBASE_FIRESTORE_TOKEN = new InjectionToken<Firestore>('Firestore');

/**
 * Injection token for the Firebase Storage instance.
 *
 * Uses `FirebaseStorage` (not `Storage`) to avoid collision with the Web Storage API.
 */
export const FIREBASE_STORAGE_TOKEN = new InjectionToken<FirebaseStorage>('FirebaseStorage');

/**
 * Injection token for the Firebase Functions instance.
 */
export const FIREBASE_FUNCTIONS_TOKEN = new InjectionToken<Functions>('FirebaseFunctions');

/**
 * Injection token for the Firebase App Check instance.
 */
export const FIREBASE_APP_CHECK_TOKEN = new InjectionToken<AppCheck>('FirebaseAppCheck');
