import { type CliBulkDownloadTask, type CliConcurrencyOptionConfig, type CliDownloadCounts, type CliDownloadManifestStore, CliDownloadAbortedError, CliDownloadTaskFailedError, CliError, cliDownloadManifestStore, cliSha256HexPrefix, ensureCliPrivateDir, runCliBulkDownload, writeCliFileAtomic } from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphBodyContentType,
  type MicrosoftGraphContext,
  type MicrosoftGraphDeltaRemovedReason,
  type MicrosoftGraphMailRequest,
  type MicrosoftGraphMessage,
  type MicrosoftGraphMessageDeltaItem,
  type MicrosoftGraphMessageDeltaPage,
  type MicrosoftGraphRawRequestInput,
  type MicrosoftGraphRecipient,
  MICROSOFT_GRAPH_MESSAGE_DELTA_SELECT,
  MICROSOFT_GRAPH_MESSAGE_SELECT,
  getMessages,
  listMessageAttachments,
  listMessagesDeltaPage,
  microsoftGraphDateTimeLiteral,
  microsoftGraphGetMessageAttachmentContentRequest,
  microsoftGraphGetMessageMimeRequest,
  microsoftGraphListMessagesRequest,
  microsoftGraphRequest,
  microsoftGraphSearchMessagesRequest,
  DEFAULT_MICROSOFT_GRAPH_MESSAGE_DELTA_PAGE_SIZE
} from '@dereekb/microsoft';
import { type EmailAddress, type ISO8601DateString, type Maybe, type Milliseconds, sanitizeFileName } from '@dereekb/util';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { msGraphCliDownloadFailureClassify } from './download.failure';
import { downloadMsGraphCliFile } from './file.download';

/**
 * The version of the manifest a delta dump writes. Its JSON is unchanged since the first dump format.
 */
export const MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION = 1;

/**
 * The version of the manifest a list or search dump writes: v1 plus `mode` and a `selection` hash, without the raw `filter`.
 */
export const MSGRAPH_CLI_MAIL_DUMP_LIST_MANIFEST_VERSION = 2;

/**
 * How `mail dump` picks messages:
 * - `delta`: one folder's delta round, resumed from the stored links; tracks removals.
 * - `list`: a filtered message list (`--from`, `--until`, `--unread`, `--has-attachments`, `--all-folders`), re-walked each run.
 * - `search`: a `$search` (KQL), re-walked each run.
 */
export type MsGraphCliMailDumpMode = 'delta' | 'list' | 'search';

/**
 * The folder a dump reads when none is given (delta and list modes).
 */
export const DEFAULT_MSGRAPH_CLI_MAIL_DUMP_FOLDER = 'inbox';

/**
 * What a list or search manifest records as its folder when the walk covers every folder.
 */
export const MSGRAPH_CLI_MAIL_DUMP_ALL_FOLDERS = '*';

/**
 * The page size of a list or search walk.
 */
export const MSGRAPH_CLI_MAIL_DUMP_LIST_PAGE_SIZE = 100;

/**
 * The manifest's file name inside the dump directory.
 */
export const MSGRAPH_CLI_MAIL_DUMP_MANIFEST_FILE = 'manifest.json';

/**
 * How many messages one `mail dump` run processes by default. A re-run continues where it stopped.
 */
export const DEFAULT_MSGRAPH_CLI_MAIL_DUMP_MAX_MESSAGES = 500;

/**
 * `--concurrency` for `mail dump`: 3 messages at once by default, at most 4 (Outlook allows 4 concurrent
 * requests per app per mailbox).
 */
export const MSGRAPH_CLI_MAIL_DUMP_CONCURRENCY: CliConcurrencyOptionConfig = { default: 3, max: 4 };

/**
 * The longest file name the dump writes for an attachment, extension included.
 */
export const MSGRAPH_CLI_MAIL_DUMP_MAX_FILE_NAME_LENGTH = 80;

/**
 * The message fields a dump writes: the default list fields plus the body, `changeKey` and the rest of a
 * message's addressing.
 */
export const MSGRAPH_CLI_MAIL_DUMP_MESSAGE_SELECT = `${MICROSOFT_GRAPH_MESSAGE_SELECT},body,changeKey,bccRecipients,replyTo,sentDateTime,internetMessageId,parentFolderId,importance,categories`;

/**
 * One dumped message: where its files are and the `changeKey` they hold.
 */
export interface MsGraphCliMailDumpManifestEntry {
  /**
   * The message's files' path from the dump directory, without extension (`messages/2026/11/…_ab12cd34`).
   */
  readonly file: string;
  readonly changeKey?: Maybe<string>;
}

/**
 * A message a delta round reported removed (deleted, or moved out of the folder).
 */
export interface MsGraphCliMailDumpRemovedEntry {
  readonly id: string;
  readonly reason?: Maybe<MicrosoftGraphDeltaRemovedReason>;
  readonly at: ISO8601DateString;
  /**
   * Whether the dumped files were deleted (`--prune`).
   */
  readonly pruned: boolean;
}

/**
 * Counts a dump keeps across runs.
 */
export type MsGraphCliMailDumpCounts = CliDownloadCounts;

/**
 * `manifest.json`: what was dumped and where the next run resumes.
 */
