import { type CliBulkDownloadTask, type CliConcurrencyOptionConfig, type CliDownloadCounts, type CliDownloadManifestStore, CliDownloadAbortedError, CliDownloadTaskFailedError, CliError, cliDownloadManifestStore, cliSha256HexPrefix, ensureCliPrivateDir, runCliBulkDownload, writeCliFileAtomic } from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphBodyContentType,
  type MicrosoftGraphContext,
  type MicrosoftGraphDeltaRemovedReason,
  type MicrosoftGraphMessage,
  type MicrosoftGraphMessageDeltaItem,
  type MicrosoftGraphRawRequestInput,
  type MicrosoftGraphRecipient,
  MICROSOFT_GRAPH_MESSAGE_SELECT,
  getMessages,
  listMessageAttachments,
  listMessagesDeltaPage,
  microsoftGraphDateTimeLiteral,
  microsoftGraphGetMessageAttachmentContentRequest,
  microsoftGraphGetMessageMimeRequest,
  DEFAULT_MICROSOFT_GRAPH_MESSAGE_DELTA_PAGE_SIZE
} from '@dereekb/microsoft';
import { type EmailAddress, type ISO8601DateString, type Maybe, type Milliseconds, sanitizeFileName } from '@dereekb/util';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { msGraphCliDownloadFailureClassify } from './download.failure';
import { downloadMsGraphCliFile } from './file.download';

/**
 * The version of the dump manifest this CLI writes.
 */
export const MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION = 1;

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

