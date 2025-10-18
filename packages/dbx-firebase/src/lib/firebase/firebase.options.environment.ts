import { type ProvideDbxFirebaseLoginConfig } from '../auth/login/firebase.login.providers';
import { type DbxFirebaseAppOptions } from './firebase.options';

/**
 * Convenience type used in .environment.ts files for building configuration.
 */
export type DbxFirebaseEnvironmentOptions = DbxFirebaseAppOptions & Pick<ProvideDbxFirebaseLoginConfig, 'enabledLoginMethods'>;

// MARK: Compat
/**
 * @deprecated use DbxFirebaseEnvironmentOptions instead.
 */
export type DbxFirebaseOptions = DbxFirebaseEnvironmentOptions;
