import { type Maybe } from '@dereekb/util';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Input for {@link createCliJsonStore}.
 */
export interface CreateCliJsonStoreInput {
  readonly filePath: string;
  /**
   * File mode for the written file. Defaults to `0o600`, since CLI state often names private boards or accounts.
   */
  readonly mode?: Maybe<number>;
}

/**
 * A JSON file holding one value of type `T`, written atomically.
 */
export interface CliJsonStore<T> {
  readonly filePath: string;
  /**
   * Reads the value, or `undefined` when the file does not exist. A malformed file throws.
   */
  read(): Promise<Maybe<T>>;
  /**
   * Writes the value to a temp file next to the target and renames it into place, so a crash mid-write never leaves
   * a truncated file behind.
   */
  write(value: T): Promise<void>;
  /**
   * Reads, applies `fn`, and writes the result.
   */
  update(fn: (current: Maybe<T>) => T): Promise<T>;
  /**
   * Deletes the file. A missing file is not an error.
   */
  clear(): Promise<void>;
}

/**
 * Creates an atomic JSON state store, e.g. for a CLI command that saves a board snapshot between runs.
 *
 * @param input - The file path and mode.
 * @returns The store.
 */
export function createCliJsonStore<T>(input: CreateCliJsonStoreInput): CliJsonStore<T> {
  const { filePath } = input;
  const mode = input.mode ?? 0o600;

  async function read(): Promise<Maybe<T>> {
    let text: Maybe<string>;

    try {
      text = await readFile(filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return text == null ? undefined : (JSON.parse(text) as T);
  }

  async function write(value: T): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

    try {
      await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode });
      await rename(tempPath, filePath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  return {
    filePath,
    read,
    write,
    update: async (fn) => {
      const next = fn(await read());
      await write(next);
      return next;
    },
    clear: () => rm(filePath, { force: true })
  };
}
