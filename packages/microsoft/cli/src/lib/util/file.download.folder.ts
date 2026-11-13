import {
  type CliConcurrencyOptionConfig,
  type CliDownloadCounts,
  type CliDownloadRemovedEntry,
  CliError,
  addCliDownloadCounts,
  cliAvailableBytes,
  cliDownloadManifestStore,
  cliSha256HexPrefix,
  downloadCliFile,
  emptyCliDownloadCounts,
  ensureCliPrivateDir,
  isCliDirEmptyOrMissing,
  resolveCliDirChildPath,
  runCliBulkDownload,
  runCliTaskWithRetry
} from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, type MicrosoftGraphDriveFolderWalkEntry, type MicrosoftGraphDriveItem, microsoftGraphDownloadDriveItemRequest, microsoftGraphDriveFolderWalk } from '@dereekb/microsoft';
import { type ISO8601DateString, type Maybe, type Milliseconds, fileNameWithSuffix, sanitizeFileName } from '@dereekb/util';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rename, rm, rmdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type MsGraphCliReauthTokenSource, msGraphCliDownloadFailureClassify, msGraphCliReauthOnce } from './download.failure';
import { msGraphCliStreamOpener } from './file.download';

/**
 * The manifest's file name inside the download directory.
 */
export const MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_FILE = '.msgraph-cli-download.json';

/**
 * The folder inside the download directory that holds files while they download. It is emptied at the start of
 * each run and removed at its end; being on the same file system, the final rename into place is atomic.
 */
export const MSGRAPH_CLI_FOLDER_DOWNLOAD_STAGING_DIR = '.msgraph-cli-download.parts';

/**
 * The version of the folder download manifest this CLI writes.
 */
export const MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_VERSION = 1;

/**
 * The manifest's `kind`, so another tool's JSON file is never mistaken for it.
 */
export const MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_KIND = 'msgraph-cli/files-download-folder';

/**
 * `files download-folder --concurrency`: 4 files at once by default, at most 8.
 */
export const MSGRAPH_CLI_FOLDER_DOWNLOAD_CONCURRENCY: CliConcurrencyOptionConfig = { default: 4, max: 8 };

/**
 * Free space kept on top of the bytes to download before a run starts: 256 MiB.
 */
export const MSGRAPH_CLI_FOLDER_DOWNLOAD_SPACE_MARGIN = 256 * 1024 * 1024;

/**
 * How often a progress line is written at most: every 2 seconds.
 */
export const MSGRAPH_CLI_FOLDER_DOWNLOAD_PROGRESS_INTERVAL: Milliseconds = 2000;

/**
 * How far a local file's modification time may be from the remote one for the file to be adopted without a download.
 */
export const MSGRAPH_CLI_FOLDER_DOWNLOAD_ADOPT_MTIME_TOLERANCE: Milliseconds = 2000;

/**
 * A downloaded file, by item id.
 */
export interface MsGraphCliFolderDownloadEntry {
  /**
   * The `/`-separated local path, relative to the download directory.
   */
  readonly path: string;
  readonly size: number;
  readonly cTag?: Maybe<string>;
  readonly eTag?: Maybe<string>;
  readonly quickXorHash?: Maybe<string>;
  readonly modified?: Maybe<ISO8601DateString>;
  readonly at: ISO8601DateString;
}

/**
 * A file that failed, by item id. The next run retries it.
 */
export interface MsGraphCliFolderDownloadFailedEntry {
  readonly path: string;
  readonly code: string;
  /**
   * How many runs failed to download it.
   */
  readonly attempts: number;
  readonly at: ISO8601DateString;
}

/**
 * The download directory's manifest: what was downloaded, so a re-run skips it, renames what moved, and records what
 * was removed remotely. It holds item ids and relative paths, so it is written with mode 0600.
 */
