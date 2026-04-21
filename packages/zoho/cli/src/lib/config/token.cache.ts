import { type ZohoAccessToken, type ZohoAccessTokenCache } from '@dereekb/zoho';
import type { Maybe } from '@dereekb/util';
import { readFile, writeFile, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createFileTokenCache(filePath: string): ZohoAccessTokenCache {
  let memoryToken: Maybe<ZohoAccessToken>;

  const cache: ZohoAccessTokenCache = {
    loadCachedToken: async (): Promise<Maybe<ZohoAccessToken>> => {
      if (memoryToken) {
        return memoryToken;
      }

      return new Promise<Maybe<ZohoAccessToken>>((resolve) => {
        readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
          if (err) {
            resolve(undefined);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed?.expiresAt) {
              parsed.expiresAt = new Date(parsed.expiresAt);
            }
            memoryToken = parsed;
            resolve(parsed);
          } catch {
            resolve(undefined);
          }
        });
      });
    },
    updateCachedToken: async (accessToken: ZohoAccessToken): Promise<void> => {
      memoryToken = accessToken;
      mkdirSync(dirname(filePath), { recursive: true });
      return new Promise<void>((resolve, reject) => {
        writeFile(filePath, JSON.stringify(accessToken), {}, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    clearCachedToken: async (): Promise<void> => {
      memoryToken = undefined;
    }
  };

  return cache;
}
