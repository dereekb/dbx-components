import * as admin from 'firebase-admin';
import { FactoryProvider, InjectionToken } from "@nestjs/common";

// MARK: Tokens
/**
 * Nest Injection Token to access the 
 */
export const FIREBASE_APP_TOKEN: InjectionToken = 'FIREBASE_APP_TOKEN';

// MARK: Firebase Admin Provider
export function firebaseServerAppTokenProvider(useFactory: () => admin.app.App): FactoryProvider<admin.app.App> {
  return {
    provide: FIREBASE_APP_TOKEN,
    useFactory
  };
}
