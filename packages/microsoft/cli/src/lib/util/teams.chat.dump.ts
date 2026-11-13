import {
  type CliBulkDownloadTask,
  type CliConcurrencyOptionConfig,
  type CliDownloadCounts,
  type CliDownloadManifestStore,
  type CliDownloadRemovedEntry,
  CLI_DOWNLOAD_PARTIAL_SUFFIX,
  CliDownloadAbortedError,
  CliDownloadTaskFailedError,
  CliError,
  addCliDownloadCounts,
  cliDownloadManifestStore,
  cliSha256HexPrefix,
  emptyCliDownloadCounts,
  ensureCliPrivateDir,
  isCliDirEmptyOrMissing,
  resolveCliDirChildPath,
  runCliBulkDownload,
  runCliTaskWithRetry,
  writeCliFileAtomic
} from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphChat,
  type MicrosoftGraphChatMessage,
  type MicrosoftGraphChatMessageAttachment,
  type MicrosoftGraphChatMessagePage,
  type MicrosoftGraphPage,
  type MicrosoftGraphChatType,
  type MicrosoftGraphContext,
  type MicrosoftGraphDriveItem,
  MICROSOFT_GRAPH_SHARED_FILE_SELECT,
  microsoftGraphChatMatches,
  microsoftGraphChatMessageHostedContentRefs,
  microsoftGraphChatMessageHostedContentRequest,
  microsoftGraphChatMessagesRequest,
  microsoftGraphChatRequest,
  microsoftGraphChatsRequest,
  microsoftGraphDownloadDriveItemRequest,
  microsoftGraphPageSkipToken,
  microsoftGraphRequest,
  microsoftGraphSharedDriveItemRequest
} from '@dereekb/microsoft';
import { type ISO8601DateString, type Maybe, type Milliseconds, sanitizeFileName, waitForMs } from '@dereekb/util';
import { existsSync } from 'node:fs';
import { readFile, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type MsGraphCliReauthOnceFunction, type MsGraphCliReauthTokenSource, msGraphCliDownloadFailureClassify, msGraphCliReauthOnce } from './download.failure';
import { downloadMsGraphCliFile } from './file.download';
import { MSGRAPH_CLI_MAIL_DUMP_MAX_FILE_NAME_LENGTH, msGraphCliMailDumpHash8, msGraphCliMailDumpMessagePath } from './mail.dump';
import { msGraphCliTeamsChatMessageMarkdown } from './teams.markdown';

// MARK: Constants
/**
 * The manifest's file name, in the dump directory and in each chat's directory.
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE = 'manifest.json';

/**
 * The version of both manifests a chat dump writes.
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION = 1;

/**
 * The top-level manifest's `kind`, so another dump's manifest (e.g. a mail dump's) is never mistaken for it.
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_KIND = 'msgraph-cli/teams-chat-dump';

/**
 * The per-chat manifest's `kind`.
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_MANIFEST_KIND = 'msgraph-cli/teams-chat-dump-chat';

/**
 * The folder of the dump directory that holds one folder per chat, named by its chat key.
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHATS_DIR = 'chats';

/**
 * The file in a chat's folder holding the chat as Graph returns it (topic, type, members).
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_FILE = 'chat.json';

/**
 * How many days before now each re-run re-reads, to catch edits, soft deletes and reactions. Graph's
 * `lastModifiedDateTime` filter returns the messages created after the window start, so changes to older messages
 * are only seen inside this lookback (live P5: every edit and 98% of reactions happen within 7 days).
 */
export const DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_LOOKBACK_DAYS = 7;

/**
 * How far before the stored mark a re-run starts: visibility lag and clock skew. 10 minutes.
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_OVERLAP: Milliseconds = 600_000;

/**
 * How many messages one run writes by default. Unchanged messages don't count. A re-run continues.
 */
export const DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_MAX_MESSAGES = 5000;

/**
 * `teams chat dump --concurrency`: how many messages of a page are written at once. 3 by default, at most 4.
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_CONCURRENCY: CliConcurrencyOptionConfig = { default: 3, max: 4 };

/**
 * The least time between two Teams reads of one run (message pages, hosted contents, the chat list, get-chat):
 * Teams allows 1 read per second per chat and per user.
 */
export const MSGRAPH_CLI_TEAMS_READ_INTERVAL: Milliseconds = 1000;

/**
 * How often a progress line is written at most: every 2 seconds.
 */
export const MSGRAPH_CLI_TEAMS_CHAT_DUMP_PROGRESS_INTERVAL: Milliseconds = 2000;

const DAY_MS: Milliseconds = 24 * 60 * 60 * 1000;

// MARK: Selection
/**
 * Which chats a dump holds: one chat by id, every chat, or the chats matching `--with` / `--topic` / `--type`.
 */
export interface MsGraphCliTeamsChatDumpSelection {
  readonly chatId?: Maybe<string>;
  readonly allChats?: Maybe<boolean>;
  /**
   * Names or addresses that must each match a member (case-insensitive substring).
   */
  readonly withNames?: Maybe<readonly string[]>;
  /**
   * A case-insensitive substring of the chat topic.
   */
  readonly topic?: Maybe<string>;
  readonly chatType?: Maybe<MicrosoftGraphChatType>;
}

function isMsGraphCliTeamsChatDumpFiltered(selection: MsGraphCliTeamsChatDumpSelection): boolean {
  return (selection.withNames ?? []).some((x) => x.trim()) || Boolean(selection.topic?.trim()) || Boolean(selection.chatType);
}

/**
 * Returns the hash the top-level manifest records for a selection: the first 16 hex characters of the SHA-256 of
 * its canonical JSON (`{ chat }`, `{ allChats }`, or `{ with: sorted lower-cased names, topic: lower-cased, type }`).
 * The chat id, names and topic are never written.
 *
 * @param selection - The selection.
 * @returns The hash.
 * @throws {CliError} `INVALID_ARGUMENT` unless exactly one of a chat id, `--all-chats`, or the filters is given.
 */