export interface MsGraphCliFolderDownloadManifest {
  readonly version: typeof MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_VERSION;
  readonly kind: typeof MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_KIND;
  readonly driveId: string;
  readonly folderId: string;
  /**
   * Cumulative over every run.
   */
  readonly counts: CliDownloadCounts;
  readonly lastRun?: Maybe<ISO8601DateString>;
  /**
   * Whether the last run copied everything.
   */
  readonly complete: boolean;
  readonly files: Record<string, MsGraphCliFolderDownloadEntry>;
  readonly failed: Record<string, MsGraphCliFolderDownloadFailedEntry>;
  readonly removed: CliDownloadRemovedEntry[];
}

/**
 * Configuration for {@link downloadMsGraphCliFolder}.
 */
export interface MsGraphCliFolderDownloadConfig {
  readonly graphContext: MicrosoftGraphContext;
  /**
   * Reset once when Graph rejects the token mid-run, so a long copy survives an early expiry.
   */
  readonly tokenSource: MsGraphCliReauthTokenSource;
  /**
   * The drive to read, or undefined for the user's own OneDrive.
   */
  readonly driveId?: Maybe<string>;
  /**
   * The drive id recorded in the manifest. Defaults to `driveId`, else `me`.
   */
  readonly manifestDriveId?: Maybe<string>;
  /**
   * The id of the folder to copy.
   */
  readonly folderId: string;
  /**
   * The local directory the folder's contents are copied into.
   */
  readonly dir: string;
  readonly concurrency: number;
  readonly idleTimeout?: Maybe<Milliseconds>;
  /**
   * The most files one run downloads; the rest are deferred to the next run.
   */
  readonly maxFiles?: Maybe<number>;
  /**
   * The most bytes one run downloads; the rest are deferred to the next run.
   */
  readonly maxBytes?: Maybe<number>;
  /**
   * Delete the local copies of files removed remotely. Without it, removals are only recorded.
   */
  readonly prune: boolean;
  /**
   * Walk and plan only: write nothing, not even the directory.
   */
  readonly dryRun: boolean;
  /**
   * Cancels the run, e.g. on Ctrl+C.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Receives the progress lines (counts only).
   */
  readonly progress?: Maybe<(line: string) => void>;
  /**
   * Waits between retries. A spec passes a fake.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
  readonly now?: Maybe<() => Date>;
}

/**
 * What a run did. Counts only, so it never shows a file name, id or URL.
 */
export interface MsGraphCliFolderDownloadResult {
  readonly dir: string;
  readonly folders: number;
  readonly files: number;
  readonly written: number;
  readonly skipped: number;
  readonly renamed: number;
  readonly removed: number;
  readonly failed: number;
  readonly unsupported: number;
  readonly deferred: number;
  readonly bytes: number;
  /**
   * True when the walk finished, nothing failed, nothing was deferred and the run was not cancelled.
   */
  readonly complete: boolean;
  readonly failedCodes?: Readonly<Record<string, number>>;
}

/**
 * What a dry run found. Counts only.
 */
export interface MsGraphCliFolderDownloadDryRunResult {
  readonly dir: string;
  readonly dryRun: true;
  readonly folders: number;
  readonly files: number;
  readonly bytes: number;
  readonly toDownload: number;
  readonly toDownloadBytes: number;
  readonly unchanged: number;
  readonly renamed: number;
  readonly removed: number;
  readonly unsupported: number;
}

/**
 * A remote file to copy, with its local path.
 */
interface MsGraphCliFolderDownloadFile {
  readonly id: string;
  readonly path: string;
  readonly size: number;
  readonly cTag?: Maybe<string>;
  readonly eTag?: Maybe<string>;
  readonly quickXorHash?: Maybe<string>;
  readonly modified?: Maybe<ISO8601DateString>;
}

interface MsGraphCliFolderDownloadRename {
  readonly file: MsGraphCliFolderDownloadFile;
  readonly from: string;
}

/**
 * What a run will do with each remote file.
 */
interface MsGraphCliFolderDownloadPlan {
  readonly folderPaths: readonly string[];
  readonly files: readonly MsGraphCliFolderDownloadFile[];
  readonly unchanged: readonly MsGraphCliFolderDownloadFile[];
  readonly renames: readonly MsGraphCliFolderDownloadRename[];
  readonly downloads: readonly MsGraphCliFolderDownloadFile[];
  /**
   * Manifest ids not seen in the walk.
   */
  readonly removedIds: readonly string[];
  readonly unsupported: number;
  readonly bytes: number;
}

/**
 * Returns whether a drive item cannot be copied through `/content`: a package (a OneNote notebook), a shortcut into
 * another drive, a file flagged as malware, or an item that is neither a file nor a folder.
 *
 * @param item - The drive item.
 * @returns True when the item is skipped and counted as unsupported.
 */
export function isMsGraphCliFolderDownloadUnsupportedItem(item: MicrosoftGraphDriveItem): boolean {
  return item.package != null || item.remoteItem != null || item.malware != null || (item.file == null && item.folder == null);
}

/**
 * The key two local names collide under: case- and Unicode normalization-insensitive, as on APFS and NTFS.
 *
 * @param name - The local name or path.
 * @returns The comparison key.
 */
function localNameKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}