export interface MsGraphCliMailDumpConfig {
  readonly graphContext: MicrosoftGraphContext;
  readonly dir: string;
  readonly mailbox?: Maybe<EmailAddress>;
  /**
   * The folder to dump. Delta is per-folder.
   */
  readonly folder: string;
  /**
   * Only messages received at or after this instant. Used by the first run only; later runs resume the stored round.
   */
  readonly since?: Maybe<Date>;
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
   * Delete a removed message's files instead of only recording the removal.
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

function emptyMsGraphCliMailDumpManifest(config: Pick<MsGraphCliMailDumpConfig, 'mailbox' | 'folder' | 'immutableIds'>): MsGraphCliMailDumpManifest {
  return { version: MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION, mailbox: msGraphCliMailDumpMailboxKey(config.mailbox), folder: config.folder, immutableIds: config.immutableIds, counts: { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 }, messages: {}, removed: [] };
}

/**
 * Returns the store of a dump directory's manifest. Reading starts a new manifest when there is none, and
 * refuses one written for another mailbox, folder or id type: its ids and resume links would not match.
 * Saving writes the same JSON as before (`JSON.stringify(m, null, 2)` and a newline), atomically.
 *
 * @param config - The dump's directory, mailbox, folder and id type.
 * @returns The store.
 */
export function msGraphCliMailDumpManifestStore(config: Pick<MsGraphCliMailDumpConfig, 'dir' | 'mailbox' | 'folder' | 'immutableIds'>): CliDownloadManifestStore<MsGraphCliMailDumpManifest> {
  const empty = () => emptyMsGraphCliMailDumpManifest(config);

  return cliDownloadManifestStore({
    dir: config.dir,
    fileName: MSGRAPH_CLI_MAIL_DUMP_MANIFEST_FILE,
    empty,
    accept: (parsed: unknown) => {
      const base = empty();
      const existing = (typeof parsed === 'object' && parsed != null ? parsed : {}) as MsGraphCliMailDumpManifest;

      if (existing.version !== MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION || existing.mailbox !== base.mailbox || existing.folder !== base.folder || existing.immutableIds !== base.immutableIds) {
        throw new CliError({ message: `${config.dir} holds a dump of another mailbox, folder or id type.`, code: 'INVALID_ARGUMENT', suggestion: 'Dump into a new directory, or re-run with the --mailbox, --folder and --mutable-ids values that directory was created with.' });
      }

      return { ...base, ...existing, messages: existing.messages ?? {}, removed: existing.removed ?? [] };
    }
  });
}

/**
 * Reads the dump directory's manifest, or starts a new one. A manifest written for another mailbox,
 * folder or id type is refused: its ids and resume links would not match.
 *
 * @param config - The dump's directory, mailbox, folder and id type.
 * @returns The manifest.
 * @throws {CliError} `INVALID_ARGUMENT` when the manifest belongs to another dump or is not readable JSON.
 */
export function readMsGraphCliMailDumpManifest(config: Pick<MsGraphCliMailDumpConfig, 'dir' | 'mailbox' | 'folder' | 'immutableIds'>): Promise<MsGraphCliMailDumpManifest> {
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
 * Dumps a mail folder into a directory, incrementally: the first run walks a delta round from the start
 * (or `since`), and later runs resume from the stored `nextLink` / `deltaLink`, writing only new or changed
 * messages. Bodies are read 20 at a time through `$batch`, then each page's messages are written by the
 * dbx-cli bulk-download engine, `concurrency` at a time, each retried on a stall, a short body, a throttle
 * or an outage.
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
  const now = config.now ?? (() => new Date());
  const progress = config.progress ?? (() => undefined);
  const concurrency = config.concurrency ?? MSGRAPH_CLI_MAIL_DUMP_CONCURRENCY.default;
  const deltaPage = listMessagesDeltaPage(graphContext);
  const readMessages = getMessages(graphContext);
  const readAttachments = listMessageAttachments(graphContext);

  await ensureCliPrivateDir(dir);
  const store = msGraphCliMailDumpManifestStore(config);
  let manifest = await store.read();
  const messages: Record<string, MsGraphCliMailDumpManifestEntry> = { ...manifest.messages };
  const removedEntries: MsGraphCliMailDumpRemovedEntry[] = [...manifest.removed];
  const run: MsGraphCliMailDumpRun = { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 };
  const filter = config.since && !manifest.nextLink && !manifest.deltaLink ? `receivedDateTime ge ${microsoftGraphDateTimeLiteral(config.since)}` : manifest.filter;
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

    bytes += await writeDumpFile(`${file}.json`, `${JSON.stringify(message, null, 2)}\n`);

    if (config.markdown) {
      bytes += await writeDumpFile(`${file}.md`, msGraphCliMailDumpMarkdown(message));
    }

    if (config.eml) {
      bytes += await downloadDumpFile(`${file}.eml`, microsoftGraphGetMessageMimeRequest({ mailbox, id: message.id }), taskSignal);
    }

    if (config.attachments && message.hasAttachments) {
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
    manifest = {
      ...manifest,
      ...cursor,
      filter,
      lastRun: now().toISOString(),
      counts: { written: counts.written + run.written, skipped: counts.skipped + run.skipped, removed: counts.removed + run.removed, failed: counts.failed + run.failed, bytes: counts.bytes + run.bytes },
      messages,
      removed: removedEntries
    };
    await store.save(manifest);
    // the manifest's counts are cumulative; start this run's tally again from the saved totals
    Object.assign(run, { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 });
  }

  const totals = { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0 };
  let link = manifest.nextLink ?? manifest.deltaLink;
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

      const pageSize = Math.min(DEFAULT_MICROSOFT_GRAPH_MESSAGE_DELTA_PAGE_SIZE, config.maxMessages - processed);
      const page = await deltaPage({ link, mailbox, immutableIds, folder: config.folder, since: config.since, pageSize });
      const items = page.value ?? [];
      const changed = items.filter((x) => !x['@removed']);
      const fetch = changed.filter((x) => !x.changeKey || messages[x.id]?.changeKey !== x.changeKey);
      run.skipped += changed.length - fetch.length;

      for (const item of items.filter((x) => x['@removed'])) {
        await removeMessage(item);
      }

      if (fetch.length > 0) {
        const read = await readMessages({ ids: fetch.map((x) => x.id), mailbox, immutableIds, format: config.bodyFormat, select: MSGRAPH_CLI_MAIL_DUMP_MESSAGE_SELECT, wait: config.wait });
        const pageMessages: MicrosoftGraphMessage[] = [];

        for (const item of read) {
          if (item.message) {
            pageMessages.push(item.message);
          } else {
            run.failed += 1;
            progress(`could not read a message (${item.status} ${item.error?.code ?? ''})`);
          }
        }

        await writeMessages(pageMessages);
      }

      processed += items.length;
      const deltaLink = page['@odata.deltaLink'];
      const nextLink = deltaLink ? undefined : page['@odata.nextLink'];
      addToTotals();
      await saveManifest({ nextLink, deltaLink: deltaLink ?? manifest.deltaLink });
      progress(`${processed} messages processed`);
      link = nextLink ?? deltaLink;

      if (!nextLink) {
        complete = true;
        break;
      }
    }
  } catch (e) {
    addToTotals();
    await saveManifest({ nextLink: manifest.nextLink, deltaLink: manifest.deltaLink });
    // a bulk task that failed fatally (e.g. a rejected token) rethrows its cause, so callers see the Graph error
    throw e instanceof CliDownloadTaskFailedError && e.cause != null ? e.cause : e;
  }

  return { dir, ...totals, complete };
}