export interface MsGraphCliMailDumpManifest {
  readonly version: typeof MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION;
  /**
   * `me`, or the first 16 hex characters of the SHA-256 of the lower-cased shared mailbox address. The
   * address itself is never written.
   */
  readonly mailbox: string;
  readonly folder: string;
  readonly immutableIds: boolean;
  /**
   * The `$filter` the first round ran with.
   */
  readonly filter?: Maybe<string>;
  /**
   * Where the next run resumes when the last one stopped inside a round.
   */
  readonly nextLink?: Maybe<string>;
  /**
   * Where the next run resumes once a round has finished: it returns only what changed since.
   */
  readonly deltaLink?: Maybe<string>;
  readonly counts: MsGraphCliMailDumpCounts;
  readonly lastRun?: Maybe<ISO8601DateString>;
  readonly messages: Record<string, MsGraphCliMailDumpManifestEntry>;
  readonly removed: MsGraphCliMailDumpRemovedEntry[];
}

/**
 * `manifest.json` of a list or search dump (v2). The selection is kept only as a hash: the raw filter or
 * query can contain an address, so it is never written.
 */
export interface MsGraphCliMailDumpListManifest {
  readonly version: typeof MSGRAPH_CLI_MAIL_DUMP_LIST_MANIFEST_VERSION;
  readonly mode: Exclude<MsGraphCliMailDumpMode, 'delta'>;
  /**
   * {@link msGraphCliMailDumpSelectionKey} of the selection options the dump was created with.
   */
  readonly selection: string;
  /**
   * `me`, or a hash of the shared mailbox address (see {@link MsGraphCliMailDumpManifest.mailbox}).
   */
  readonly mailbox: string;
  /**
   * The folder walked, or {@link MSGRAPH_CLI_MAIL_DUMP_ALL_FOLDERS} for every folder.
   */
  readonly folder: string;
  readonly immutableIds: boolean;
  /**
   * Where the next run resumes when the last one stopped inside a walk: the paging part of Graph's
   * `@odata.nextLink` (its query without `$filter` and `$search`). The path and the filter are rebuilt from
   * the selection options, whose hash must match. Cleared when a walk finishes, so the next run walks again.
   */
  readonly nextLink?: Maybe<string>;
  readonly counts: MsGraphCliMailDumpCounts;
  readonly lastRun?: Maybe<ISO8601DateString>;
  readonly messages: Record<string, MsGraphCliMailDumpManifestEntry>;
  /**
   * Always empty: a list or search walk does not track removals. Kept so every manifest has the same fields.
   */
  readonly removed: MsGraphCliMailDumpRemovedEntry[];
}

/**
 * Any manifest a dump directory can hold: v1 (delta) or v2 (list or search).
 */
export type MsGraphCliMailDumpAnyManifest = MsGraphCliMailDumpManifest | MsGraphCliMailDumpListManifest;

/**
 * The options that pick which messages a dump holds. Any of `until`, `from`, `unread`, `hasAttachments` or
 * `allFolders` selects list mode, `search` selects search mode, and neither keeps delta mode.
 */
export interface MsGraphCliMailDumpSelection {
  /**
   * The folder to read. Defaults to {@link DEFAULT_MSGRAPH_CLI_MAIL_DUMP_FOLDER} in delta and list modes; a
   * search covers every folder unless one is given.
   */
  readonly folder?: Maybe<string>;
  /**
   * Only messages received at or after this instant. Delta mode uses it on the first run only; list mode on every walk.
   */
  readonly since?: Maybe<Date>;
  /**
   * List mode: only messages received before this instant.
   */
  readonly until?: Maybe<Date>;
  /**
   * List mode: only messages from this sender.
   */
  readonly from?: Maybe<EmailAddress>;
  /**
   * List mode: only unread messages.
   */
  readonly unread?: Maybe<boolean>;
  /**
   * List mode: only messages with file attachments.
   */
  readonly hasAttachments?: Maybe<boolean>;
  /**
   * List mode: read every folder (`/messages`) instead of one.
   */
  readonly allFolders?: Maybe<boolean>;
  /**
   * Search mode: a KQL query (`$search`). Graph cannot combine it with a filter.
   */
  readonly search?: Maybe<string>;
}

/**
 * What `mail dump` prints: counts for this run, never message content.
 */
export interface MsGraphCliMailDumpResult {
  readonly dir: string;
  readonly written: number;
  readonly skipped: number;
  readonly removed: number;
  readonly failed: number;
  readonly bytes: number;
  /**
   * False when the run stopped at `--max-messages` inside a round; re-run to continue.
   */
  readonly complete: boolean;
}