function compareByNameThenId(a: MicrosoftGraphDriveFolderWalkEntry, b: MicrosoftGraphDriveFolderWalkEntry): number {
  const aName = a.item.name ?? '';
  const bName = b.item.name ?? '';
  let result: number;

  if (aName === bName) {
    result = a.item.id < b.item.id ? -1 : 1;
  } else {
    result = aName < bName ? -1 : 1;
  }

  return result;
}

/**
 * Returns a sibling's local name: the remote name made portable, with ` (<sha8(id)>)` before the extension when an
 * earlier sibling (in name, then id order) already took that name.
 *
 * @param item - The drive item.
 * @param taken - The keys of the names already taken in the folder; the new name's key is added.
 * @returns The local name.
 */
function localSiblingName(item: MicrosoftGraphDriveItem, taken: Set<string>): string {
  let name = sanitizeFileName(item.name, { mode: 'portable' });

  if (taken.has(localNameKey(name))) {
    const suffix = ` (${cliSha256HexPrefix(item.id)})`;
    name = fileNameWithSuffix(sanitizeFileName(item.name, { mode: 'portable', maxLength: 255 - Buffer.byteLength(suffix) }), suffix);
  }

  taken.add(localNameKey(name));
  return name;
}

/**
 * Gives every walked folder and supported file its local path. Siblings are named in (name, id) order, so a collision
 * resolves the same way on every run. At the top level the manifest and staging names are reserved.
 *
 * @param folderId - The walked folder's id.
 * @param entries - The walk's entries, in walk order.
 * @returns The local paths of the folders, the files to copy, and the unsupported count.
 */
function msGraphCliFolderDownloadLocalPaths(folderId: string, entries: readonly MicrosoftGraphDriveFolderWalkEntry[]) {
  const byParent = new Map<string, MicrosoftGraphDriveFolderWalkEntry[]>();
  let unsupported = 0;

  for (const entry of entries) {
    if (isMsGraphCliFolderDownloadUnsupportedItem(entry.item)) {
      unsupported += 1;
    } else {
      const siblings = byParent.get(entry.parentId) ?? [];
      siblings.push(entry);
      byParent.set(entry.parentId, siblings);
    }
  }

  const folderLocalPaths = new Map<string, string>([[folderId, '']]);
  const folderPaths: string[] = [];
  const files: MsGraphCliFolderDownloadFile[] = [];
  const queue: string[] = [folderId];

  while (queue.length > 0) {
    const parentId = queue.shift() as string;
    const parentPath = folderLocalPaths.get(parentId) as string;
    const taken = new Set<string>(parentPath ? [] : [localNameKey(MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_FILE), localNameKey(MSGRAPH_CLI_FOLDER_DOWNLOAD_STAGING_DIR)]);
    const siblings = [...(byParent.get(parentId) ?? [])].sort(compareByNameThenId);

    for (const { item } of siblings) {
      const name = localSiblingName(item, taken);
      const path = parentPath ? `${parentPath}/${name}` : name;

      if (item.folder == null) {
        files.push({ id: item.id, path, size: item.size ?? 0, cTag: item.cTag, eTag: item.eTag, quickXorHash: item.file?.hashes?.quickXorHash, modified: item.lastModifiedDateTime });
      } else {
        folderLocalPaths.set(item.id, path);
        folderPaths.push(path);
        queue.push(item.id);
      }
    }
  }

  return { folderPaths, files, unsupported };
}

