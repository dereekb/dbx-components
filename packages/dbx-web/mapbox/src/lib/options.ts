import { DbxMapboxConfig } from './mapbox.service';

/**
 * DbxMapbox environment options
 */
export interface DbxMapboxOptions extends DbxMapboxConfig {
  readonly token: string;
}
