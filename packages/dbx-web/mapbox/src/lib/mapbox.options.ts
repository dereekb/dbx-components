import { type DbxMapboxConfig } from './mapbox.service';

/**
 * Convenience type used in .environment.ts files for building configuration.
 */
export interface DbxMapboxEnvironmentOptions extends DbxMapboxConfig {
  readonly token: string;
}
