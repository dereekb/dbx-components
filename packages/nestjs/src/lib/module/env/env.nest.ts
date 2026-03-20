import { type InjectionToken, type Provider } from '@nestjs/common';
import { type ServerEnvironmentConfig } from './env.config';

// MARK: Tokens
/**
 * Token to access a configured ServerEnvironmentServiceConfig for the app.
 */
export const SERVER_ENV_TOKEN: InjectionToken = 'SERVER_ENV_TOKEN';

/**
 * Creates a NestJS Provider that supplies a ServerEnvironmentConfig under the SERVER_ENV_TOKEN injection token.
 *
 * Use this to register a server environment configuration instance with the NestJS dependency injection container.
 *
 * @param env - the server environment config to provide
 * @returns a NestJS Provider that supplies the config under SERVER_ENV_TOKEN
 */
export function serverEnvTokenProvider<T extends ServerEnvironmentConfig = ServerEnvironmentConfig>(env: T): Provider {
  return {
    provide: SERVER_ENV_TOKEN,
    useValue: env
  };
}