export interface MsGraphCliMailDumpConfig extends MsGraphCliMailDumpSelection {
  readonly graphContext: MicrosoftGraphContext;
  readonly dir: string;
  readonly mailbox?: Maybe<EmailAddress>;
  readonly bodyFormat: MicrosoftGraphBodyContentType;
  /**
   * Also write a `.md` rendering of each message.
   */
  readonly markdown: boolean;
  /**
   * Also write each message's MIME as `.eml`.
   */
  readonly eml: boolean;
  /**
   * Also write each message's file attachments.
   */
  readonly attachments: boolean;
  /**
   * Write only the file attachments of messages that have any: no `$batch` body read and no `.json`, `.md`
   * or `.eml`. Implies `attachments`. Each message is still recorded with its `changeKey`.
   */
  readonly attachmentsOnly?: Maybe<boolean>;
  /**
   * Delete a removed message's files instead of only recording the removal. Delta mode only.
   */
  readonly prune: boolean;
  readonly maxMessages: number;
  /**
   * The most attachment bytes one run writes; an attachment that would pass it is skipped.
   */
  readonly maxBytes?: Maybe<number>;
  readonly immutableIds: boolean;
  /**
   * Aborts an `.eml` or attachment download when no byte arrives for this long. Defaults to the
   * `downloadMsGraphCliFile` default (60 s).
   */
  readonly idleTimeout?: Maybe<Milliseconds>;
  /**
   * How many messages are written at once. Defaults to {@link MSGRAPH_CLI_MAIL_DUMP_CONCURRENCY}'s default (3).
   */
  readonly concurrency?: Maybe<number>;
  /**
   * Cancels the run (e.g. Ctrl+C). Finished messages are kept and the manifest saved, so a re-run resumes.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Receives a progress line (stderr in the CLI).
   */
  readonly progress?: Maybe<(line: string) => void>;
  /**
   * Waits between `$batch` retries and between a message's retries. A spec passes a fake.
   */
  readonly wait?: Maybe<(ms: number) => Promise<unknown>>;
  readonly now?: Maybe<() => Date>;
}

/**
 * Returns the first 8 hex characters of a value's SHA-256: a stable, opaque file-name part.
 *
 * @param value - The value, e.g. a message id.
 * @returns The hash prefix, 8 hex characters.
 */
export function msGraphCliMailDumpHash8(value: string): string {
  return cliSha256HexPrefix(value, 8);
}

/**
 * Returns what the manifest records for a mailbox: `me`, or a hash of the address.
 *
 * @param mailbox - The shared mailbox address, if any.
 * @returns The manifest value.
 */
export function msGraphCliMailDumpMailboxKey(mailbox: Maybe<EmailAddress>): string {
  return mailbox ? cliSha256HexPrefix(mailbox.toLowerCase(), 16) : 'me';
}

/**
 * Makes a file name safe to write: path separators, control characters, `..` and anything outside letters,
 * digits, `.`, `-`, `_` and spaces become `_`; leading dots and underscores are dropped; the name is capped at `maxLength`,
 * keeping its extension.
 *
 * @param name - The raw name, e.g. an attachment's.
 * @param maxLength - The longest result. Defaults to {@link MSGRAPH_CLI_MAIL_DUMP_MAX_FILE_NAME_LENGTH}.
 * @returns The safe name; `attachment` when nothing is left.
 * @deprecated Use `sanitizeFileName(name, { mode: 'strict', maxLength, fallback: 'attachment' })` from `@dereekb/util`.
 */
// COMPAT: kept for consumers of the package index; the util sanitizer owns the rule now.
export function sanitizeMsGraphCliFileName(name: Maybe<string>, maxLength = MSGRAPH_CLI_MAIL_DUMP_MAX_FILE_NAME_LENGTH): string {
  return sanitizeFileName(name, { mode: 'strict', maxLength, fallback: 'attachment' });
}

// an attachment's file name in the dump: the strict rule, unchanged since the first dump format
function msGraphCliMailDumpAttachmentFileName(name: Maybe<string>): string {
  return sanitizeFileName(name, { mode: 'strict', maxLength: MSGRAPH_CLI_MAIL_DUMP_MAX_FILE_NAME_LENGTH, fallback: 'attachment' });
}

/**
 * Returns a message's files' path from the dump directory, without extension:
 * `messages/<yyyy>/<mm>/<receivedUtc>_<sha8(id)>`. It never contains a subject or an address.
 *
 * @param input - The message's id and received instant.
 * @param input.id - The message id.
 * @param input.receivedDateTime - When the message was received.
 * @returns The path, `/`-separated.
 */
export function msGraphCliMailDumpMessagePath(input: { readonly id: string; readonly receivedDateTime?: Maybe<string> }): string {
  const received = input.receivedDateTime ? new Date(input.receivedDateTime) : undefined;
  const hash = msGraphCliMailDumpHash8(input.id);
  let result: string;

  if (received && !Number.isNaN(received.getTime())) {
    const iso = received.toISOString();
    const stamp = iso.replace(/\.\d{3}Z$/, 'Z').replaceAll(':', '-');
    result = `messages/${iso.slice(0, 4)}/${iso.slice(5, 7)}/${stamp}_${hash}`;
  } else {
    result = `messages/undated/${hash}`;
  }

  return result;
}

function formatRecipients(recipients: Maybe<readonly MicrosoftGraphRecipient[]>): string {
  return (recipients ?? []).map((x) => (x.emailAddress?.name ? `${x.emailAddress.name} <${x.emailAddress.address ?? ''}>` : (x.emailAddress?.address ?? ''))).join(', ');
}

/**
 * Renders a dumped message as Markdown: the subject as a heading, the addressing as a list, then the
 * body (an HTML body is fenced).
 *
 * @param message - The message, with its body.
 * @returns The Markdown.
 */
