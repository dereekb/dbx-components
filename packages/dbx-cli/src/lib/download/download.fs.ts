import { type Maybe } from '@dereekb/util';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, rename, rm, statfs, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { CliError } from '../util/output';

/**
 * The mode of a directory a CLI creates to hold downloaded data: owner-only.
 */
export const CLI_PRIVATE_DIR_MODE = 0o700;

/**
 * The mode of a file a CLI writes with downloaded data: owner read/write only.
 */
export const CLI_PRIVATE_FILE_MODE = 0o600;

/**
 * Creates a directory and any missing parents, each with {@link CLI_PRIVATE_DIR_MODE}. Directories that
 * already exist keep their mode.
 *
 * @param dir - The directory.
 */
export async function ensureCliPrivateDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: CLI_PRIVATE_DIR_MODE });
}

/**
 * Joins a `/`-separated relative path (e.g. one recorded in a download manifest) onto a directory, refusing
 * any path that would land outside it.
 *
 * @param dir - The directory the path must stay inside.
 * @param relativePath - The `/`-separated path, e.g. `reports/2026/q1.pdf`.
 * @returns The absolute path.
 * @throws {CliError} `INVALID_ARGUMENT` when the path is absolute, empty, holds a NUL, or leaves `dir`.
 */
export function resolveCliDirChildPath(dir: string, relativePath: string): string {
  const base = resolve(dir);
  const isRefused = !relativePath || relativePath.includes('\0') || relativePath.startsWith('/') || relativePath.startsWith('\\') || isAbsolute(relativePath);
  const result = isRefused ? undefined : resolve(base, ...relativePath.split('/'));

  if (result == null || result === base || !result.startsWith(base + sep)) {
    throw new CliError({ message: 'A recorded file path points outside the download directory, so it was refused.', code: 'INVALID_ARGUMENT', suggestion: 'Check the manifest in the download directory; it may have been edited.' });
  }

  return result;
}

/**
 * Input to {@link writeCliFileAtomic}.
 */
export interface WriteCliFileAtomicInput {
  /**
   * The file to write. Its directory must exist.
   */
  readonly path: string;
  readonly data: string | Uint8Array;
  /**
   * Defaults to {@link CLI_PRIVATE_FILE_MODE}.
   */
  readonly mode?: Maybe<number>;
}

/**
 * Writes a file atomically: the data goes to a temporary file in the same directory, which is then renamed
 * over the target, so a reader (or a crash) never sees a half-written file. The temporary file is removed
 * on any failure.
 *
 * @param input - The path, data and mode.
 * @returns The number of bytes written.
 */
export async function writeCliFileAtomic(input: WriteCliFileAtomicInput): Promise<number> {
  const { path, data } = input;
  const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString('hex')}.tmp`);

  try {
    await writeFile(temp, data, { mode: input.mode ?? CLI_PRIVATE_FILE_MODE });
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }

  return typeof data === 'string' ? Buffer.byteLength(data) : data.length;
}

/**
 * Returns the first characters of a value's SHA-256 in hex: a stable, opaque name part that does not reveal
 * the value (an id, a mailbox address, a selection).
 *
 * @param value - The value to hash.
 * @param length - How many hex characters to keep. Defaults to 8.
 * @returns The hash prefix.
 */
export function cliSha256HexPrefix(value: string, length?: Maybe<number>): string {
  return createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, length ?? 8);
}

/**
 * Returns the bytes free to an unprivileged user on the file system that holds a path. The path does not have
 * to exist yet: its nearest existing ancestor is measured.
 *
 * @param path - The path, e.g. a download directory about to be created.
 * @returns The available bytes, or undefined when the file system cannot be measured.
 */
export async function cliAvailableBytes(path: string): Promise<Maybe<number>> {
  let current = resolve(path);
  let result: Maybe<number>;

  while (result == null) {
    try {
      const stats = await statfs(current);
      result = Number(stats.bavail) * Number(stats.bsize);
    } catch (error) {
      const parent = dirname(current);

      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || parent === current) {
        break;
      }

      current = parent;
    }
  }

  return result;
}

/**
 * Whether a directory is missing, or holds nothing but the allowed names (e.g. a download's own manifest and
 * staging folder). A CLI uses this to refuse mirroring into an unrelated, non-empty directory.
 *
 * @param dir - The directory.
 * @param allowedNames - Entry names that do not count.
 * @returns True when the directory is missing or empty apart from the allowed names; false when it holds other entries or is not a directory.
 */
export async function isCliDirEmptyOrMissing(dir: string, allowedNames?: Maybe<readonly string[]>): Promise<boolean> {
  let result: boolean;

  try {
    const entries = await readdir(dir);
    const allowed = new Set(allowedNames ?? []);
    result = entries.every((entry) => allowed.has(entry));
  } catch (error) {
    result = (error as NodeJS.ErrnoException).code === 'ENOENT';
  }

  return result;
}
