import * as admin from 'firebase-admin';
import { FactoryProvider, InjectionToken, Module, ModuleMetadata, Provider } from '@nestjs/common';
import { FirebaseServerEnvironmentConfig } from './env.config';

// MARK: Tokens
/**
 * Token to access a configured FirebaseServerEnvironmentConfig for the app.
 */
export const FIREBASE_SERVER_ENV_TOKEN: InjectionToken = 'FIREBASE_SERVER_ENV_TOKEN';

export function firebaseServerEnvTokenProvider<T extends FirebaseServerEnvironmentConfig = FirebaseServerEnvironmentConfig>(env: T): Provider {
  return {
    provide: FIREBASE_SERVER_ENV_TOKEN,
    useValue: env
  };
}
