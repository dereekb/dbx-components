import { CliError } from '@dereekb/dbx-cli';
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
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
export interface MsGraphCliMailDumpCounts {
  readonly written: number;
  readonly skipped: number;
  readonly removed: number;
  readonly failed: number;
  readonly bytes: number;
}

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
   * Receives a progress line (stderr in the CLI).
   */
  readonly progress?: Maybe<(line: string) => void>;
  /**
   * Waits between `$batch` retries. A spec passes a fake.
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
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

/**
 * Returns what the manifest records for a mailbox: `me`, or a hash of the address.
 *
 * @param mailbox - The shared mailbox address, if any.
 * @returns The manifest value.
 */
export function msGraphCliMailDumpMailboxKey(mailbox: Maybe<EmailAddress>): string {
  return mailbox ? createHash('sha256').update(mailbox.toLowerCase()).digest('hex').slice(0, 16) : 'me';
}

/**
 * Makes a file name safe to write: path separators, control characters, `..` and anything outside letters,
 * digits, `.`, `-`, `_` and spaces become `_`; leading dots and underscores are dropped; the name is capped at `maxLength`,
 * keeping its extension.
 *
 * @param name - The raw name, e.g. an attachment's.
 * @param maxLength - The longest result. Defaults to {@link MSGRAPH_CLI_MAIL_DUMP_MAX_FILE_NAME_LENGTH}.
 * @returns The safe name; `attachment` when nothing is left.
 */