export function msGraphCliMailDumpMarkdown(message: MicrosoftGraphMessage): string {
  const lines = [`# ${message.subject || '(no subject)'}`, '', `- From: ${formatRecipients(message.from ? [message.from] : [])}`, `- To: ${formatRecipients(message.toRecipients)}`];

  if (message.ccRecipients?.length) {
    lines.push(`- Cc: ${formatRecipients(message.ccRecipients)}`);
  }

  lines.push(`- Received: ${message.receivedDateTime ?? ''}`, `- Id: ${message.id}`, '');

  if (message.body?.contentType === 'html') {
    lines.push('```html', message.body.content, '```');
  } else {
    lines.push(message.body?.content ?? message.bodyPreview ?? '');
  }

  return `${lines.join('\n')}\n`;
}

/**
 * The dump directory, mailbox, id type and selection a manifest belongs to.
 */
export type MsGraphCliMailDumpManifestStoreConfig = Pick<MsGraphCliMailDumpConfig, 'dir' | 'mailbox' | 'immutableIds'> & MsGraphCliMailDumpSelection;

/**
 * Returns how a dump picks its messages, refusing option sets Graph cannot run.
 *
 * @param selection - The selection options.
 * @returns `search` with `search`, `list` with any list-only option (`until`, `from`, `unread`, `hasAttachments`,
 * `allFolders`), else `delta` (which also takes `since`).
 * @throws {CliError} `INVALID_ARGUMENT` for `search` combined with a filter option (Graph cannot combine
 * `$search` with `$filter`), an empty `search`, or `allFolders` together with a `folder`.
 */
export function msGraphCliMailDumpMode(selection: MsGraphCliMailDumpSelection): MsGraphCliMailDumpMode {
  // since alone stays in delta mode: a delta round takes a receivedDateTime filter
  const listOnly = selection.until != null || Boolean(selection.from) || Boolean(selection.unread) || Boolean(selection.hasAttachments);
  const filtered = listOnly || selection.since != null;
  let result: MsGraphCliMailDumpMode;

  if (selection.allFolders && selection.folder) {
    throw new CliError({ message: '--all-folders reads every folder; it does not take --folder.', code: 'INVALID_ARGUMENT', suggestion: 'Pass --folder <name> for one folder, or --all-folders for all of them.' });
  }

  if (selection.search != null) {
    if (!selection.search.trim()) {
      throw new CliError({ message: '--search needs a query.', code: 'INVALID_ARGUMENT', suggestion: 'e.g. --search "invoice" or --search "from:ada@example.com"' });
    }

    if (filtered) {
      // models: B13 — Graph rejects $search combined with $filter on messages
      throw new CliError({
        message: '--search does not take --since, --until, --from, --unread or --has-attachments: Graph cannot combine $search with a filter.',
        code: 'INVALID_ARGUMENT',
        suggestion: 'Put them in the query as KQL (from:ada@example.com received>=2026-11-01), or drop --search to filter without searching.'
      });
    }

    result = 'search';
  } else if (listOnly || selection.allFolders) {
    result = 'list';
  } else {
    result = 'delta';
  }

  return result;
}

/**
 * Returns the hash a list or search manifest records for its selection: the first 16 hex characters of the
 * SHA-256 of the selection's canonical JSON (set options only, keys sorted, an address lower-cased). The
 * options themselves are never written.
 *
 * @param selection - The selection options.
 * @returns The hash, or undefined in delta mode.
 */
export function msGraphCliMailDumpSelectionKey(selection: MsGraphCliMailDumpSelection): Maybe<string> {
  const mode = msGraphCliMailDumpMode(selection);
  let canonical: Maybe<Record<string, unknown>>;

  if (mode === 'search') {
    canonical = { search: selection.search };
  } else if (mode === 'list') {
    canonical = {
      allFolders: selection.allFolders || undefined,
      from: selection.from?.toLowerCase() || undefined,
      hasAttachments: selection.hasAttachments || undefined,
      since: selection.since ? microsoftGraphDateTimeLiteral(selection.since) : undefined,
      unread: selection.unread || undefined,
      until: selection.until ? microsoftGraphDateTimeLiteral(selection.until) : undefined
    };
  }

  return canonical ? cliSha256HexPrefix(JSON.stringify(canonical), 16) : undefined;
}

function msGraphCliMailDumpFolderKey(selection: MsGraphCliMailDumpSelection, mode: MsGraphCliMailDumpMode): string {
  let result: string;

  if (mode === 'delta' || (mode === 'list' && !selection.allFolders)) {
    result = selection.folder || DEFAULT_MSGRAPH_CLI_MAIL_DUMP_FOLDER;
  } else {
    // --all-folders, or a search without --folder
    result = (mode === 'search' && selection.folder) || MSGRAPH_CLI_MAIL_DUMP_ALL_FOLDERS;
  }

  return result;
}

