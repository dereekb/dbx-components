import { Maybe } from '../value/maybe';

export function joinHostAndPort(config: Maybe<{ host: string; port: number | string }>): Maybe<string> {
  if (config) {
    return `${config.host}:${config.port}`;
  } else {
    return config;
  }
}
