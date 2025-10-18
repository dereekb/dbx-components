import { type InjectionToken, type Provider } from '@nestjs/common';
import { type ServerEnvironmentConfig } from './env.config';

// MARK: Tokens
/**
 * Token to access a configured ServerEnvironmentServiceConfig for the app.
 */
export const SERVER_ENV_TOKEN: InjectionToken = 'SERVER_ENV_TOKEN';

export function serverEnvTokenProvider<T extends ServerEnvironmentConfig = ServerEnvironmentConfig>(env: T): Provider {
  return {
    provide: SERVER_ENV_TOKEN,
    useValue: env
  };
}