function emptyMsGraphCliMailDumpManifest(config: MsGraphCliMailDumpManifestStoreConfig): MsGraphCliMailDumpAnyManifest {
  const mode = msGraphCliMailDumpMode(config);
  const mailbox = msGraphCliMailDumpMailboxKey(config.mailbox);
  const folder = msGraphCliMailDumpFolderKey(config, mode);
  const counts: MsGraphCliMailDumpCounts = { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 };
  let result: MsGraphCliMailDumpAnyManifest;

  if (mode === 'delta') {
    result = { version: MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION, mailbox, folder, immutableIds: config.immutableIds, counts, messages: {}, removed: [] };
  } else {
    // the undefined keys hold their place, so a saved v2 manifest always lists its fields in this order
    result = { version: MSGRAPH_CLI_MAIL_DUMP_LIST_MANIFEST_VERSION, mode, selection: msGraphCliMailDumpSelectionKey(config) as string, mailbox, folder, immutableIds: config.immutableIds, nextLink: undefined, counts, lastRun: undefined, messages: {}, removed: [] };
  }

  return result;
}

/**
 * Returns the store of a dump directory's manifest. Reading starts a new manifest when there is none, and
 * refuses one written for another mailbox, folder, id type, mode or selection: its ids and resume links would
 * not match. A v1 manifest is read as a delta dump and a v2 manifest as a list or search dump.
 *
 * Saving writes `JSON.stringify(m, null, 2)` and a newline, atomically; a delta dump's JSON is unchanged since
 * the first dump format.
 *
 * @param config - The dump's directory, mailbox, id type and selection.
 * @returns The store.
 */
export function msGraphCliMailDumpManifestStore(config: MsGraphCliMailDumpManifestStoreConfig): CliDownloadManifestStore<MsGraphCliMailDumpAnyManifest> {
  const empty = () => emptyMsGraphCliMailDumpManifest(config);

  return cliDownloadManifestStore({
    dir: config.dir,
    fileName: MSGRAPH_CLI_MAIL_DUMP_MANIFEST_FILE,
    empty,
    accept: (parsed: unknown) => {
      const base = empty();
      const existing = (typeof parsed === 'object' && parsed != null ? parsed : {}) as MsGraphCliMailDumpAnyManifest;
      const sameDump =
        existing.version === base.version &&
        existing.mailbox === base.mailbox &&
        existing.folder === base.folder &&
        existing.immutableIds === base.immutableIds &&
        (base.version === MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION || (existing.version === MSGRAPH_CLI_MAIL_DUMP_LIST_MANIFEST_VERSION && existing.mode === base.mode && existing.selection === base.selection));

      if (!sameDump) {
        throw new CliError({
          message: `${config.dir} holds a dump of another mailbox, folder, selection or id type.`,
          code: 'INVALID_ARGUMENT',
          suggestion: 'Dump into a new directory, or re-run with the --mailbox, --folder, selection (--since, --until, --from, --unread, --has-attachments, --all-folders, --search) and --mutable-ids values that directory was created with.'
        });
      }

      return { ...base, ...existing, messages: existing.messages ?? {}, removed: existing.removed ?? [] } as MsGraphCliMailDumpAnyManifest;
    }
  });
}

/**
 * Reads the dump directory's manifest, or starts a new one. A manifest written for another mailbox,
 * folder, id type or selection is refused: its ids and resume links would not match.
 *
 * @param config - The dump's directory, mailbox, id type and selection.
 * @returns The manifest.
 * @throws {CliError} `INVALID_ARGUMENT` when the manifest belongs to another dump or is not readable JSON.
 */
export function readMsGraphCliMailDumpManifest(config: MsGraphCliMailDumpManifestStoreConfig): Promise<MsGraphCliMailDumpAnyManifest> {
  return msGraphCliMailDumpManifestStore(config).read();
}

interface MsGraphCliMailDumpRun {
  written: number;
  skipped: number;
  removed: number;
  failed: number;
  bytes: number;
}

/**
 * Returns the paging part of a list or search page's `@odata.nextLink`: its query without `$filter` and
 * `$search`, which can contain an address or a search term. The path (mailbox and folder) and the filter are
 * rebuilt from the selection options on resume.
 *
 * @param nextLink - The page's `@odata.nextLink`.
 * @returns The query string to store, or undefined on the last page.
 */
export function msGraphCliMailDumpListCursor(nextLink: Maybe<string>): Maybe<string> {
  let result: Maybe<string>;

  if (nextLink) {
    const params = new URL(nextLink, 'https://graph.microsoft.com').searchParams;
    params.delete('$filter');
    params.delete('$search');
    result = params.toString() || undefined;
  }

  return result;
}

/**
 * Builds the GET for one page of a list or search walk: the first page from the selection, or the page a
 * stored {@link msGraphCliMailDumpListCursor} points to. Pages select only `id`, `changeKey`,
 * `receivedDateTime` and `hasAttachments`; bodies are read through `$batch` for new or changed messages only.
 *
 * @param input - The selection, mailbox and id type, plus the page size and cursor.
 * @param input.mode - `list` or `search`.
 * @param input.pageSize - The page size. It replaces the cursor's when the cursor pages by offset (`$skip`).
 * @param input.cursor - Where the walk resumes, if not at the start.
 * @returns The request.
 */
