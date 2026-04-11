import { type Maybe } from '../value/maybe.type';

/**
 * Configuration for joining a host and port into a connection string.
 */
export interface JoinHostAndPortConfig {
  readonly host: string;
  readonly port: number | string;
}

/**
 * Joins the host and port into a "host:port" string.
 *
 * @param config - The host and port configuration, or null/undefined
 * @returns The joined string, or null/undefined if config is null/undefined
 */
export function joinHostAndPort(config: Maybe<JoinHostAndPortConfig>): Maybe<string> {
  return config ? `${config.host}:${config.port}` : config;
}
