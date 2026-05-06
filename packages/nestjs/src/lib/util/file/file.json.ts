import { type Maybe } from '@dereekb/util';
import { chmod, mkdirSync, readFile, writeFile } from 'node:fs';
import { rm } from 'node:fs/promises';

/**
 * Reads JSON from disk, resolving `undefined` if the file is missing or malformed.
 */
export function readJsonFile<T>(filePath: string): Promise<Maybe<T>> {
  return new Promise<Maybe<T>>((resolve) => {
    readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(data) as T);
      } catch {
        resolve(undefined);
      }
    });
  });
}

export interface WriteJsonFileInput {
  readonly filePath: string;
  readonly dirPath: string;
  readonly data: unknown;
  readonly mode?: number;
}

/**
 * Writes a value to disk as JSON. Creates the parent directory if it does not exist.
 *
 * The `mode` option is enforced via an explicit `chmod` after the write — `writeFile`'s `mode`
 * parameter is ignored when the file already exists, which would otherwise leave a
 * pre-existing file at its original (potentially world-readable) permissions.
 */
export function writeJsonFile(input: WriteJsonFileInput): Promise<void> {
  mkdirSync(input.dirPath, { recursive: true });

  return new Promise<void>((resolve, reject) => {
    writeFile(input.filePath, JSON.stringify(input.data, null, 2), { mode: input.mode }, (err) => {
      if (err) {
        reject(err);
        return;
      }

      if (input.mode == null) {
        resolve();
        return;
      }

      chmod(input.filePath, input.mode, (chmodErr) => {
        if (chmodErr) reject(chmodErr);
        else resolve();
      });
    });
  });
}

/**
 * Removes the file at the given path.
 *
 * Resolves silently when the file does not exist (`force: true`); other errors
 * (permission denied, busy file handles) are forwarded to the caller — silently
 * swallowing them masks real failures and makes operations appear to have succeeded.
 */
export function removeFile(filePath: string): Promise<void> {
  return rm(filePath, { force: true });
}