/**
 * Returns whether a manifest entry and a remote file have the same content: by cTag (content only), else
 * quickXorHash, else eTag (metadata or content), plus the size.
 *
 * @param entry - The manifest entry.
 * @param file - The remote file.
 * @returns True when the content is unchanged.
 */
export function isMsGraphCliFolderDownloadSameContent(entry: Pick<MsGraphCliFolderDownloadEntry, 'size' | 'cTag' | 'eTag' | 'quickXorHash'>, file: Pick<MsGraphCliFolderDownloadEntry, 'size' | 'cTag' | 'eTag' | 'quickXorHash'>): boolean {
  let sameTag: boolean;

  if (entry.cTag && file.cTag) {
    sameTag = entry.cTag === file.cTag;
  } else if (entry.quickXorHash && file.quickXorHash) {
    sameTag = entry.quickXorHash === file.quickXorHash;
  } else {
    sameTag = entry.eTag != null && entry.eTag === file.eTag;
  }

  return sameTag && entry.size === file.size;
}

async function localFileStats(path: string): Promise<Maybe<{ readonly size: number; readonly mtimeMs: number }>> {
  let result: Maybe<{ readonly size: number; readonly mtimeMs: number }>;

  try {
    const stats = await stat(path);
    result = stats.isFile() ? { size: stats.size, mtimeMs: stats.mtimeMs } : undefined;
  } catch {
    result = undefined;
  }

  return result;
}

/**
 * Decides each file's fate: unchanged (D3), adopted (a local file of the remote size and modification time with no
 * manifest entry, left by a crash before the manifest save), renamed (same content, new path), or downloaded.
 *
 * @param dir - The download directory.
 * @param manifest - The manifest read at the start.
 * @param walked - The local paths from the walk.
 * @param walked.folderPaths - The folders' local paths.
 * @param walked.files - The files to copy.
 * @param walked.unsupported - Items that cannot be copied.
 * @returns The plan.
 */
async function planMsGraphCliFolderDownload(dir: string, manifest: MsGraphCliFolderDownloadManifest, walked: ReturnType<typeof msGraphCliFolderDownloadLocalPaths>): Promise<MsGraphCliFolderDownloadPlan> {
  const unchanged: MsGraphCliFolderDownloadFile[] = [];
  const renames: MsGraphCliFolderDownloadRename[] = [];
  const downloads: MsGraphCliFolderDownloadFile[] = [];
  const seen = new Set<string>();
  let bytes = 0;

  for (const file of walked.files) {
    const entry = manifest.files[file.id];
    seen.add(file.id);
    bytes += file.size;

    if (entry && isMsGraphCliFolderDownloadSameContent(entry, file)) {
      const local = await localFileStats(resolveCliDirChildPath(dir, entry.path));

      if (local?.size !== file.size) {
        downloads.push(file);
      } else if (entry.path === file.path) {
        unchanged.push(file);
      } else {
        renames.push({ file, from: entry.path });
      }
    } else if (entry == null) {
      const local = await localFileStats(resolveCliDirChildPath(dir, file.path));
      const remoteMtime = file.modified ? new Date(file.modified).getTime() : Number.NaN;
      const isAdoptable = local?.size === file.size && Math.abs(local.mtimeMs - remoteMtime) <= MSGRAPH_CLI_FOLDER_DOWNLOAD_ADOPT_MTIME_TOLERANCE;
      (isAdoptable ? unchanged : downloads).push(file);
    } else {
      downloads.push(file);
    }
  }

  const removedIds = Object.keys(manifest.files).filter((id) => !seen.has(id));
  return { folderPaths: walked.folderPaths, files: walked.files, unchanged, renames, downloads, removedIds, unsupported: walked.unsupported, bytes };
}