export function msGraphCliTeamsChatDumpSelectionKey(selection: MsGraphCliTeamsChatDumpSelection): string {
  const filtered = isMsGraphCliTeamsChatDumpFiltered(selection);
  let canonical: Record<string, unknown>;

  if (selection.chatId && (selection.allChats || filtered)) {
    throw new CliError({ message: 'A chat id selects one chat; it does not take --all-chats, --with, --topic or --type.', code: 'INVALID_ARGUMENT', suggestion: 'Pass a chat id, or --all-chats, or --with/--topic/--type.' });
  } else if (selection.allChats && filtered) {
    throw new CliError({ message: '--all-chats selects every chat; it does not take --with, --topic or --type.', code: 'INVALID_ARGUMENT', suggestion: 'Drop --all-chats to dump only the matching chats.' });
  } else if (selection.chatId) {
    canonical = { chat: selection.chatId };
  } else if (selection.allChats) {
    canonical = { allChats: true };
  } else if (filtered) {
    const withNames = (selection.withNames ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean);
    canonical = { with: Array.from(new Set(withNames)).sort((a, b) => a.localeCompare(b)), topic: selection.topic?.trim().toLowerCase() || undefined, type: selection.chatType || undefined };
  } else {
    throw new CliError({ message: 'Choose which chats to dump.', code: 'INVALID_ARGUMENT', suggestion: 'Pass a chat id (teams chats lists them), --all-chats, or --with "Ada" / --topic / --type to match chats.' });
  }

  return cliSha256HexPrefix(JSON.stringify(canonical), 16);
}

/**
 * Returns a chat's key: the first 16 hex characters of the SHA-256 of its id. It names the chat's folder and keys
 * the top-level manifest, so the chat id is never in a path.
 *
 * @param chatId - The chat id.
 * @returns The key.
 */
export function msGraphCliTeamsChatKey(chatId: string): string {
  return cliSha256HexPrefix(chatId, 16);
}

// MARK: Manifests
/**
 * A chat in the top-level manifest's index.
 */
export interface MsGraphCliTeamsChatDumpChatIndexEntry {
  readonly addedAt: ISO8601DateString;
  /**
   * The last run whose selection matched the chat.
   */
  readonly lastSeenAt?: Maybe<ISO8601DateString>;
  /**
   * Copied from the chat's manifest: where its last finished walk reached.
   */
  readonly mark?: Maybe<ISO8601DateString>;
  /**
   * Set when reading the chat failed (e.g. the user left it); cleared by a finished walk.
   */
  readonly failed?: Maybe<{ readonly code: string; readonly at: ISO8601DateString }>;
}

/**
 * The dump directory's `manifest.json`. It holds hashes and dates only.
 */
export interface MsGraphCliTeamsChatDumpManifest {
  readonly version: typeof MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION;
  readonly kind: typeof MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_KIND;
  /**
   * {@link msGraphCliTeamsChatDumpSelectionKey} of the selection.
   */
  readonly selection: string;
  /**
   * `--since`, set by the first run and inherited by later ones.
   */
  readonly since?: Maybe<ISO8601DateString>;
  /**
   * Cumulative over every run.
   */
  readonly counts: CliDownloadCounts;
  readonly lastRun?: Maybe<ISO8601DateString>;
  /**
   * By chat key.
   */
  readonly chats: Record<string, MsGraphCliTeamsChatDumpChatIndexEntry>;
}

/**
 * A chat walk in progress, so an interrupted run resumes it.
 */
export interface MsGraphCliTeamsChatDumpWalk {
  /**
   * The window start (`lastModifiedDateTime gt <from>`), or undefined to read the whole history.
   */
  readonly from?: Maybe<ISO8601DateString>;
  readonly startedAt: ISO8601DateString;
  /**
   * The newest `lastModifiedDateTime` seen so far.
   */
  readonly newest?: Maybe<ISO8601DateString>;
  /**
   * The `$skiptoken` of the last finished page's `@odata.nextLink`.
   */
  readonly skipToken?: Maybe<string>;
}

/**
 * A message in a chat's manifest, by message id.
 */
export interface MsGraphCliTeamsChatDumpMessageEntry {
  /**
   * The message's files' path from the chat's folder, without extension. Absent for a message first seen deleted,
   * or a pruned one.
   */
  readonly file?: Maybe<string>;
  readonly lastModifiedDateTime?: Maybe<ISO8601DateString>;
  readonly deletedDateTime?: Maybe<ISO8601DateString>;
  /**
   * How many of the message's files (inline images, attachments) failed for good. The next walk that returns the
   * message retries them.
   */
  readonly missing?: Maybe<number>;
}

/**
 * A chat folder's `manifest.json`.
 */
export interface MsGraphCliTeamsChatDumpChatManifest {
  readonly version: typeof MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION;
  readonly kind: typeof MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_MANIFEST_KIND;
  /**
   * The chat key.
   */
  readonly chat: string;
  /**
   * Set when a walk finishes: `min(newest lastModifiedDateTime seen, the walk's start)`. The next window starts
   * at `min(mark - overlap, now - lookback)`.
   */
  readonly mark?: Maybe<ISO8601DateString>;
  readonly walk?: Maybe<MsGraphCliTeamsChatDumpWalk>;
  readonly counts: CliDownloadCounts;
  readonly lastRun?: Maybe<ISO8601DateString>;
  readonly messages: Record<string, MsGraphCliTeamsChatDumpMessageEntry>;
  /**
   * Soft-deleted messages, with `reason: 'softDeleted'`.
   */
  readonly removed: CliDownloadRemovedEntry[];
}

