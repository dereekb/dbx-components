import * as admin from 'firebase-admin';
import { FactoryProvider, InjectionToken, Module } from "@nestjs/common";

// MARK: Tokens
/**
 * Nest Injection Token to access the 
 */
export const FIREBASE_APP_TOKEN: InjectionToken = 'FIREBASE_APP_TOKEN';

/**
 * Token to access the Firestore.
 */
export const FIRESTORE_TOKEN: InjectionToken = 'FIRESTORE_TOKEN';

/**
 * Token to access the root FirestoreContext for a server.
 */
export const FIRESTORE_CONTEXT_TOKEN: InjectionToken = 'FIRESTORE_CONTEXT_TOKEN';

// MARK: Firebase Admin Provider
export function firebaseServerAppTokenProvider(useFactory: () => admin.app.App): FactoryProvider<any> {
  return {
    provide: FIREBASE_APP_TOKEN,
    useFactory
  };
}

/**
 * Nest provider module for Firebase that provides a firestore, etc. from the firestore token.
 */
@Module({
  providers: [{
    provide: FIRESTORE_TOKEN,
    useFactory: (app: admin.app.App) => app.firestore(),
    inject: [FIREBASE_APP_TOKEN]
  }],
  exports: [FIRESTORE_TOKEN]
})
export class FirebaseServerFirestoreModule { }
