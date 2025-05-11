import { type Maybe } from '../value/maybe.type';

export interface JoinHostAndPortConfig {
  readonly host: string;
  readonly port: number | string;
}

/**
 * Joins the host and port into a string.
 *
 * @param config
 * @returns
 */
export function joinHostAndPort(config: Maybe<JoinHostAndPortConfig>): Maybe<string> {
  if (config) {
    return `${config.host}:${config.port}`;
  } else {
    return config;
  }
}