/**
 * Configuration of {@link msGraphCliTeamsChatDumpManifestStore}.
 */
export interface MsGraphCliTeamsChatDumpManifestStoreConfig {
  readonly dir: string;
  /**
   * {@link msGraphCliTeamsChatDumpSelectionKey} of this run's selection.
   */
  readonly selection: string;
  readonly since?: Maybe<Date>;
}

/**
 * Returns the store of a chat dump's top-level manifest. Reading refuses a manifest of another kind (e.g. a mail
 * dump), another selection, or another `--since`; a run without `--since` takes the stored one.
 *
 * @param config - The directory, selection hash and `--since`.
 * @returns The store.
 */
export function msGraphCliTeamsChatDumpManifestStore(config: MsGraphCliTeamsChatDumpManifestStoreConfig): CliDownloadManifestStore<MsGraphCliTeamsChatDumpManifest> {
  const since = config.since?.toISOString();
  const empty = (): MsGraphCliTeamsChatDumpManifest => ({ version: MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION, kind: MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_KIND, selection: config.selection, since, counts: emptyCliDownloadCounts(), lastRun: undefined, chats: {} });

  return cliDownloadManifestStore({
    dir: config.dir,
    fileName: MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE,
    empty,
    accept: (parsed: unknown) => {
      const existing = (typeof parsed === 'object' && parsed != null ? parsed : {}) as MsGraphCliTeamsChatDumpManifest;

      if (existing.version !== MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION || existing.kind !== MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_KIND) {
        throw new CliError({ message: `${config.dir} holds a manifest that is not a teams chat dump this version of msgraph-cli can read.`, code: 'INVALID_ARGUMENT', suggestion: 'Dump into a new directory.' });
      } else if (existing.selection !== config.selection) {
        throw new CliError({ message: `${config.dir} holds a dump of another chat selection.`, code: 'INVALID_ARGUMENT', suggestion: 'Dump into a new directory, or re-run with the chat id, --all-chats or --with/--topic/--type that directory was created with.' });
      } else if (since && existing.since !== since) {
        throw new CliError({ message: `${config.dir} was created with another --since.`, code: 'INVALID_ARGUMENT', suggestion: 'Drop --since to use the stored one, or dump into a new directory.' });
      }

      return { ...empty(), ...existing, since: existing.since ?? undefined, chats: existing.chats ?? {} };
    }
  });
}

/**
 * Returns the store of one chat's manifest (`chats/<chatKey>/manifest.json`). Reading refuses a manifest of
 * another kind or another chat.
 *
 * @param config - The chat's folder and key.
 * @param config.dir - The chat's folder.
 * @param config.chatKey - The chat key.
 * @returns The store.
 */
export function msGraphCliTeamsChatDumpChatManifestStore(config: { readonly dir: string; readonly chatKey: string }): CliDownloadManifestStore<MsGraphCliTeamsChatDumpChatManifest> {
  const empty = (): MsGraphCliTeamsChatDumpChatManifest => ({ version: MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION, kind: MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_MANIFEST_KIND, chat: config.chatKey, mark: undefined, walk: undefined, counts: emptyCliDownloadCounts(), lastRun: undefined, messages: {}, removed: [] });

  return cliDownloadManifestStore({
    dir: config.dir,
    fileName: MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE,
    empty,
    accept: (parsed: unknown) => {
      const existing = (typeof parsed === 'object' && parsed != null ? parsed : {}) as MsGraphCliTeamsChatDumpChatManifest;

      if (existing.version !== MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION || existing.kind !== MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_MANIFEST_KIND || existing.chat !== config.chatKey) {
        throw new CliError({ message: `${config.dir} holds a manifest that is not this chat's.`, code: 'INVALID_ARGUMENT', suggestion: 'Dump into a new directory.' });
      }

      return { ...empty(), ...existing, messages: existing.messages ?? {}, removed: existing.removed ?? [] };
    }
  });
}

// MARK: Paths and windows
/**
 * Returns a chat message's files' path from its chat's folder, without extension: mail dump's dated layout keyed by
 * `createdDateTime`, `messages/<yyyy>/<mm>/<createdUtc>_<sha8(id)>` (`messages/undated/<sha8>` without a date). The
 * creation time never changes, so an edit rewrites the files in place.
 *
 * @param message - The message's id and creation time.
 * @returns The path, `/`-separated.
 */
export function msGraphCliTeamsChatDumpMessagePath(message: Pick<MicrosoftGraphChatMessage, 'id' | 'createdDateTime'>): string {
  return msGraphCliMailDumpMessagePath({ id: message.id, receivedDateTime: message.createdDateTime });
}

/**
 * Input to {@link msGraphCliTeamsChatDumpWindowStart}.
 */
export interface MsGraphCliTeamsChatDumpWindowStartInput {
  /**
   * The chat's mark, from its last finished walk.
   */
  readonly mark?: Maybe<ISO8601DateString | Date>;
  readonly since?: Maybe<Date>;
  readonly lookbackDays: number;
  readonly now: Date;
}

/**
 * Returns where a chat's walk starts (`lastModifiedDateTime gt <start>`):
 * - after a finished walk: `min(mark - 10 min, now - lookback)`, raised to `since - 1 ms` when `since` is later;
 * - on the first walk: `since - 1 ms`, or undefined (no filter: the whole history).
 *
 * @param input - The mark, `--since`, lookback and clock.
 * @returns The window start, or undefined for the whole history.
 */
export function msGraphCliTeamsChatDumpWindowStart(input: MsGraphCliTeamsChatDumpWindowStartInput): Maybe<Date> {
  const { mark, since, lookbackDays, now } = input;
  const sinceStart = since ? since.getTime() - 1 : undefined;
  let result: Maybe<Date>;

  if (mark == null) {
    result = sinceStart == null ? undefined : new Date(sinceStart);
  } else {
    const start = Math.min(new Date(mark).getTime() - MSGRAPH_CLI_TEAMS_CHAT_DUMP_OVERLAP, now.getTime() - lookbackDays * DAY_MS);
    result = new Date(sinceStart == null ? start : Math.max(start, sinceStart));
  }

  return result;
}

