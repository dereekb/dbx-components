import { serverEnvTokenProvider, SERVER_ENV_TOKEN } from '@dereekb/nestjs';
import { InjectionToken } from '@nestjs/common';

// MARK: Compat
/**
 * @Deprecated use SERVER_ENV_TOKEN instead.
 */
export const FIREBASE_SERVER_ENV_TOKEN: InjectionToken = SERVER_ENV_TOKEN;

/**
 * @deprecated use serverEnvTokenProvider() instead.
 */
export const firebaseServerEnvTokenProvider = serverEnvTokenProvider;
