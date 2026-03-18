import { type InjectionToken, type Provider } from '@nestjs/common';
import { SERVER_ENV_TOKEN, type ServerEnvironmentConfig } from '@dereekb/nestjs';
import { type WebsiteUrlWithPrefix } from '@dereekb/util';

/**
 * Extension of ServerEnvironmentConfig for Firebase server applications.
 *
 * Requires appUrl to be provided.
 */
export interface FirebaseServerEnvironmentConfig extends ServerEnvironmentConfig {
  readonly appUrl: WebsiteUrlWithPrefix;
}

// MARK: Tokens
/**
 * Token to access a configured FirebaseServerEnvironmentServiceConfig for the app.
 */
export const FIREBASE_SERVER_ENV_TOKEN: InjectionToken = 'FIREBASE_SERVER_ENV_TOKEN';

/**
 * Creates a NestJS provider that binds the given config to the {@link FIREBASE_SERVER_ENV_TOKEN} injection token.
 *
 * @param env - The Firebase server environment configuration.
 *
 * @example
 * ```typescript
 * const provider = firebaseServerEnvTokenProvider({ appUrl: 'https://myapp.com', ... });
 * ```
 */
export function firebaseServerEnvTokenProvider<T extends FirebaseServerEnvironmentConfig = FirebaseServerEnvironmentConfig>(env: T): Provider {
  return {
    provide: FIREBASE_SERVER_ENV_TOKEN,
    useValue: env
  };
}

/**
 * Creates NestJS providers that bind the given config to both {@link FIREBASE_SERVER_ENV_TOKEN}
 * and the base {@link SERVER_ENV_TOKEN} from `@dereekb/nestjs`.
 *
 * Use this when the NestJS app needs the config accessible via either token.
 *
 * @param env - The Firebase server environment configuration.
 *
 * @example
 * ```typescript
 * @Module({
 *   providers: [...firebaseServerEnvTokenProviders(myEnvConfig)]
 * })
 * export class AppModule {}
 * ```
 */
export function firebaseServerEnvTokenProviders<T extends FirebaseServerEnvironmentConfig = FirebaseServerEnvironmentConfig>(env: T): Provider[] {
  return [
    firebaseServerEnvTokenProvider<T>(env),
    {
      provide: SERVER_ENV_TOKEN,
      useExisting: FIREBASE_SERVER_ENV_TOKEN
    }
  ];
}