// MARK: Pacer
/**
 * Configuration of {@link msGraphCliTeamsReadPacer}.
 */
export interface MsGraphCliTeamsReadPacerConfig {
  /**
   * The least time between two reads. Defaults to {@link MSGRAPH_CLI_TEAMS_READ_INTERVAL}.
   */
  readonly interval?: Maybe<Milliseconds>;
  /**
   * The clock, in ms. Defaults to `Date.now`.
   */
  readonly now?: Maybe<() => number>;
  /**
   * Waits. Defaults to a timer; a spec passes one that advances a fake clock.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
}

/**
 * Returns a gate that keeps reads at least `interval` apart: each call takes the next free slot (computed at once,
 * so concurrent callers queue in call order) and resolves when it comes.
 *
 * @param config - The interval, clock and wait.
 * @returns The gate; await it before each read.
 */
export function msGraphCliTeamsReadPacer(config?: Maybe<MsGraphCliTeamsReadPacerConfig>): () => Promise<void> {
  const interval = config?.interval ?? MSGRAPH_CLI_TEAMS_READ_INTERVAL;
  const now = config?.now ?? Date.now;
  const wait = config?.wait ?? waitForMs;
  let nextSlot = Number.NEGATIVE_INFINITY;

  return async () => {
    const at = now();
    const slot = Math.max(at, nextSlot);
    nextSlot = slot + interval;

    if (slot > at) {
      await wait(slot - at);
    }
  };
}

// MARK: Dump
/**
 * Configuration of {@link dumpMsGraphCliTeamsChats}.
 */
export interface MsGraphCliTeamsChatDumpConfig extends MsGraphCliTeamsChatDumpSelection {
  readonly graphContext: MicrosoftGraphContext;
  /**
   * Reset once when Graph rejects the token mid-run, so a long dump survives an early expiry.
   */
  readonly tokenSource?: Maybe<MsGraphCliReauthTokenSource>;
  /**
   * The dump directory (mode 0700).
   */
  readonly dir: string;
  /**
   * Skip messages created before this instant. Stored by the first run; later runs inherit it.
   */
  readonly since?: Maybe<Date>;
  /**
   * Days before now each re-run re-reads for changes. Defaults to {@link DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_LOOKBACK_DAYS}.
   */
  readonly lookbackDays?: Maybe<number>;
  /**
   * Also write a `.md` rendering of each message.
   */
  readonly markdown: boolean;
  /**
   * Also download each message's inline images.
   */
  readonly hostedContents: boolean;
  /**
   * Also download each message's file attachments (SharePoint / OneDrive links).
   */
  readonly attachments: boolean;
  /**
   * Delete a soft-deleted message's files instead of only marking it deleted.
   */
  readonly prune: boolean;
  /**
   * The most messages one run writes; unchanged messages don't count.
   */
  readonly maxMessages: number;
  /**
   * The most bytes one run writes.
   */
  readonly maxBytes?: Maybe<number>;
  /**
   * How many messages of a page are written at once. Defaults to 3.
   */
  readonly concurrency?: Maybe<number>;
  readonly idleTimeout?: Maybe<Milliseconds>;
  /**
   * Cancels the run (Ctrl+C). Finished messages are kept and the manifests saved.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Receives the progress lines (counts only).
   */
  readonly progress?: Maybe<(line: string) => void>;
  /**
   * Waits between retries and between paced reads. A spec passes a fake.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
  readonly now?: Maybe<() => Date>;
  /**
   * The least time between two Teams reads. Defaults to {@link MSGRAPH_CLI_TEAMS_READ_INTERVAL}.
   */
  readonly readInterval?: Maybe<Milliseconds>;
}

/**
 * What `teams chat dump` prints: counts for this run, never an id, name or content.
 */
export interface MsGraphCliTeamsChatDumpResult {
  readonly dir: string;
  /**
   * Chats walked this run.
   */
  readonly chats: number;
  readonly written: number;
  readonly skipped: number;
  readonly removed: number;
  readonly failed: number;
  /**
   * Inline images and attachments written.
   */
  readonly files: number;
  /**
   * Attachment links that are not downloadable files (folders, packages, malware-flagged items).
   */
  readonly unsupported: number;
  readonly bytes: number;
  /**
   * True when every selected chat's walk finished this run.
   */
  readonly complete: boolean;
  readonly failedCodes?: Readonly<Record<string, number>>;
}

interface ChatDumpRunCounts extends CliDownloadCounts {
  readonly files: number;
  readonly unsupported: number;
}

interface WrittenMessage {
  readonly file: string;
  readonly bytes: number;
  readonly files: number;
  readonly missing: number;
  readonly unsupported: number;
  readonly failedCodes: Readonly<Record<string, number>>;
}

interface ChatWalkResult {
  readonly complete: boolean;
  readonly budget?: boolean;
}

const HOSTED_CONTENT_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg'
};

/**
 * Returns the file extension of an inline image by its response type: png, jpg, gif, webp, bmp or svg, else `bin`.
 *
 * @param contentType - The response's `content-type`.
 * @returns The extension, without the dot.
 */
export function msGraphCliTeamsHostedContentExtension(contentType: Maybe<string>): string {
  return HOSTED_CONTENT_EXTENSIONS[(contentType ?? '').split(';')[0].trim().toLowerCase()] ?? 'bin';
}

function isReferenceAttachment(attachment: MicrosoftGraphChatMessageAttachment): boolean {
  return attachment.contentType === 'reference' && Boolean(attachment.contentUrl);
}

