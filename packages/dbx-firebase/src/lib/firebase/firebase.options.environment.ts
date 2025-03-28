import { ProvideDbxFirebaseLoginConfig } from '../auth/login/firebase.login.providers';
import { DbxFirebaseAppOptions } from './firebase.options';

/**
 * Convenience type used in .environment.ts files for building configuration.
 */
export type DbxFirebaseEnvironmentOptions = DbxFirebaseAppOptions & Pick<ProvideDbxFirebaseLoginConfig, 'enabledLoginMethods'>;

// MARK: Compat
/**
 * @deprecated use DbxFirebaseEnvironmentOptions instead.
 */
export type DbxFirebaseOptions = DbxFirebaseEnvironmentOptions;