/**
 * Formats a byte count for a progress line, e.g. `9.8 GB`.
 *
 * @param bytes - The byte count.
 * @returns The formatted size.
 */
export function formatMsGraphCliBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }

  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Returns the store of a folder download's manifest. Reading refuses a manifest of another drive or folder.
 *
 * @param config - The directory, drive and folder.
 * @param config.dir - The download directory.
 * @param config.driveId - The drive id recorded in the manifest.
 * @param config.folderId - The folder id.
 * @returns The store.
 */
export function msGraphCliFolderDownloadManifestStore(config: { readonly dir: string; readonly driveId: string; readonly folderId: string }) {
  const empty = (): MsGraphCliFolderDownloadManifest => ({ version: MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_VERSION, kind: MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_KIND, driveId: config.driveId, folderId: config.folderId, counts: emptyCliDownloadCounts(), complete: false, files: {}, failed: {}, removed: [] });

  return cliDownloadManifestStore<MsGraphCliFolderDownloadManifest>({
    dir: config.dir,
    fileName: MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_FILE,
    empty,
    accept: (parsed: unknown) => {
      const existing = (typeof parsed === 'object' && parsed != null ? parsed : {}) as MsGraphCliFolderDownloadManifest;

      if (existing.version !== MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_VERSION || existing.kind !== MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_KIND) {
        throw new CliError({ message: `${config.dir} holds a download manifest this version of msgraph-cli cannot read.`, code: 'INVALID_ARGUMENT', suggestion: 'Download into a new directory, or update msgraph-cli.' });
      } else if (existing.driveId !== config.driveId || existing.folderId !== config.folderId) {
        throw new CliError({ message: `${config.dir} holds a copy of another drive or folder.`, code: 'INVALID_ARGUMENT', suggestion: 'Download into a new directory, or re-run with the drive and folder that directory was created with.' });
      }

      return { ...empty(), ...existing, files: existing.files ?? {}, failed: existing.failed ?? {}, removed: existing.removed ?? [] };
    }
  });
}

/**
 * Copies a OneDrive or SharePoint folder to a local directory, recursively, and keeps it in step on later runs (a
 * one-way mirror).
 *
 * - The folder is walked fully first (each page read retried, and re-authenticated once on a 401).
 * - Unchanged files (same cTag, else quickXorHash, else eTag, and the same size, present locally) are skipped; a file
 *   whose content is unchanged but whose path changed is renamed locally; the rest are downloaded through `/content`,
 *   `concurrency` at a time, into a staging folder, then renamed into place with the remote modification time.
 * - Items removed remotely are recorded; with `prune`, their local files (only the ones the manifest recorded) are
 *   deleted, with any parent folder left empty.
 * - A file that fails is counted and retried by the next run. A rejected token, a full disk, a cancel or 10 failures
 *   in a row stop the run with the manifest saved.
 *
 * Progress lines carry counts and sizes only.
 *
 * @param config - The source, the directory and the run's options.
 * @returns The counts, or the plan's counts for a dry run.
 * @throws {CliError} `INVALID_ARGUMENT` for a non-empty directory that is not a copy of this folder; `INSUFFICIENT_SPACE` when the disk cannot hold the files to download.
 * @throws {CliDownloadAbortedError} When the signal fired; finished files and the manifest are kept.
 */