function attachmentFileName(attachment: MicrosoftGraphChatMessageAttachment): string {
  return `${msGraphCliMailDumpHash8(attachment.id ?? attachment.contentUrl ?? '')}_${sanitizeFileName(attachment.name, { mode: 'strict', maxLength: MSGRAPH_CLI_MAIL_DUMP_MAX_FILE_NAME_LENGTH, fallback: 'attachment' })}`;
}

async function readDirNames(path: string): Promise<string[]> {
  let result: string[];

  try {
    result = await readdir(path);
  } catch {
    result = [];
  }

  return result;
}

function isoTime(value: Maybe<string>): number {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * Archives Teams chats into a directory, incrementally: per chat, the messages as JSON plus Markdown, their inline
 * images and (optionally) their file attachments.
 *
 * - The selection (a chat id, every chat, or `--with`/`--topic`/`--type`) is resolved again each run, so newly
 *   matching chats are added. Chats are walked one at a time, in chat key order.
 * - Each chat walk reads every page of `lastModifiedDateTime gt <window start>` (see
 *   {@link msGraphCliTeamsChatDumpWindowStart}), writes the new or changed messages (by `lastModifiedDateTime`),
 *   and records soft deletes (deleting the files with `prune`). A finished walk sets the chat's mark; an
 *   interrupted one resumes from its stored `$skiptoken`.
 * - Every Teams read is paced to 1 per second for the whole run.
 * - A file that fails for good (403, 404) is counted and recorded as `missing`, and retried by the next walk that
 *   returns its message. A chat that cannot be read is recorded and skipped. An outage or throttling that outlasts
 *   its retries, a rejected token, a full disk, a cancel or `maxMessages` / `maxBytes` stop the run with the
 *   manifests saved and the walk cursor at the unfinished page's start; a re-run continues.
 *
 * Directories are created with mode 0700 and files with 0600. Progress lines and the result carry counts only.
 *
 * @param config - The selection, directory and options.
 * @returns This run's counts.
 * @throws {CliError} `INVALID_ARGUMENT` for a bad selection or lookback, a non-empty directory that is not a chat dump, or another selection or `--since`.
 * @throws {CliDownloadAbortedError} When the signal fired; finished messages and the manifests are kept.
 */
export async function dumpMsGraphCliTeamsChats(config: MsGraphCliTeamsChatDumpConfig): Promise<MsGraphCliTeamsChatDumpResult> {
  const { graphContext, dir, signal, wait } = config;
  const selection = msGraphCliTeamsChatDumpSelectionKey(config);
  const lookbackDays = config.lookbackDays ?? DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_LOOKBACK_DAYS;

  if (!Number.isFinite(lookbackDays) || lookbackDays < 0) {
    throw new CliError({ message: '--lookback must be 0 or more days.', code: 'INVALID_ARGUMENT', suggestion: 'e.g. --lookback 7 (the default), or --lookback 0 for new messages only.' });
  }

  const store = msGraphCliTeamsChatDumpManifestStore({ dir, selection, since: config.since });

  if (!existsSync(store.path) && !(await isCliDirEmptyOrMissing(dir))) {
    throw new CliError({ message: `${dir} is not empty and holds no msgraph-cli teams chat dump.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass a new or empty directory.' });
  }

  const now = config.now ?? (() => new Date());
  const progressLine = config.progress ?? (() => undefined);
  const classify = msGraphCliDownloadFailureClassify;
  const concurrency = config.concurrency ?? MSGRAPH_CLI_TEAMS_CHAT_DUMP_CONCURRENCY.default;
  const request = microsoftGraphRequest(graphContext);
  const reauth: MsGraphCliReauthOnceFunction = config.tokenSource ? msGraphCliReauthOnce(config.tokenSource) : <T>(op: () => Promise<T>) => op();
  const pace = msGraphCliTeamsReadPacer({ interval: config.readInterval, now: () => now().getTime(), wait });
  const read = <T>(fn: () => Promise<T>) => runCliTaskWithRetry({ task: () => reauth(() => pace().then(fn)), classify, signal, wait });

  await ensureCliPrivateDir(dir);
  const manifest = await store.read();
  const since = manifest.since ? new Date(manifest.since) : undefined;
  const runAt = now().toISOString();
  const chatIndex: Record<string, MsGraphCliTeamsChatDumpChatIndexEntry> = { ...manifest.chats };
  const failedCodes: Record<string, number> = {};
  let run: ChatDumpRunCounts = { ...emptyCliDownloadCounts(), files: 0, unsupported: 0 };
  let messagesRead = 0;
  let chatsWalked = 0;
  let chatCount = 0;
  let lastProgressAt = Number.NEGATIVE_INFINITY;
  // saves the chat being walked; set while a chat walk runs
  let saveCurrentChat: Maybe<() => Promise<void>>;

  function progress(force = false): void {
    const at = now().getTime();

    if (force || at - lastProgressAt >= MSGRAPH_CLI_TEAMS_CHAT_DUMP_PROGRESS_INTERVAL) {
      lastProgressAt = at;
      progressLine(`chat dump: chat ${chatsWalked}/${chatCount}, ${messagesRead} messages read, ${run.written} written, ${run.removed} removed, ${run.failed} failed`);
    }
  }

  function countFailure(code: string, count = 1): void {
    failedCodes[code] = (failedCodes[code] ?? 0) + count;
  }

  function topSnapshot(): MsGraphCliTeamsChatDumpManifest {
    return { ...manifest, counts: addCliDownloadCounts(manifest.counts, run), lastRun: runAt, chats: chatIndex };
  }

  // MARK: Resolve chats
  async function resolveChats(): Promise<MicrosoftGraphChat[]> {
    let result: MicrosoftGraphChat[];

    if (config.chatId) {
      // the user named this chat, so a 403 or 404 is the run's error
      const chat = await read(() => request<MicrosoftGraphChat>(microsoftGraphChatRequest(config.chatId as string)));
      result = [{ ...chat, id: chat.id || (config.chatId as string) }];
    } else {
      const filter = { withNames: config.withNames, topic: config.topic, chatType: config.chatType };
      const chats: MicrosoftGraphChat[] = [];
      let link: Maybe<string>;
      let first = true;

      while (first || link) {
        const pageLink = link;
        const page = await read(() => request<MicrosoftGraphPage<MicrosoftGraphChat>>(pageLink ? { method: 'GET', path: pageLink } : microsoftGraphChatsRequest()));
        chats.push(...(page.value ?? []));
        link = page['@odata.nextLink'] ?? undefined;
        first = false;
      }

      // chats that don't match (and their members) are never written or logged
      result = config.allChats ? chats : chats.filter((x) => microsoftGraphChatMatches(x, filter));
    }

    return result;
  }

  async function writeChatFile(chatDir: string, chat: MicrosoftGraphChat): Promise<void> {
    const path = join(chatDir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_FILE);
    const content = `${JSON.stringify(chat, null, 2)}\n`;
    let current: Maybe<string>;

    try {
      current = await readFile(path, 'utf8');
    } catch {
      current = undefined;
    }

    if (current !== content) {
      await writeCliFileAtomic({ path, data: content });
    }
  }

  // MARK: Chat walk
  async function dumpChat(chatId: string, chatKey: string): Promise<ChatWalkResult> {
    const chatDir = join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHATS_DIR, chatKey);
    const chatStore = msGraphCliTeamsChatDumpChatManifestStore({ dir: chatDir, chatKey });
    const chatManifest = await chatStore.read();
    const messages: Record<string, MsGraphCliTeamsChatDumpMessageEntry> = { ...chatManifest.messages };
    const removed: CliDownloadRemovedEntry[] = [...chatManifest.removed];
    let chatRun: CliDownloadCounts = emptyCliDownloadCounts();
    let mark = chatManifest.mark;
    let walk: Maybe<MsGraphCliTeamsChatDumpWalk> = chatManifest.walk ?? { from: msGraphCliTeamsChatDumpWindowStart({ mark, since, lookbackDays, now: now() })?.toISOString(), startedAt: now().toISOString(), newest: undefined, skipToken: undefined };
    let restarted = false;
    let result: Maybe<ChatWalkResult>;

    function tally(counts: Partial<ChatDumpRunCounts>): void {
      chatRun = addCliDownloadCounts(chatRun, counts);
      run = { ...addCliDownloadCounts(run, counts), files: run.files + (counts.files ?? 0), unsupported: run.unsupported + (counts.unsupported ?? 0) };
    }

    function chatSnapshot(): MsGraphCliTeamsChatDumpChatManifest {
      return { ...chatManifest, mark, walk, counts: addCliDownloadCounts(chatManifest.counts, chatRun), lastRun: runAt, messages, removed };
    }

    saveCurrentChat = () => chatStore.save(chatSnapshot());

    function chatPath(relativePath: string): string {
      return resolveCliDirChildPath(chatDir, relativePath);
    }

    async function writeChatFileAt(relativePath: string, data: string): Promise<number> {
      const path = chatPath(relativePath);
      await ensureCliPrivateDir(dirname(path));
      return writeCliFileAtomic({ path, data });
    }

    /**
     * The files of a message already on disk, by hosted content id and attachment id, relative to its `.md`.
     *
     * @param message - The message.
     * @param file - The message's files' path from the chat folder, without extension.
     * @returns The local files.
     */
    async function localFiles(message: MicrosoftGraphChatMessage, file: string) {
      const stem = file.slice(file.lastIndexOf('/') + 1);
      const hostedNames = await readDirNames(chatPath(`${file}/hosted`));
      const attachmentNames = new Set(await readDirNames(chatPath(`${file}/attachments`)));
      const hostedFiles = new Map<string, string>();
      const attachmentFiles = new Map<string, string>();

      for (const ref of microsoftGraphChatMessageHostedContentRefs(message)) {
        const hash = msGraphCliMailDumpHash8(ref.hostedContentId);
        const name = hostedNames.find((x) => (x === hash || x.startsWith(`${hash}.`)) && !x.endsWith(CLI_DOWNLOAD_PARTIAL_SUFFIX));

        if (name) {
          hostedFiles.set(ref.hostedContentId, `${stem}/hosted/${name}`);
        }
      }

      for (const attachment of message.attachments ?? []) {
        const name = isReferenceAttachment(attachment) ? attachmentFileName(attachment) : undefined;

        if (attachment.id && name && attachmentNames.has(name)) {
          attachmentFiles.set(attachment.id, `${stem}/attachments/${name}`);
        }
      }

      return { stem, hostedFiles, attachmentFiles };
    }

    // writes one message's files; it may run again after a failure, so every write replaces and existing files are kept
    async function writeMessage(message: MicrosoftGraphChatMessage, taskSignal: AbortSignal): Promise<WrittenMessage> {
      const file = msGraphCliTeamsChatDumpMessagePath(message);
      const itemFailedCodes: Record<string, number> = {};
      const notDownloaded = new Set<string>();
      let bytes = 0;
      let files = 0;
      let missing = 0;
      let unsupported = 0;

      function itemFailure(error: unknown): void {
        const failure = error instanceof CliDownloadTaskFailedError ? error.failure : classify(error);

        if (failure.kind !== 'item' || taskSignal.aborted) {
          throw error;
        }

        missing += 1;
        itemFailedCodes[failure.code] = (itemFailedCodes[failure.code] ?? 0) + 1;
      }

      // the text first, so it is kept even when a download fails
      bytes += await writeChatFileAt(`${file}.json`, `${JSON.stringify(message, null, 2)}\n`);
      const local = await localFiles(message, file);

      if (config.hostedContents) {
        for (const ref of microsoftGraphChatMessageHostedContentRefs(message)) {
          if (!local.hostedFiles.has(ref.hostedContentId)) {
            const hash = msGraphCliMailDumpHash8(ref.hostedContentId);
            const out = chatPath(`${file}/hosted/${hash}`);

            try {
              await ensureCliPrivateDir(dirname(out));
              const downloaded = await reauth(() => pace().then(() => downloadMsGraphCliFile({ graphContext, request: microsoftGraphChatMessageHostedContentRequest(ref), out, idleTimeout: config.idleTimeout, signal: taskSignal })));
              const name = `${hash}.${msGraphCliTeamsHostedContentExtension(downloaded.contentType)}`;
              await rename(out, chatPath(`${file}/hosted/${name}`));
              local.hostedFiles.set(ref.hostedContentId, `${local.stem}/hosted/${name}`);
              bytes += downloaded.bytes;
              files += 1;
            } catch (error) {
              itemFailure(error);
            }
          }
        }
      }

      if (config.attachments) {
        for (const attachment of (message.attachments ?? []).filter(isReferenceAttachment)) {
          const key = attachment.id ?? attachment.contentUrl ?? '';

          if (!local.attachmentFiles.has(key)) {
            const name = attachmentFileName(attachment);

            try {
              // SharePoint / OneDrive, not a Teams read: not paced
              const item = await reauth(() => request<MicrosoftGraphDriveItem>(microsoftGraphSharedDriveItemRequest({ url: attachment.contentUrl as string, select: MICROSOFT_GRAPH_SHARED_FILE_SELECT })));
              const driveId = item.parentReference?.driveId;

              if (item.file == null || item.folder != null || item.package != null || item.malware != null || !driveId) {
                unsupported += 1;
              } else {
                const out = chatPath(`${file}/attachments/${name}`);
                await ensureCliPrivateDir(dirname(out));
                const downloaded = await reauth(() => downloadMsGraphCliFile({ graphContext, request: microsoftGraphDownloadDriveItemRequest({ driveId, id: item.id }), out, idleTimeout: config.idleTimeout, signal: taskSignal }));
                local.attachmentFiles.set(key, `${local.stem}/attachments/${name}`);
                bytes += downloaded.bytes;
                files += 1;
              }
            } catch (error) {
              itemFailure(error);
              notDownloaded.add(key);
            }
          }
        }
      }

      // last, so it links the local files
      if (config.markdown) {
        bytes += await writeChatFileAt(`${file}.md`, msGraphCliTeamsChatMessageMarkdown({ message, hostedFiles: local.hostedFiles, attachmentFiles: local.attachmentFiles, notDownloaded }));
      }

      return { file, bytes, files, missing, unsupported, failedCodes: itemFailedCodes };
    }

    async function writeMessages(pageMessages: readonly MicrosoftGraphChatMessage[]): Promise<number> {
      const byId = new Map(pageMessages.map((x) => [x.id, x]));
      const written = new Map<string, WrittenMessage>();
      const lastErrors = new Map<string, unknown>();
      const remainingBytes = config.maxBytes == null ? undefined : config.maxBytes - run.bytes;
      let stopError: Maybe<{ readonly error: unknown }>;
      let deferred: number;

      if (remainingBytes != null && remainingBytes <= 0) {
        deferred = pageMessages.length;
      } else {
        const tasks: CliBulkDownloadTask[] = pageMessages.map((message) => ({
          key: message.id,
          run: (taskSignal: AbortSignal) =>
            writeMessage(message, taskSignal).then(
              (x) => {
                written.set(message.id, x);
                return x.bytes;
              },
              (error: unknown) => {
                lastErrors.set(message.id, error);
                throw error;
              }
            )
        }));

        const bulk = await runCliBulkDownload({
          tasks,
          concurrency,
          classify,
          signal,
          wait,
          maxTasks: Math.max(0, config.maxMessages - run.written),
          maxBytes: remainingBytes,
          onTaskDone: (task) => {
            const message = byId.get(task.key) as MicrosoftGraphChatMessage;
            const done = written.get(task.key) as WrittenMessage;
            messages[message.id] = { file: done.file, lastModifiedDateTime: message.lastModifiedDateTime, missing: done.missing || undefined };
            Object.entries(done.failedCodes).forEach(([code, count]) => countFailure(code, count));
            tally({ written: 1, bytes: done.bytes, files: done.files, unsupported: done.unsupported, failed: done.missing });
            progress();
          },
          onTaskFailed: (task, failure) => {
            if (failure.kind === 'transient' || failure.kind === 'throttled') {
              // still failing after its retries: stop once the page's other messages are done, without moving the cursor
              stopError ??= { error: lastErrors.get(task.key) ?? new CliDownloadTaskFailedError(failure, undefined) };
            } else {
              countFailure(failure.code);
              tally({ failed: 1 });
              progress();
            }
          }
        });

        deferred = bulk.deferred;
      }

      if (stopError) {
        throw stopError.error;
      }

      return deferred;
    }

    async function removeMessage(message: MicrosoftGraphChatMessage, entry: Maybe<MsGraphCliTeamsChatDumpMessageEntry>): Promise<void> {
      const file = entry?.file;
      const pruned = Boolean(config.prune && file);
      const deletedDateTime = message.deletedDateTime;

      if (file && pruned) {
        await rm(chatPath(`${file}.json`), { force: true });
        await rm(chatPath(`${file}.md`), { force: true });
        await rm(chatPath(file), { recursive: true, force: true });
        messages[message.id] = { lastModifiedDateTime: message.lastModifiedDateTime, deletedDateTime };
      } else if (file) {
        const jsonPath = chatPath(`${file}.json`);

        // Graph has emptied the body, so the .md is rendered again from the archived JSON
        if (config.markdown && existsSync(jsonPath)) {
          const archived = { ...(JSON.parse(await readFile(jsonPath, 'utf8')) as MicrosoftGraphChatMessage), deletedDateTime };
          const local = await localFiles(archived, file);
          await writeChatFileAt(`${file}.md`, msGraphCliTeamsChatMessageMarkdown({ message: archived, hostedFiles: local.hostedFiles, attachmentFiles: local.attachmentFiles }));
        }

        messages[message.id] = { ...entry, lastModifiedDateTime: message.lastModifiedDateTime, deletedDateTime };
      } else {
        messages[message.id] = { lastModifiedDateTime: message.lastModifiedDateTime, deletedDateTime };
      }

      removed.push({ id: message.id, reason: 'softDeleted', at: now().toISOString(), pruned });
      tally({ removed: 1 });
    }

    while (result == null) {
      if (signal?.aborted) {
        throw new CliDownloadAbortedError('The dump was cancelled; finished messages were kept and the manifests saved.');
      }

      const current = walk as MsGraphCliTeamsChatDumpWalk;
      let page: Maybe<MicrosoftGraphChatMessagePage>;

      try {
        page = await read(() => request<MicrosoftGraphChatMessagePage>(microsoftGraphChatMessagesRequest({ chatId, since: current.from, skipToken: current.skipToken, includeSystemEvents: true })));
      } catch (error) {
        const failure = error instanceof CliDownloadTaskFailedError ? error.failure : classify(error);

        if (failure.kind !== 'item') {
          throw error;
        } else if (current.skipToken && !restarted) {
          // a rejected skip token: walk again from page 1 with the same window; written messages are skipped
          restarted = true;
          walk = { ...current, skipToken: undefined };
        } else {
          // e.g. the user left the chat: record it and go on with the next chat
          chatIndex[chatKey] = { ...(chatIndex[chatKey] as MsGraphCliTeamsChatDumpChatIndexEntry), failed: { code: failure.code, at: now().toISOString() } };
          countFailure(failure.code);
          tally({ failed: 1 });
          await chatStore.save(chatSnapshot());
          result = { complete: false };
        }
      }

      if (page) {
        const items = page.value ?? [];
        const writes: MicrosoftGraphChatMessage[] = [];
        messagesRead += items.length;

        for (const message of items) {
          const entry = messages[message.id];

          if (since && isoTime(message.createdDateTime) < since.getTime()) {
            tally({ skipped: 1 });
          } else if (entry && entry.lastModifiedDateTime === message.lastModifiedDateTime && !entry.missing) {
            tally({ skipped: 1 });
          } else if (message.deletedDateTime) {
            await removeMessage(message, entry);
          } else {
            writes.push(message);
          }
        }

        const deferred = writes.length > 0 ? await writeMessages(writes) : 0;

        if (deferred > 0) {
          // a budget was reached: the cursor stays at this page's start, so the next run reads it again
          await chatStore.save(chatSnapshot());
          result = { complete: false, budget: true };
        } else {
          const newestTime = Math.max(isoTime(current.newest), ...items.map((x) => isoTime(x.lastModifiedDateTime)));
          const newest = Number.isFinite(newestTime) ? new Date(newestTime).toISOString() : undefined;
          const skipToken = microsoftGraphPageSkipToken(page['@odata.nextLink']);

          if (skipToken) {
            walk = { ...current, newest, skipToken };
            chatStore.saveSoon(chatSnapshot());
          } else {
            // done: messages that arrived or changed during the walk fall inside the next window
            mark = newest && isoTime(newest) < isoTime(current.startedAt) ? newest : current.startedAt;
            walk = undefined;
            chatIndex[chatKey] = { ...(chatIndex[chatKey] as MsGraphCliTeamsChatDumpChatIndexEntry), mark, failed: undefined };
            await chatStore.save(chatSnapshot());
            result = { complete: true };
          }
        }

        progress();
      }
    }

    saveCurrentChat = undefined;
    return result;
  }

  // MARK: Run
  let complete = false;

  try {
    const chats = (await resolveChats()).map((chat) => ({ chat, key: msGraphCliTeamsChatKey(chat.id) })).sort((a, b) => a.key.localeCompare(b.key));
    let added = 0;
    chatCount = chats.length;

    for (const { chat, key } of chats) {
      const chatDir = join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHATS_DIR, key);
      await ensureCliPrivateDir(chatDir);
      await writeChatFile(chatDir, chat);

      if (chatIndex[key] == null) {
        added += 1;
      }

      chatIndex[key] = { ...(chatIndex[key] ?? { addedAt: runAt }), lastSeenAt: runAt };
    }

    await store.save(topSnapshot());
    progressLine(`chat dump: ${chats.length} chats (${added} new)`);
    let allComplete = true;
    let stopped = false;

    for (const { chat, key } of chats) {
      if (!stopped) {
        const walked = await dumpChat(chat.id, key);
        chatsWalked += 1;
        allComplete &&= walked.complete;
        stopped = Boolean(walked.budget);
      }
    }

    complete = allComplete && !stopped;
    await store.save(topSnapshot());
    progress(true);
  } catch (error) {
    // the cursor of the chat being walked stays at its unfinished page's start
    await saveCurrentChat?.().catch(() => undefined);
    await store.save(topSnapshot()).catch(() => undefined);
    // a bulk task or read that failed for good rethrows its cause, so callers see the Graph error
    throw error instanceof CliDownloadTaskFailedError && error.cause != null ? error.cause : error;
  }

  const failed = run.failed;
  return { dir, chats: chatsWalked, written: run.written, skipped: run.skipped, removed: run.removed, failed, files: run.files, unsupported: run.unsupported, bytes: run.bytes, complete, ...(failed > 0 ? { failedCodes: { ...failedCodes } } : {}) };
}
