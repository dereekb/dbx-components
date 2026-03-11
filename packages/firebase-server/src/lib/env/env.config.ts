import { type InjectionToken, type Provider } from '@nestjs/common';
import { SERVER_ENV_TOKEN, type ServerEnvironmentConfig } from '@dereekb/nestjs';

/**
 * Extension of ServerEnvironmentConfig for Firebase server applications.
 *
 * Requires appUrl to be provided.
 */
export interface FirebaseServerEnvironmentConfig extends ServerEnvironmentConfig {
  readonly appUrl: string;
}

// MARK: Tokens
/**
 * Token to access a configured FirebaseServerEnvironmentServiceConfig for the app.
 */
export const FIREBASE_SERVER_ENV_TOKEN: InjectionToken = 'FIREBASE_SERVER_ENV_TOKEN';

export function firebaseServerEnvTokenProvider<T extends FirebaseServerEnvironmentConfig = FirebaseServerEnvironmentConfig>(env: T): Provider {
  return {
    provide: FIREBASE_SERVER_ENV_TOKEN,
    useValue: env
  };
}

export function firebaseServerEnvTokenProviders<T extends FirebaseServerEnvironmentConfig = FirebaseServerEnvironmentConfig>(env: T): Provider[] {
  return [
    firebaseServerEnvTokenProvider<T>(env),
    {
      provide: SERVER_ENV_TOKEN,
      useExisting: FIREBASE_SERVER_ENV_TOKEN
    }
  ];
}