export async function downloadMsGraphCliFolder(config: MsGraphCliFolderDownloadConfig): Promise<MsGraphCliFolderDownloadResult | MsGraphCliFolderDownloadDryRunResult> {
  const { graphContext, driveId, folderId, dir, signal, wait } = config;
  const now = config.now ?? (() => new Date());
  const progressLine = config.progress ?? (() => undefined);
  const classify = msGraphCliDownloadFailureClassify;
  const reauth = msGraphCliReauthOnce(config.tokenSource);
  const store = msGraphCliFolderDownloadManifestStore({ dir, driveId: config.manifestDriveId ?? driveId ?? 'me', folderId });
  const hasManifest = existsSync(store.path);

  if (!hasManifest && !(await isCliDirEmptyOrMissing(dir, [MSGRAPH_CLI_FOLDER_DOWNLOAD_STAGING_DIR]))) {
    throw new CliError({ message: `${dir} is not empty and holds no msgraph-cli folder download.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass a new or empty directory; download-folder only mirrors into its own directories.' });
  }

  const manifest = await store.read();
  let lastProgressAt = now().getTime();

  function throttledProgress(line: () => string, force = false) {
    const at = now().getTime();

    if (force || at - lastProgressAt >= MSGRAPH_CLI_FOLDER_DOWNLOAD_PROGRESS_INTERVAL) {
      lastProgressAt = at;
      progressLine(line());
    }
  }

  // MARK: Walk
  const entries: MicrosoftGraphDriveFolderWalkEntry[] = [];
  const wrapRead = <T>(read: () => Promise<T>) => runCliTaskWithRetry({ task: () => reauth(read), classify, signal, wait });

  for await (const entry of microsoftGraphDriveFolderWalk(graphContext)({ driveId, id: folderId, wrapRead })) {
    entries.push(entry);
    throttledProgress(() => `download-folder: listing, ${entries.length} items so far`);
  }

  const plan = await planMsGraphCliFolderDownload(dir, manifest, msGraphCliFolderDownloadLocalPaths(folderId, entries));
  const toDownloadBytes = plan.downloads.reduce((sum, x) => sum + x.size, 0);
  progressLine(`download-folder: ${plan.files.length} files (${formatMsGraphCliBytes(plan.bytes)}) in ${plan.folderPaths.length} folders; ${plan.unchanged.length} unchanged; ${plan.renames.length} renamed; ${plan.downloads.length} to download`);

  let result: MsGraphCliFolderDownloadResult | MsGraphCliFolderDownloadDryRunResult;

  if (config.dryRun) {
    result = { dir, dryRun: true, folders: plan.folderPaths.length, files: plan.files.length, bytes: plan.bytes, toDownload: plan.downloads.length, toDownloadBytes, unchanged: plan.unchanged.length, renamed: plan.renames.length, removed: plan.removedIds.length, unsupported: plan.unsupported };
  } else {
    result = await runMsGraphCliFolderDownload({ config, store, manifest, plan, toDownloadBytes, reauth, now, progress: throttledProgress });
  }

  return result;
}

interface RunMsGraphCliFolderDownloadInput {
  readonly config: MsGraphCliFolderDownloadConfig;
  readonly store: ReturnType<typeof msGraphCliFolderDownloadManifestStore>;
  readonly manifest: MsGraphCliFolderDownloadManifest;
  readonly plan: MsGraphCliFolderDownloadPlan;
  readonly toDownloadBytes: number;
  readonly reauth: ReturnType<typeof msGraphCliReauthOnce>;
  readonly now: () => Date;
  readonly progress: (line: () => string, force?: boolean) => void;
}

function msGraphCliFolderDownloadEntry(file: MsGraphCliFolderDownloadFile, at: ISO8601DateString): MsGraphCliFolderDownloadEntry {
  return { path: file.path, size: file.size, cTag: file.cTag, eTag: file.eTag, quickXorHash: file.quickXorHash, modified: file.modified, at };
}

async function runMsGraphCliFolderDownload(input: RunMsGraphCliFolderDownloadInput): Promise<MsGraphCliFolderDownloadResult> {
  const { config, store, manifest, plan, toDownloadBytes, reauth, now, progress } = input;
  const { graphContext, driveId, dir, signal, maxBytes } = config;
  const staging = join(dir, MSGRAPH_CLI_FOLDER_DOWNLOAD_STAGING_DIR);
  const at = now().toISOString();
  const files: Record<string, MsGraphCliFolderDownloadEntry> = { ...manifest.files };
  const failed: Record<string, MsGraphCliFolderDownloadFailedEntry> = { ...manifest.failed };
  const removed: CliDownloadRemovedEntry[] = [...manifest.removed];
  const downloads = [...plan.downloads];
  let renamed = 0;
  let prunedCount = 0;
  let run: CliDownloadCounts = emptyCliDownloadCounts();
  let complete = false;
  let result: MsGraphCliFolderDownloadResult;

  function snapshot(): MsGraphCliFolderDownloadManifest {
    return { ...manifest, counts: addCliDownloadCounts(manifest.counts, run), lastRun: at, complete, files, failed, removed };
  }

  // MARK: Prepare
  const needed = Math.min(toDownloadBytes, maxBytes ?? Number.POSITIVE_INFINITY);
  const available = needed > 0 ? await cliAvailableBytes(dir) : undefined;

  if (available != null && needed + MSGRAPH_CLI_FOLDER_DOWNLOAD_SPACE_MARGIN > available) {
    throw new CliError({ message: `The disk has ${formatMsGraphCliBytes(available)} free; the download needs ${formatMsGraphCliBytes(needed)} plus a ${formatMsGraphCliBytes(MSGRAPH_CLI_FOLDER_DOWNLOAD_SPACE_MARGIN)} margin.`, code: 'INSUFFICIENT_SPACE', suggestion: 'Free space, or copy in parts with --max-bytes.' });
  }

  await ensureCliPrivateDir(dir);
  await rm(staging, { recursive: true, force: true });
  await ensureCliPrivateDir(staging);

  try {
    for (const folderPath of plan.folderPaths) {
      await ensureCliPrivateDir(resolveCliDirChildPath(dir, folderPath));
    }

    // MARK: Rename
    // in two steps, through the staging folder, so two files can swap names
    const staged: { readonly rename: MsGraphCliFolderDownloadRename; readonly temp: string }[] = [];

    for (const move of plan.renames) {
      const temp = join(staging, `${cliSha256HexPrefix(move.file.id)}-${randomBytes(4).toString('hex')}.rename`);

      try {
        await rename(resolveCliDirChildPath(dir, move.from), temp);
        staged.push({ rename: move, temp });
      } catch {
        downloads.push(move.file);
      }
    }

    for (const { rename: move, temp } of staged) {
      await rename(temp, resolveCliDirChildPath(dir, move.file.path));
      files[move.file.id] = msGraphCliFolderDownloadEntry(move.file, at);
      renamed += 1;
    }

    for (const file of plan.unchanged) {
      files[file.id] = { ...msGraphCliFolderDownloadEntry(file, at), at: files[file.id]?.at ?? at };
      delete failed[file.id];
    }

    run = addCliDownloadCounts(run, { skipped: plan.unchanged.length });
    await store.save(snapshot());

    // MARK: Download
    const byId = new Map(downloads.map((x) => [x.id, x]));
    const totalBytes = downloads.reduce((sum, x) => sum + x.size, 0);
    let done = 0;
    let doneBytes = 0;
    let failedCount = 0;
    const downloadProgress = () => `download-folder: ${done}/${downloads.length} files, ${formatMsGraphCliBytes(doneBytes)}/${formatMsGraphCliBytes(totalBytes)}, ${failedCount} failed`;

    const bulk = await runCliBulkDownload({
      tasks: downloads.map((file) => ({
        key: file.id,
        bytes: file.size,
        run: (taskSignal: AbortSignal) =>
          reauth(() =>
            downloadCliFile({
              open: msGraphCliStreamOpener(graphContext, microsoftGraphDownloadDriveItemRequest({ driveId, id: file.id })),
              out: resolveCliDirChildPath(dir, file.path),
              partialPath: join(staging, `${cliSha256HexPrefix(file.id)}-${randomBytes(4).toString('hex')}.part`),
              idleTimeout: config.idleTimeout,
              signal: taskSignal,
              mtime: file.modified ? new Date(file.modified) : undefined
            })
          ).then((x) => x.bytes)
      })),
      concurrency: config.concurrency,
      classify: msGraphCliDownloadFailureClassify,
      signal,
      wait: config.wait,
      maxTasks: config.maxFiles,
      maxBytes,
      onTaskDone: (task, bytes) => {
        const file = byId.get(task.key) as MsGraphCliFolderDownloadFile;
        files[file.id] = msGraphCliFolderDownloadEntry(file, now().toISOString());
        delete failed[file.id];
        done += 1;
        doneBytes += bytes;
        run = addCliDownloadCounts(run, { written: 1, bytes });
        store.saveSoon(snapshot());
        progress(downloadProgress);
      },
      onTaskFailed: (task, failure) => {
        const file = byId.get(task.key) as MsGraphCliFolderDownloadFile;
        failed[file.id] = { path: file.path, code: failure.code, attempts: (failed[file.id]?.attempts ?? 0) + 1, at: now().toISOString() };
        failedCount += 1;
        run = addCliDownloadCounts(run, { failed: 1 });
        progress(downloadProgress);
      }
    });

    // MARK: Prune
    const currentPathKeys = new Set(plan.files.map((x) => localNameKey(x.path)));
    const currentFolderKeys = new Set(plan.folderPaths.map(localNameKey));

    for (const id of plan.removedIds) {
      const entry = files[id];
      const index = removed.findIndex((x) => x.id === id);

      if (config.prune) {
        // a path a current file now holds is never deleted
        if (entry && !currentPathKeys.has(localNameKey(entry.path))) {
          await rm(resolveCliDirChildPath(dir, entry.path), { force: true });
          await removeEmptyParents(dir, entry.path, currentFolderKeys);
        }

        delete files[id];
        prunedCount += 1;
        const prunedEntry: CliDownloadRemovedEntry = { id, reason: 'deleted', at, pruned: true };

        if (index >= 0) {
          removed[index] = prunedEntry;
        } else {
          removed.push(prunedEntry);
        }
      } else if (index < 0) {
        removed.push({ id, reason: 'deleted', at, pruned: false });
      }

      delete failed[id];
    }

    run = addCliDownloadCounts(run, { removed: prunedCount });
    complete = bulk.failed === 0 && bulk.deferred === 0;
    await store.save(snapshot());
    progress(downloadProgress, true);

    result = {
      dir,
      folders: plan.folderPaths.length,
      files: plan.files.length,
      written: bulk.done,
      skipped: plan.unchanged.length,
      renamed,
      removed: plan.removedIds.length,
      failed: bulk.failed,
      unsupported: plan.unsupported,
      deferred: bulk.deferred,
      bytes: bulk.bytes,
      complete,
      ...(bulk.failed > 0 ? { failedCodes: bulk.failedCodes } : {})
    };
  } catch (error) {
    // the files finished so far are recorded, so the re-run resumes after them
    await store.save(snapshot()).catch(() => undefined);
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }

  return result;
}

/**
 * Removes the parent folders of a pruned file that are now empty, up to (not including) the download directory.
 * A folder that still exists remotely is kept, even when empty.
 *
 * @param dir - The download directory.
 * @param path - The pruned file's relative path.
 * @param currentFolderKeys - The keys of the remote folders' local paths.
 */
async function removeEmptyParents(dir: string, path: string, currentFolderKeys: ReadonlySet<string>): Promise<void> {
  const parts = path.split('/').slice(0, -1);
  let stop = false;

  while (parts.length > 0 && !stop) {
    const parent = parts.join('/');

    if (currentFolderKeys.has(localNameKey(parent))) {
      stop = true;
    } else {
      try {
        await rmdir(resolveCliDirChildPath(dir, parent));
        parts.pop();
      } catch {
        stop = true;
      }
    }
  }
}
