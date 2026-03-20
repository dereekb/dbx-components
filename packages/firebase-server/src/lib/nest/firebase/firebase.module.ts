import type * as admin from 'firebase-admin';
import { type FactoryProvider, type InjectionToken } from '@nestjs/common';

// MARK: Tokens
/**
 * NestJS injection token for the Firebase Admin {@link admin.app.App} instance.
 *
 * Injected globally by {@link nestServerInstance} during server initialization.
 */
export const FIREBASE_APP_TOKEN: InjectionToken = 'FIREBASE_APP_TOKEN';

// MARK: Firebase Admin Provider
/**
 * Creates a NestJS {@link FactoryProvider} that binds a Firebase Admin app getter to {@link FIREBASE_APP_TOKEN}.
 *
 * @param useFactory - Factory function returning the Firebase Admin app instance.
 * @returns A NestJS factory provider for the Firebase Admin app.
 *
 * @example
 * ```typescript
 * const provider = firebaseServerAppTokenProvider(() => admin.app());
 * ```
 */
export function firebaseServerAppTokenProvider(useFactory: () => admin.app.App): FactoryProvider<admin.app.App> {
  return {
    provide: FIREBASE_APP_TOKEN,
    useFactory
  };
}