export function msGraphCliMailDumpListPageRequest(input: MsGraphCliMailDumpSelection & Pick<MsGraphCliMailDumpConfig, 'mailbox' | 'immutableIds'> & { readonly mode: Exclude<MsGraphCliMailDumpMode, 'delta'>; readonly pageSize: number; readonly cursor?: Maybe<string> }): MicrosoftGraphMailRequest {
  const { mode, mailbox, immutableIds, pageSize, cursor } = input;
  let request: MicrosoftGraphMailRequest;

  if (mode === 'search') {
    request = microsoftGraphSearchMessagesRequest({ query: input.search ?? '', folder: input.allFolders ? undefined : input.folder, mailbox, immutableIds, select: MICROSOFT_GRAPH_MESSAGE_DELTA_SELECT, top: pageSize });
  } else {
    request = microsoftGraphListMessagesRequest({
      mailbox,
      immutableIds,
      folder: input.allFolders ? undefined : input.folder || DEFAULT_MSGRAPH_CLI_MAIL_DUMP_FOLDER,
      since: input.since,
      until: input.until,
      from: input.from,
      unread: input.unread,
      hasAttachments: input.hasAttachments,
      select: MICROSOFT_GRAPH_MESSAGE_DELTA_SELECT,
      top: pageSize
    });
  }

  if (cursor) {
    const paging = Object.fromEntries(new URLSearchParams(cursor));
    // an offset cursor takes this run's page size; an opaque one keeps its own
    request = { ...request, query: { ...request.query, ...paging, ...(paging['$skip'] == null ? {} : { $top: pageSize }) } };
  }

  return request;
}

/**
 * One page of a dump's walk.
 */
interface MsGraphCliMailDumpPage {
  readonly items: readonly MicrosoftGraphMessageDeltaItem[];
  /**
   * Where the walk continues; undefined on the last page.
   */
  readonly next?: Maybe<string>;
  /**
   * Delta mode, last page: where the next round resumes.
   */
  readonly deltaLink?: Maybe<string>;
}

/**
 * Dumps mail into a directory, incrementally. How it picks messages depends on the selection, as decided by
 * {@link msGraphCliMailDumpMode}.
 *
 * - **delta** (default): the first run walks a folder's delta round from the start (or `since`), and later
 *   runs resume from the stored `nextLink` / `deltaLink`. Removals are recorded (and pruned with `prune`).
 *   The manifest is v1, unchanged.
 * - **list** / **search**: a filtered list or a `$search`, paged 100 at a time by `@odata.nextLink`. A run
 *   stopped at `maxMessages` stores the cursor and the next resumes it; a finished walk clears it, so the next
 *   run walks the selection again. Removals are not tracked. The manifest is v2.
 *
 * Every mode writes only new or changed messages (by `changeKey`). Bodies are read 20 at a time through
 * `$batch` (skipped with `attachmentsOnly`), then each page's messages are written by the dbx-cli
 * bulk-download engine, `concurrency` at a time, each retried on a stall, a short body, a throttle or an outage.
 *
 * - A message that fails for good (e.g. its attachment was deleted) is counted in `failed` and the run goes on.
 * - A message that still fails after its retries (an outage or throttling) stops the run. The manifest is
 *   saved with the finished messages but the page's starting cursor, so a re-run re-reads the page and skips
 *   what was written.
 * - The manifest is saved (atomically) after every page and before an error is rethrown.
 *
 * The directory is created with mode 0700 and each file with 0600. Nothing in the result is message content.
 *
 * @param config - The folder, directory and options.
 * @returns This run's counts.
 */
