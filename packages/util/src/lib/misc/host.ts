import { type Maybe } from '../value/maybe.type';

export function joinHostAndPort(config: Maybe<{ host: string; port: number | string }>): Maybe<string> {
  if (config) {
    return `${config.host}:${config.port}`;
  } else {
    return config;
  }
}
