import { type Maybe } from '@dereekb/util';
import { readJsonFile, writeJsonFile, removeFile } from './cli.config';
import { dirname } from 'node:path';

/**
 * A cached token entry for a single env.
 */
export interface CliTokenEntry {
  readonly accessToken: string;
  readonly refreshToken?: string;
  /**
   * Unix epoch milliseconds at which the access token expires.
   */
  readonly expiresAt: number;
  readonly tokenType?: string;
  readonly scope?: string;
  readonly idToken?: string;
}

/**
 * Token cache shape on disk — keyed by env name.
 */
export type CliTokenCache = Record<string, CliTokenEntry>;

export interface CliTokenCacheStore {
  readonly load: () => Promise<CliTokenCache>;
  readonly get: (env: string) => Promise<Maybe<CliTokenEntry>>;
  readonly set: (env: string, entry: CliTokenEntry) => Promise<void>;
  readonly remove: (env: string) => Promise<void>;
  readonly clear: () => Promise<void>;
}

export interface CreateCliTokenCacheStoreInput {
  readonly tokenCachePath: string;
}

/**
 * Creates a per-env token cache store backed by a single JSON file.
 *
 * Entries are written with mode 0600. Reads are memoized per-process to avoid hitting disk
 * on every access.
 */
export function createCliTokenCacheStore(input: CreateCliTokenCacheStoreInput): CliTokenCacheStore {
  let memory: Maybe<CliTokenCache>;

  async function load(): Promise<CliTokenCache> {
    if (memory) {
      return memory;
    }

    const loaded = (await readJsonFile<CliTokenCache>(input.tokenCachePath)) ?? {};
    memory = loaded;
    return loaded;
  }

  async function persist(): Promise<void> {
    await writeJsonFile({
      filePath: input.tokenCachePath,
      dirPath: dirname(input.tokenCachePath),
      data: memory ?? {},
      mode: 0o600
    });
  }

  return {
    load,
    get: async (env) => (await load())[env],
    set: async (env, entry) => {
      memory = { ...(await load()), [env]: entry };
      await persist();
    },
    remove: async (env) => {
      const current = await load();
      const next: CliTokenCache = { ...current };
      delete next[env];
      memory = next;
      await persist();
    },
    clear: async () => {
      memory = {};
      await removeFile(input.tokenCachePath);
    }
  };
}

/**
 * Returns true when the token entry's access token is at or near expiry.
 *
 * Defaults to a 60-second buffer to allow for clock skew and request latency.
 */
export function isTokenExpired(entry: Maybe<CliTokenEntry>, nowMs: number = Date.now(), bufferMs: number = 60_000): boolean {
  if (!entry) {
    return true;
  }

  return entry.expiresAt - bufferMs <= nowMs;
}