export function sanitizeMsGraphCliFileName(name: Maybe<string>, maxLength = MSGRAPH_CLI_MAIL_DUMP_MAX_FILE_NAME_LENGTH): string {
  return sanitizeFileName(name, { mode: 'strict', maxLength, fallback: 'attachment' });
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
 * Reads the dump directory's manifest, or starts a new one. A manifest written for another mailbox,
 * folder or id type is refused: its ids and resume links would not match.
 *
 * @param config - The dump's directory, mailbox, folder and id type.
 * @returns The manifest.
 * @throws {CliError} `INVALID_ARGUMENT` when the manifest belongs to another dump.
 */
export async function readMsGraphCliMailDumpManifest(config: Pick<MsGraphCliMailDumpConfig, 'dir' | 'mailbox' | 'folder' | 'immutableIds'>): Promise<MsGraphCliMailDumpManifest> {
  let content: Maybe<string>;

  try {
    content = await readFile(join(config.dir, MSGRAPH_CLI_MAIL_DUMP_MANIFEST_FILE), 'utf8');
  } catch {
    // no manifest yet
  }

  let result = emptyMsGraphCliMailDumpManifest(config);

  if (content != null) {
    const existing = JSON.parse(content) as MsGraphCliMailDumpManifest;

    if (existing.version !== MSGRAPH_CLI_MAIL_DUMP_MANIFEST_VERSION || existing.mailbox !== result.mailbox || existing.folder !== result.folder || existing.immutableIds !== result.immutableIds) {
      throw new CliError({ message: `${config.dir} holds a dump of another mailbox, folder or id type.`, code: 'INVALID_ARGUMENT', suggestion: 'Dump into a new directory, or re-run with the --mailbox, --folder and --mutable-ids values that directory was created with.' });
    }

    result = { ...result, ...existing, messages: existing.messages ?? {}, removed: existing.removed ?? [] };
  }

  return result;
}

interface MsGraphCliMailDumpRun {
  written: number;
  skipped: number;
  removed: number;
  failed: number;
  bytes: number;
  attachmentBytes: number;
}

/**
 * Dumps a mail folder into a directory, incrementally: the first run walks a delta round from the start
 * (or `since`), and later runs resume from the stored `nextLink` / `deltaLink`, writing only new or changed
 * messages. Bodies are read 20 at a time through `$batch`. The manifest is saved after every page, and
 * before an error is rethrown, so a run stopped by a timeout or an outage resumes where it stopped.
 *
 * The directory is created with mode 0700 and each file with 0600. Nothing in the result is message content.
 *
 * @param config - The folder, directory and options.
 * @returns This run's counts.
 */
export async function dumpMsGraphCliMail(config: MsGraphCliMailDumpConfig): Promise<MsGraphCliMailDumpResult> {
  const { graphContext, dir, mailbox, immutableIds } = config;
  const now = config.now ?? (() => new Date());
  const progress = config.progress ?? (() => undefined);
  const deltaPage = listMessagesDeltaPage(graphContext);
  const readMessages = getMessages(graphContext);
  const readAttachments = listMessageAttachments(graphContext);

  await mkdir(dir, { recursive: true, mode: 0o700 });
  let manifest = await readMsGraphCliMailDumpManifest(config);
  const messages: Record<string, MsGraphCliMailDumpManifestEntry> = { ...manifest.messages };
  const removedEntries: MsGraphCliMailDumpRemovedEntry[] = [...manifest.removed];
  const run: MsGraphCliMailDumpRun = { written: 0, skipped: 0, removed: 0, failed: 0, bytes: 0, attachmentBytes: 0 };
  const filter = config.since && !manifest.nextLink && !manifest.deltaLink ? `receivedDateTime ge ${microsoftGraphDateTimeLiteral(config.since)}` : manifest.filter;

  async function writeDumpFile(relativePath: string, data: string | Uint8Array): Promise<void> {
    const path = join(dir, relativePath);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, data, { mode: 0o600 });
    run.bytes += typeof data === 'string' ? Buffer.byteLength(data) : data.length;
  }

  // streams a raw body to disk (0600, through a `.part` file), so a large .eml or attachment is never held in memory
  async function downloadDumpFile(relativePath: string, request: MicrosoftGraphRawRequestInput): Promise<number> {
    const path = join(dir, relativePath);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const { bytes } = await downloadMsGraphCliFile({ graphContext, request, out: path, idleTimeout: config.idleTimeout });
    run.bytes += bytes;
    return bytes;
  }

  async function writeAttachments(message: MicrosoftGraphMessage, file: string): Promise<void> {
    const page = await readAttachments({ mailbox, id: message.id });

    for (const attachment of page.value ?? []) {
      const size = attachment.size ?? 0;
      const isFile = !attachment['@odata.type'] || attachment['@odata.type'] === '#microsoft.graph.fileAttachment';

      if (!isFile) {
        continue;
      }

      if (config.maxBytes != null && run.attachmentBytes + size > config.maxBytes) {
        progress(`skipped an attachment of ${size} bytes: --max-bytes ${config.maxBytes} reached`);
        continue;
      }

      const relativePath = `${file}/attachments/${msGraphCliMailDumpHash8(attachment.id)}_${sanitizeMsGraphCliFileName(attachment.name)}`;
      run.attachmentBytes += await downloadDumpFile(relativePath, microsoftGraphGetMessageAttachmentContentRequest({ mailbox, id: message.id, attachmentId: attachment.id }));
    }
  }

  async function writeMessage(message: MicrosoftGraphMessage): Promise<void> {
    const file = msGraphCliMailDumpMessagePath(message);
    const previous = messages[message.id];

    if (previous && previous.file !== file) {
      await rm(join(dir, `${previous.file}.json`), { force: true });
    }

    await writeDumpFile(`${file}.json`, `${JSON.stringify(message, null, 2)}\n`);

    if (config.markdown) {
      await writeDumpFile(`${file}.md`, msGraphCliMailDumpMarkdown(message));
    }

    if (config.eml) {
      await downloadDumpFile(`${file}.eml`, microsoftGraphGetMessageMimeRequest({ mailbox, id: message.id }));
    }

    if (config.attachments && message.hasAttachments) {
      await writeAttachments(message, file);
    }

    messages[message.id] = { file, changeKey: message.changeKey };
    run.written += 1;
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
    await writeFile(join(dir, MSGRAPH_CLI_MAIL_DUMP_MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
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

        for (const item of read) {
          if (item.message) {
            await writeMessage(item.message);
          } else {
            run.failed += 1;
            progress(`could not read a message (${item.status} ${item.error?.code ?? ''})`);
          }
        }
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
    throw e;
  }

  return { dir, ...totals, complete };
}
