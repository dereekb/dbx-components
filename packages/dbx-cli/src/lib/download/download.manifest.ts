import { type ISO8601DateString, type Maybe, type Milliseconds } from '@dereekb/util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CliError } from '../util/output';
import { CLI_PRIVATE_FILE_MODE, writeCliFileAtomic } from './download.fs';

/**
 * How long {@link CliDownloadManifestStore.saveSoon} waits to coalesce writes: 2 seconds.
 */
export const DEFAULT_CLI_DOWNLOAD_MANIFEST_SAVE_DEBOUNCE: Milliseconds = 2000;

/**
 * What a bulk-download run did. Nothing in it names an item.
 */
export interface CliDownloadCounts {
  readonly written: number;
  readonly skipped: number;
  readonly removed: number;
  readonly failed: number;
  readonly bytes: number;
}

/**
 * Returns counts of zero.
 *
 * @returns The empty counts.
 */
export function emptyCliDownloadCounts(): CliDownloadCounts {
  return { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 };
}

/**
 * Adds counts together.
 *
 * @param a - The running counts.
 * @param b - The counts to add; missing fields add nothing.
 * @returns The sum.
 */
export function addCliDownloadCounts(a: CliDownloadCounts, b: Partial<CliDownloadCounts>): CliDownloadCounts {
  return {
    written: a.written + (b.written ?? 0),
    skipped: a.skipped + (b.skipped ?? 0),
    removed: a.removed + (b.removed ?? 0),
    failed: a.failed + (b.failed ?? 0),
    bytes: a.bytes + (b.bytes ?? 0)
  };
}

/**
 * A manifest record of an item that disappeared from the source.
 */
export interface CliDownloadRemovedEntry {
  readonly id: string;
  readonly reason?: Maybe<string>;
  readonly at: ISO8601DateString;
  /**
   * Whether the local copy was deleted.
   */
  readonly pruned: boolean;
}

/**
 * Configuration for {@link cliDownloadManifestStore}.
 */
export interface CliDownloadManifestStoreConfig<T> {
  /**
   * The download directory. It must exist before the first save.
   */
  readonly dir: string;
  /**
   * The manifest's file name inside `dir`, e.g. `.my-cli-download.json`.
   */
  readonly fileName: string;
  /**
   * Returns the manifest of a new download.
   */
  readonly empty: () => T;
  /**
   * Validates (and migrates) a parsed manifest file; throws a CliError to refuse it, e.g. when the directory
   * holds a download of something else.
   */
  readonly accept: (existing: unknown) => T;
  /**
   * How long `saveSoon` waits to coalesce writes. Defaults to {@link DEFAULT_CLI_DOWNLOAD_MANIFEST_SAVE_DEBOUNCE}.
   */
  readonly saveDebounce?: Maybe<Milliseconds>;
}

/**
 * Reads and writes a download's manifest file.
 */
export interface CliDownloadManifestStore<T> {
  /**
   * The manifest file's path.
   */
  readonly path: string;
  /**
   * Reads the manifest. A missing file reads as `empty()`.
   *
   * @throws {CliError} `INVALID_ARGUMENT` when the file is not valid JSON, or whatever `accept` throws.
   */
  read(): Promise<T>;
  /**
   * Writes the manifest now, atomically (mode 0600, `JSON.stringify(manifest, null, 2)` plus a newline), and
   * drops any pending `saveSoon` write.
   */
  save(manifest: T): Promise<void>;
  /**
   * Writes the manifest after the debounce; a later call within it replaces the pending one. A failed write
   * is rethrown by the next `flush`.
   */
  saveSoon(manifest: T): void;
  /**
   * Writes the pending `saveSoon` manifest, if any, and waits for every write in progress.
   */
  flush(): Promise<void>;
}

/**
 * Creates a store for a bulk download's manifest: the file that records what was written, so a re-run skips
 * it and an interrupted run resumes. Writes are atomic and serialized, so the file is never half-written and
 * never older than a write that already returned.
 *
 * @param config - The directory, file name, and how to create and accept a manifest.
 * @returns The store.
 */
export function cliDownloadManifestStore<T>(config: CliDownloadManifestStoreConfig<T>): CliDownloadManifestStore<T> {
  const path = join(config.dir, config.fileName);
  const saveDebounce = config.saveDebounce ?? DEFAULT_CLI_DOWNLOAD_MANIFEST_SAVE_DEBOUNCE;
  let writing: Promise<void> = Promise.resolve();
  let pending: Maybe<{ readonly manifest: T }>;
  let timer: Maybe<ReturnType<typeof setTimeout>>;
  let deferredError: Maybe<{ readonly error: unknown }>;

  function cancelPending() {
    clearTimeout(timer ?? undefined);
    timer = undefined;
    pending = undefined;
  }

  async function read(): Promise<T> {
    let content: Maybe<string>;

    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    let result: T;

    if (content == null) {
      result = config.empty();
    } else {
      let parsed: unknown;

      try {
        parsed = JSON.parse(content);
      } catch {
        throw new CliError({ message: `${path} is not a readable download manifest.`, code: 'INVALID_ARGUMENT', suggestion: 'Download into a new directory, or restore the manifest file.' });
      }

      result = config.accept(parsed);
    }

    return result;
  }

  function save(manifest: T): Promise<void> {
    cancelPending();
    const data = `${JSON.stringify(manifest, null, 2)}\n`;
    // serialized: a write never overtakes an earlier one, and a failed write does not block the next
    const write = writing.catch(() => undefined).then(() => writeCliFileAtomic({ path, data, mode: CLI_PRIVATE_FILE_MODE }).then(() => undefined));
    writing = write;
    return write;
  }

  function saveSoon(manifest: T): void {
    pending = { manifest };

    if (timer == null) {
      timer = setTimeout(() => {
        const next = pending;
        timer = undefined;
        pending = undefined;

        if (next) {
          save(next.manifest).catch((error: unknown) => {
            deferredError = { error };
          });
        }
      }, saveDebounce);
    }
  }

  async function flush(): Promise<void> {
    if (pending) {
      await save(pending.manifest);
    }

    await writing.catch(() => undefined);

    if (deferredError) {
      const { error } = deferredError;
      deferredError = undefined;
      throw error;
    }
  }

  return { path, read, save, saveSoon, flush };
}
