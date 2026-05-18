import { type Maybe } from '@dereekb/util';
import { chmod, mkdirSync, readFile, writeFile } from 'node:fs';
import { rm } from 'node:fs/promises';

/**
 * Reads JSON from disk, resolving `undefined` when the file is missing (ENOENT) or its
 * contents fail to parse as JSON. Other I/O errors (permission denied, busy handles) are
 * forwarded to the caller — silently swallowing them masks real failures.
 *
 * @param filePath - Absolute path to the JSON file to read.
 * @returns The parsed JSON cast to `T`, or `undefined` when the file does not exist or its contents are not valid JSON.
 */
export function readJsonFile<T>(filePath: string): Promise<Maybe<T>> {
  return new Promise<Maybe<T>>((resolve, reject) => {
    readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve(undefined);
        } else {
          reject(err);
        }
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

/**
 * Configuration bag for {@link writeJsonFile}.
 */
export interface WriteJsonFileInput {
  /**
   * Absolute path to the file to write.
   */
  readonly filePath: string;
  /**
   * Absolute path to the parent directory; created (recursively) if missing before the write.
   */
  readonly dirPath: string;
  /**
   * Value to serialize as JSON.
   */
  readonly data: unknown;
  /**
   * Optional numeric file mode (e.g. `0o600`) enforced via an explicit `chmod` after the write.
   */
  readonly mode?: number;
}

/**
 * Writes a value to disk as JSON. Creates the parent directory if it does not exist.
 *
 * The `mode` option is enforced via an explicit `chmod` after the write — `writeFile`'s `mode`
 * parameter is ignored when the file already exists, which would otherwise leave a
 * pre-existing file at its original (potentially world-readable) permissions.
 *
 * @param input - Configuration describing the destination, payload, and optional file mode.
 * @param input.filePath - Absolute path to the file to write.
 * @param input.dirPath - Absolute path to the parent directory; created (recursively) when missing.
 * @param input.data - Value to serialize as JSON (pretty-printed with two-space indentation).
 * @param input.mode - Optional numeric file mode (e.g. `0o600`) applied via `chmod` after the write.
 * @returns Resolves once the JSON has been written and the optional `chmod` has completed.
 */
export function writeJsonFile(input: WriteJsonFileInput): Promise<void> {
  mkdirSync(input.dirPath, { recursive: true });

  return new Promise<void>((resolve, reject) => {
    writeFile(input.filePath, JSON.stringify(input.data, null, 2), { mode: input.mode }, (err) => {
      if (err) {
        reject(err);
      } else if (input.mode == null) {
        resolve();
      } else {
        chmod(input.filePath, input.mode, (chmodErr) => {
          if (chmodErr) reject(chmodErr);
          else resolve();
        });
      }
    });
  });
}

/**
 * Removes the file at the given path.
 *
 * Resolves silently when the file does not exist (`force: true`); other errors
 * (permission denied, busy file handles) are forwarded to the caller — silently
 * swallowing them masks real failures and makes operations appear to have succeeded.
 *
 * @param filePath - Absolute path to the file to remove.
 * @returns Resolves once the file is removed (or was already absent).
 */
export function removeFile(filePath: string): Promise<void> {
  return rm(filePath, { force: true });
}
