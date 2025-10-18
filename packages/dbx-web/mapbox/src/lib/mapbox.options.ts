import { type DbxMapboxConfig } from './mapbox.service';

/**
 * Convenience type used in .environment.ts files for building configuration.
 */
export interface DbxMapboxEnvironmentOptions extends DbxMapboxConfig {
  readonly token: string;
}

// MARK: Compat
/**
 * @deprecated use DbxMapboxEnvironmentOptions instead.
 */
export type DbxMapboxOptions = DbxMapboxEnvironmentOptions;