export async function dumpMsGraphCliMail(config: MsGraphCliMailDumpConfig): Promise<MsGraphCliMailDumpResult> {
  const { graphContext, dir, mailbox, immutableIds, signal } = config;
  const mode = msGraphCliMailDumpMode(config);

  if (config.prune && mode !== 'delta') {
    throw new CliError({ message: '--prune needs delta mode: a list or search dump does not track removals.', code: 'INVALID_ARGUMENT', suggestion: 'Drop --prune, or dump one folder without --until/--from/--unread/--has-attachments/--all-folders/--search to track removals.' });
  }

  const now = config.now ?? (() => new Date());
  const progress = config.progress ?? (() => undefined);
  const concurrency = config.concurrency ?? MSGRAPH_CLI_MAIL_DUMP_CONCURRENCY.default;
  const attachmentsOnly = Boolean(config.attachmentsOnly);
  const attachments = config.attachments || attachmentsOnly;
  const folder = config.folder || DEFAULT_MSGRAPH_CLI_MAIL_DUMP_FOLDER;
  const deltaPage = listMessagesDeltaPage(graphContext);
  const requestPage = microsoftGraphRequest(graphContext);
  const readMessages = getMessages(graphContext);
  const readAttachments = listMessageAttachments(graphContext);

  await ensureCliPrivateDir(dir);
  const store = msGraphCliMailDumpManifestStore(config);
  let manifest = await store.read();
  const messages: Record<string, MsGraphCliMailDumpManifestEntry> = { ...manifest.messages };
  const removedEntries: MsGraphCliMailDumpRemovedEntry[] = [...manifest.removed];
  const run: MsGraphCliMailDumpRun = { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 };
  const storedDeltaLink = manifest.version === MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION ? manifest.deltaLink : undefined;
  const filter = manifest.version === MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION && config.since && !manifest.nextLink && !manifest.deltaLink ? `receivedDateTime ge ${microsoftGraphDateTimeLiteral(config.since)}` : (manifest as MsGraphCliMailDumpManifest).filter;
  // attachment bytes written or reserved this run; concurrent messages share --max-bytes
  let attachmentBytes = 0;

  async function writeDumpFile(relativePath: string, data: string | Uint8Array): Promise<number> {
    const path = join(dir, relativePath);
    await ensureCliPrivateDir(dirname(path));
    return writeCliFileAtomic({ path, data });
  }

  // streams a raw body to disk (0600, through a `.part` file), so a large .eml or attachment is never held in memory
  async function downloadDumpFile(relativePath: string, request: MicrosoftGraphRawRequestInput, taskSignal: AbortSignal): Promise<number> {
    const path = join(dir, relativePath);
    await ensureCliPrivateDir(dirname(path));
    const { bytes } = await downloadMsGraphCliFile({ graphContext, request, out: path, idleTimeout: config.idleTimeout, signal: taskSignal });
    return bytes;
  }

  async function writeAttachments(message: MicrosoftGraphMessage, file: string, taskSignal: AbortSignal): Promise<number> {
    const page = await readAttachments({ mailbox, id: message.id });
    let bytes = 0;

    for (const attachment of page.value ?? []) {
      const size = attachment.size ?? 0;
      const isFile = !attachment['@odata.type'] || attachment['@odata.type'] === '#microsoft.graph.fileAttachment';

      if (!isFile) {
        continue;
      }

      if (config.maxBytes != null && attachmentBytes + size > config.maxBytes) {
        progress(`skipped an attachment of ${size} bytes: --max-bytes ${config.maxBytes} reached`);
        continue;
      }

      const relativePath = `${file}/attachments/${msGraphCliMailDumpHash8(attachment.id)}_${msGraphCliMailDumpAttachmentFileName(attachment.name)}`;
      let written = 0;
      // reserve the declared size, then settle to what was written (nothing when the download failed)
      attachmentBytes += size;

      try {
        written = await downloadDumpFile(relativePath, microsoftGraphGetMessageAttachmentContentRequest({ mailbox, id: message.id, attachmentId: attachment.id }), taskSignal);
      } finally {
        attachmentBytes += written - size;
      }

      bytes += written;
    }

    return bytes;
  }

  // writes one message's files; resolves the bytes written. It may run again after a failure, so every write replaces.
  async function writeMessage(message: MicrosoftGraphMessage, taskSignal: AbortSignal): Promise<number> {
    const file = msGraphCliMailDumpMessagePath(message);
    const previous = messages[message.id];
    let bytes = 0;

    if (previous && previous.file !== file) {
      await rm(join(dir, `${previous.file}.json`), { force: true });
    }

    if (!attachmentsOnly) {
      bytes += await writeDumpFile(`${file}.json`, `${JSON.stringify(message, null, 2)}\n`);

      if (config.markdown) {
        bytes += await writeDumpFile(`${file}.md`, msGraphCliMailDumpMarkdown(message));
      }

      if (config.eml) {
        bytes += await downloadDumpFile(`${file}.eml`, microsoftGraphGetMessageMimeRequest({ mailbox, id: message.id }), taskSignal);
      }
    }

    if (attachments && message.hasAttachments) {
      bytes += await writeAttachments(message, file, taskSignal);
    }

    return bytes;
  }

  async function writeMessages(pageMessages: readonly MicrosoftGraphMessage[]): Promise<void> {
    const byId = new Map(pageMessages.map((x) => [x.id, x]));
    const lastErrors = new Map<string, unknown>();
    let stopError: Maybe<{ readonly error: unknown }>;

    const tasks: CliBulkDownloadTask[] = pageMessages.map((message) => ({
      key: message.id,
      run: (taskSignal: AbortSignal) =>
        writeMessage(message, taskSignal).catch((error: unknown) => {
          lastErrors.set(message.id, error);
          throw error;
        })
    }));

    await runCliBulkDownload({
      tasks,
      concurrency,
      classify: msGraphCliDownloadFailureClassify,
      signal,
      wait: config.wait,
      onTaskDone: (task, bytes) => {
        const message = byId.get(task.key) as MicrosoftGraphMessage;
        messages[message.id] = { file: msGraphCliMailDumpMessagePath(message), changeKey: message.changeKey };
        run.written += 1;
        run.bytes += bytes;
      },
      onTaskFailed: (task, failure) => {
        if (failure.kind === 'transient' || failure.kind === 'throttled') {
          // still failing after its retries: stop once the page's other messages are done, without advancing the cursor
          stopError ??= { error: lastErrors.get(task.key) ?? new CliDownloadTaskFailedError(failure, undefined) };
        } else {
          run.failed += 1;
          progress(`could not write a message (${failure.code})`);
        }
      }
    });

    if (stopError) {
      throw stopError.error;
    }
  }

  async function removeMessage(item: MicrosoftGraphMessageDeltaItem): Promise<void> {
    const entry = messages[item.id];
    const pruned = Boolean(config.prune && entry);

    if (pruned && entry) {
      await rm(join(dir, `${entry.file}.json`), { force: true });
      await rm(join(dir, `${entry.file}.md`), { force: true });
      await rm(join(dir, `${entry.file}.eml`), { force: true });
      await rm(join(dir, entry.file), { recursive: true, force: true });
      delete messages[item.id];
    }

    removedEntries.push({ id: item.id, reason: item['@removed']?.reason, at: now().toISOString(), pruned });
    run.removed += 1;
  }

  async function saveManifest(cursor: Pick<MsGraphCliMailDumpManifest, 'nextLink' | 'deltaLink'>): Promise<void> {
    const counts = manifest.counts;
    const lastRun = now().toISOString();
    const savedCounts = { written: counts.written + run.written, skipped: counts.skipped + run.skipped, removed: counts.removed + run.removed, failed: counts.failed + run.failed, bytes: counts.bytes + run.bytes };

    if (manifest.version === MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION) {
      // v1: the same keys in the same order as the first dump format
      manifest = { ...manifest, ...cursor, filter, lastRun, counts: savedCounts, messages, removed: removedEntries };
    } else {
      manifest = { ...manifest, nextLink: cursor.nextLink, lastRun, counts: savedCounts, messages, removed: removedEntries };
    }

    await store.save(manifest);
    // the manifest's counts are cumulative; start this run's tally again from the saved totals
    Object.assign(run, { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 });
  }

  async function readPage(link: Maybe<string>, pageSize: number): Promise<MsGraphCliMailDumpPage> {
    let result: MsGraphCliMailDumpPage;

    if (mode === 'delta') {
      const page: MicrosoftGraphMessageDeltaPage = await deltaPage({ link, mailbox, immutableIds, folder, since: config.since, pageSize });
      const deltaLink = page['@odata.deltaLink'];
      result = { items: page.value ?? [], next: deltaLink ? undefined : page['@odata.nextLink'], deltaLink };
    } else {
      const request = msGraphCliMailDumpListPageRequest({ ...config, mode, pageSize, cursor: link });
      const page = await requestPage<MicrosoftGraphMessageDeltaPage>({ method: 'GET', ...request });
      result = { items: page.value ?? [], next: msGraphCliMailDumpListCursor(page['@odata.nextLink']) };
    }

    return result;
  }

  // the page's messages with their bodies, read 20 at a time through $batch; an attachments-only dump needs none
  async function readPageMessages(items: readonly MicrosoftGraphMessageDeltaItem[]): Promise<MicrosoftGraphMessage[]> {
    let result: MicrosoftGraphMessage[];

    if (attachmentsOnly) {
      result = items.map((x) => ({ id: x.id, changeKey: x.changeKey, receivedDateTime: x.receivedDateTime, hasAttachments: x.hasAttachments }));
    } else {
      const read = await readMessages({ ids: items.map((x) => x.id), mailbox, immutableIds, format: config.bodyFormat, select: MSGRAPH_CLI_MAIL_DUMP_MESSAGE_SELECT, wait: config.wait });
      result = [];

      for (const item of read) {
        if (item.message) {
          result.push(item.message);
        } else {
          run.failed += 1;
          progress(`could not read a message (${item.status} ${item.error?.code ?? ''})`);
        }
      }
    }

    return result;
  }

  const totals = { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 };
  const pageSizeMax = mode === 'delta' ? DEFAULT_MICROSOFT_GRAPH_MESSAGE_DELTA_PAGE_SIZE : MSGRAPH_CLI_MAIL_DUMP_LIST_PAGE_SIZE;
  let link = manifest.nextLink ?? storedDeltaLink;
  let processed = 0;
  let complete = false;

  function addToTotals(): void {
    totals.written += run.written;
    totals.skipped += run.skipped;
    totals.removed += run.removed;
    totals.failed += run.failed;
    totals.bytes += run.bytes;
  }

  try {
    while (processed < config.maxMessages) {
      if (signal?.aborted) {
        throw new CliDownloadAbortedError('The dump was cancelled; finished messages were kept and the manifest saved.');
      }

      const page = await readPage(link, Math.min(pageSizeMax, config.maxMessages - processed));
      const items = page.items;
      const changed = items.filter((x) => !x['@removed']);
      // --attachments-only keeps only messages with file attachments (delta, list and search pages all select hasAttachments)
      const selected = attachmentsOnly ? changed.filter((x) => x.hasAttachments) : changed;
      const fetch = selected.filter((x) => !x.changeKey || messages[x.id]?.changeKey !== x.changeKey);
      run.skipped += selected.length - fetch.length;

      for (const item of items.filter((x) => x['@removed'])) {
        await removeMessage(item);
      }

      if (fetch.length > 0) {
        await writeMessages(await readPageMessages(fetch));
      }

      processed += items.length;
      addToTotals();
      await saveManifest({ nextLink: page.next, deltaLink: page.deltaLink ?? storedDeltaLink });
      progress(`${processed} messages processed`);
      link = page.next ?? page.deltaLink;

      if (!page.next) {
        complete = true;
        break;
      }
    }
  } catch (e) {
    addToTotals();
    await saveManifest({ nextLink: manifest.nextLink, deltaLink: manifest.version === MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION ? manifest.deltaLink : undefined });
    // a bulk task that failed fatally (e.g. a rejected token) rethrows its cause, so callers see the Graph error
    throw e instanceof CliDownloadTaskFailedError && e.cause != null ? e.cause : e;
  }

  return { dir, ...totals, complete };
}
