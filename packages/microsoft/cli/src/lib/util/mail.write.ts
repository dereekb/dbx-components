import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphFileAttachmentInput, type MicrosoftGraphItemBody, type MicrosoftGraphMessageWriteResult, type MicrosoftGraphRequestInput, MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES, microsoftGraphPathWithQuery } from '@dereekb/microsoft';
import { type MicrosoftMailSignatureUserExternalConnectionData, USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY } from '@dereekb/firebase';
import { type EmailAddress, type Maybe, mimeTypeForFileExtension } from '@dereekb/util';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Argv } from 'yargs';
import { msGraphCliContentTypeForFile } from '../commands/request.command';
import { type MsGraphCliConfigFile, msGraphCliConfigStore, msGraphCliPaths } from '../config/cli.config';
import { type MsGraphCliConnectionSettings } from './connection.settings';

/**
 * The fields of a Graph request body whose addresses `--dry-run` replaces with a count.
 */
export const MSGRAPH_CLI_RECIPIENT_FIELDS: readonly string[] = ['toRecipients', 'ccRecipients', 'bccRecipients', 'replyTo'];

/**
 * The fields of a Graph request body whose single address `--dry-run` hides.
 */
export const MSGRAPH_CLI_ADDRESS_FIELDS: readonly string[] = ['from', 'sender'];

// MARK: Options
/**
 * Adds `--dry-run`, which every write command takes.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the option added.
 */
export function msGraphCliDryRunOptions<T>(yargs: Argv<T>) {
  return yargs.option('dry-run', { type: 'boolean', default: false, describe: 'Print the Graph calls (method, URL, body with recipients redacted to counts) and exit without sending' });
}

/**
 * Adds `--yes`, the gate on outward-facing or destructive commands.
 *
 * @param yargs - The command's yargs.
 * @param describe - The option's help text. Defaults to the mail wording.
 * @returns The yargs, with the option added.
 */
export function msGraphCliConfirmOptions<T>(yargs: Argv<T>, describe = 'Confirm the command: it sends mail or deletes, so it refuses to run without --yes') {
  return yargs.option('yes', { type: 'boolean', default: false, describe });
}

/**
 * Adds the options a new message's body takes: `--body` / `--body-file`, `--html` and the signature.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
export function msGraphCliBodyOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('body', { type: 'string', describe: 'The message body' })
    .option('body-file', { type: 'string', describe: 'Read the body from a file (.html / .htm is sent as HTML)' })
    .option('html', { type: 'boolean', default: false, describe: 'Send the body as HTML' })
    .option('signature-file', {
      type: 'string',
      describe:
        'Append this signature (.html / .htm as HTML with its local <img> files attached inline, else text). Default: the saved signature of the address sent as (msgraph-cli config set signature-file <file> [--mailbox <address>]), else the server default the app stores for that address (connection-data); a --mailbox / --send-as address without either gets none. Graph cannot read the Outlook signature'
    })
    .option('signature', { type: 'boolean', default: true, describe: 'Append the signature (--no-signature to skip)' });
}

/**
 * Adds the options a new message takes: recipients, subject, body, attachments and `--send-as`.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
export function msGraphCliComposeOptions<T>(yargs: Argv<T>) {
  return msGraphCliBodyOptions(yargs)
    .option('to', { type: 'string', array: true, describe: 'Recipient addresses (repeat, or comma-separated)' })
    .option('cc', { type: 'string', array: true, describe: 'Cc addresses (repeat, or comma-separated)' })
    .option('bcc', { type: 'string', array: true, describe: 'Bcc addresses (repeat, or comma-separated)' })
    .option('subject', { type: 'string', describe: 'The subject' })
    .option('attach', { type: 'string', array: true, describe: 'Files to attach (repeat). Over 3 MB: only on a draft (uploaded in a session, up to 150 MB)' })
    .option('send-as', { type: 'string', describe: 'Send as this address (sets `from`; needs Exchange Send As or Send on Behalf on it). The copy goes to your own Sent Items; use --mailbox to send from the shared mailbox itself' });
}

// MARK: Confirmation
/**
 * Refuses an outward-facing or destructive command that was not confirmed with `--yes`.
 *
 * @param input - The `--yes` value and what the command does, for the message.
 * @param input.yes - Whether `--yes` was passed.
 * @param input.action - What the command does, e.g. "send 1 message".
 * @throws {CliError} `CONFIRMATION_REQUIRED` without `--yes`.
 */
export function requireMsGraphCliConfirmation(input: { readonly yes?: Maybe<boolean>; readonly action: string }): void {
  if (!input.yes) {
    throw new CliError({ message: `Refusing to ${input.action} without --yes.`, code: 'CONFIRMATION_REQUIRED', suggestion: 'Re-run with --yes to confirm, or with --dry-run to print the Graph calls without running them.' });
  }
}

// MARK: Dry run
/**
 * One Graph call `--dry-run` prints.
 */
export interface MsGraphCliDryRunRequest {
  readonly method: string;
  /**
   * The path with its query, relative to the Graph version root.
   */
  readonly url: string;
  readonly headers?: Maybe<Record<string, string>>;
  readonly body?: unknown;
}

/**
 * What `--dry-run` prints.
 */
export interface MsGraphCliDryRunOutput {
  readonly dryRun: true;
  readonly requests: MsGraphCliDryRunRequest[];
  readonly note?: string;
  /**
   * What the preview could not resolve, e.g. `server defaults unavailable (<code>)` when the token source failed.
   */
  readonly warnings?: string[];
}

function countLabel(count: number, noun: string): string {
  return `[${count} ${noun}${count === 1 ? '' : 's'}]`;
}

/**
 * Copies a Graph request body with every recipient list replaced by its count, every single address
 * (`from`, `sender`) hidden, and attachment bytes replaced by their size.
 *
 * @param value - The body, or any value inside it.
 * @returns The redacted copy.
 */
export function msGraphCliRedactRecipients(value: unknown): unknown {
  let result: unknown = value;

  if (Array.isArray(value)) {
    result = value.map(msGraphCliRedactRecipients);
  } else if (value != null && typeof value === 'object') {
    const copy: Record<string, unknown> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, x]) => {
      if (MSGRAPH_CLI_RECIPIENT_FIELDS.includes(key) && Array.isArray(x)) {
        copy[key] = countLabel(x.length, 'recipient');
      } else if (MSGRAPH_CLI_ADDRESS_FIELDS.includes(key) && x != null) {
        copy[key] = '[1 address]';
      } else if (key === 'contentBytes' && typeof x === 'string') {
        copy[key] = `[${x.length} base64 chars]`;
      } else {
        copy[key] = msGraphCliRedactRecipients(x);
      }
    });

    result = copy;
  }

  return result;
}

/**
 * Builds what `--dry-run` prints for the Graph calls a command would make.
 *
 * @param requests - The requests, in order.
 * @param note - A line explaining anything the requests do not show.
 * @param warnings - What the preview could not resolve (e.g. the server defaults in a dry run).
 * @returns The output.
 */
export function msGraphCliDryRunOutput(requests: readonly MicrosoftGraphRequestInput[], note?: Maybe<string>, warnings?: Maybe<readonly string[]>): MsGraphCliDryRunOutput {
  return {
    dryRun: true,
    requests: requests.map((x) => ({
      method: x.method,
      url: microsoftGraphPathWithQuery(x.path, x.query),
      ...(x.headers ? { headers: x.headers } : {}),
      ...(x.body == null ? {} : { body: msGraphCliRedactRecipients(x.body) })
    })),
    ...(note ? { note } : {}),
    ...(warnings?.length ? { warnings: [...warnings] } : {})
  };
}

// MARK: Addresses and body
/**
 * Reads an address option: repeated values, each possibly comma- or semicolon-separated.
 *
 * @param name - The option name, for the error.
 * @param values - The raw option values.
 * @returns The addresses, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` when a value is not an address.
 */
export function parseMsGraphCliAddressesOption(name: string, values: unknown): Maybe<EmailAddress[]> {
  let result: Maybe<EmailAddress[]>;

  if (values != null) {
    const list = (Array.isArray(values) ? values : [values])
      .flatMap((x) => String(x).split(/[,;]/))
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    const invalid = list.find((x) => !/^[^\s@]+@[^\s@]+$/.test(x));

    if (invalid != null) {
      throw new CliError({ message: `--${name} "${invalid}" is not an email address.`, code: 'INVALID_ARGUMENT' });
    }

    result = list;
  }

  return result;
}

/**
 * Escapes text for HTML.
 *
 * @param text - The text.
 * @returns The escaped text.
 */
export function msGraphCliEscapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/**
 * Turns text into HTML: escaped, with line breaks kept.
 *
 * @param text - The text.
 * @returns The HTML.
 */
export function msGraphCliTextToHtml(text: string): string {
  return msGraphCliEscapeHtml(text).replaceAll(/\r?\n/g, '<br>');
}

/**
 * Turns simple HTML (a signature) into text: line-breaking tags become new lines, other tags are dropped and
 * the common entities decoded.
 *
 * @param html - The HTML.
 * @returns The text.
 */
export function msGraphCliHtmlToText(html: string): string {
  return html
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Returns whether a file is HTML by its extension.
 *
 * @param path - The file path.
 * @returns True for `.html` / `.htm`.
 */
export function isMsGraphCliHtmlFile(path: string): boolean {
  return /\.html?$/i.test(path);
}

/**
 * Reads a message body from `--body` or `--body-file`.
 *
 * @param input - The option values.
 * @param input.body - The body text.
 * @param input.bodyFile - A file holding the body; `.html` / `.htm` is HTML.
 * @param input.html - Whether the body is HTML.
 * @returns The body, or undefined when neither option is set.
 * @throws {CliError} `INVALID_ARGUMENT` when both are set.
 */
export async function readMsGraphCliBodyOption(input: { readonly body?: Maybe<string>; readonly bodyFile?: Maybe<string>; readonly html?: Maybe<boolean> }): Promise<Maybe<MicrosoftGraphItemBody>> {
  if (input.body != null && input.bodyFile != null) {
    throw new CliError({ message: 'Pass --body or --body-file, not both.', code: 'INVALID_ARGUMENT' });
  }

  let result: Maybe<MicrosoftGraphItemBody>;

  if (input.bodyFile != null) {
    result = { contentType: input.html || isMsGraphCliHtmlFile(input.bodyFile) ? 'html' : 'text', content: await readFile(input.bodyFile, 'utf8') };
  } else if (input.body != null) {
    result = { contentType: input.html ? 'html' : 'text', content: input.body };
  }

  return result;
}

/**
 * Reads files to attach.
 *
 * @param paths - The file paths.
 * @returns The attachments: name from the file name, content type from the extension.
 */
export async function readMsGraphCliAttachments(paths: Maybe<readonly unknown[]>): Promise<MicrosoftGraphFileAttachmentInput[]> {
  return Promise.all((paths ?? []).map(async (x) => ({ name: basename(String(x)), contentType: msGraphCliContentTypeForFile(String(x)), bytes: new Uint8Array(await readFile(String(x))) })));
}

/**
 * Splits attachments into those small enough to send inline and those that need an upload session.
 *
 * @param attachments - The attachments.
 * @returns The inline and large attachments.
 */
export function splitMsGraphCliAttachments(attachments: readonly MicrosoftGraphFileAttachmentInput[]): { readonly inline: MicrosoftGraphFileAttachmentInput[]; readonly large: MicrosoftGraphFileAttachmentInput[] } {
  const inline: MicrosoftGraphFileAttachmentInput[] = [];
  const large: MicrosoftGraphFileAttachmentInput[] = [];
  let inlineBytes = 0;

  attachments.forEach((x) => {
    // a POST carries at most 4 MB, so inline attachments together stay under the inline limit
    if (inlineBytes + x.bytes.length < MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES) {
      inline.push(x);
      inlineBytes += x.bytes.length;
    } else {
      large.push(x);
    }
  });

  return { inline, large };
}

// MARK: Signature
/**
 * A signature appended to new messages, replies and forwards.
 */
export interface MsGraphCliSignature {
  readonly content: string;
  readonly isHtml: boolean;
  /**
   * The local images an HTML signature shows, attached inline. The signature's `<img src>` values for them
   * are rewritten to `cid:<contentId>`.
   */
  readonly inlineImages?: Maybe<readonly MicrosoftGraphFileAttachmentInput[]>;
}

/**
 * The saved signature settings a send reads.
 */
export type MsGraphCliSignatureConfig = Pick<MsGraphCliConfigFile, 'signatureFile' | 'mailboxSignatureFiles'>;

/**
 * Returns the saved signature file for the address a message is sent as.
 *
 * Mail sent as another address (`--send-as`, else `--mailbox`) gets that address's signature from
 * `mailboxSignatureFiles` and never your own `signatureFile`, so a shared mailbox without one sends with
 * none. Mail from your own mailbox gets `signatureFile`.
 *
 * @param input - The sending address and the saved settings.
 * @param input.sender - The address the message is sent as, when not your own.
 * @param input.config - The saved signature settings.
 * @returns The signature file path, if one is saved for the sender.
 */
export function msGraphCliSignatureFileForSender(input: { readonly sender?: Maybe<string>; readonly config?: Maybe<MsGraphCliSignatureConfig> }): Maybe<string> {
  const sender = input.sender?.trim().toLowerCase();
  return sender ? input.config?.mailboxSignatureFiles?.[sender] : input.config?.signatureFile;
}

/**
 * Returns the server signature item for the address a message is sent as: the lowercased `sender`, else `me`
 * (your own mailbox). A shared-mailbox sender without its own item gets none: never `me`.
 *
 * @param input - The sending address and the server defaults.
 * @param input.sender - The address the message is sent as, when not your own.
 * @param input.settings - The server defaults from the token source.
 * @returns The item, if the server has one for the sender.
 */
export function msGraphCliServerSignatureForSender(input: { readonly sender?: Maybe<string>; readonly settings?: Maybe<MsGraphCliConnectionSettings> }): Maybe<MicrosoftMailSignatureUserExternalConnectionData> {
  const key = input.sender?.trim().toLowerCase() || USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY;
  return input.settings?.mail_signature?.[key];
}

/**
 * Turns a server signature item into a signature: `html` as HTML, `text` as text. Used as stored: no local
 * image embedding (there is no folder to resolve against), so web, `cid:` and `data:` image sources pass through.
 *
 * @param item - The server item.
 * @returns The signature, or undefined when the item has neither html nor text.
 */
export function msGraphCliSignatureFromServerItem(item: Maybe<MicrosoftMailSignatureUserExternalConnectionData>): Maybe<MsGraphCliSignature> {
  let result: Maybe<MsGraphCliSignature>;

  if (item?.html) {
    result = { content: item.html, isHtml: true };
  } else if (item?.text) {
    result = { content: item.text, isHtml: false };
  }

  return result;
}

/**
 * Input for {@link readMsGraphCliSignature}.
 */
export interface ReadMsGraphCliSignatureInput {
  /**
   * False with `--no-signature`.
   */
  readonly signature?: Maybe<boolean>;
  /**
   * The `--signature-file` path.
   */
  readonly signatureFile?: Maybe<string>;
  /**
   * The `--mailbox` the message is sent from.
   */
  readonly mailbox?: Maybe<string>;
  /**
   * The `--send-as` address.
   */
  readonly sendAs?: Maybe<string>;
  /**
   * The saved signature settings. Read from the config file when not given.
   */
  readonly config?: Maybe<MsGraphCliSignatureConfig>;
  /**
   * Reads the server defaults (see {@link msGraphCliServerSettingsGetter}). Called only when no flag or local file applies.
   */
  readonly serverSettings?: Maybe<() => Promise<Maybe<MsGraphCliConnectionSettings>>>;
}

/**
 * Reads the signature a command appends. The first that applies wins:
 *
 * 1. `--no-signature`: none.
 * 2. `--signature-file`.
 * 3. The saved local signature of the address the message is sent as (see {@link msGraphCliSignatureFileForSender}).
 * 4. The server default for that same address (see {@link msGraphCliServerSignatureForSender}).
 * 5. None.
 *
 * A shared-mailbox sender with no local file and no server item gets none, never your own.
 *
 * @param input - The option values, the saved settings and the server defaults getter.
 * @returns The signature, or undefined when none applies.
 */
export async function readMsGraphCliSignature(input: ReadMsGraphCliSignatureInput): Promise<Maybe<MsGraphCliSignature>> {
  let result: Maybe<MsGraphCliSignature>;

  if (input.signature !== false) {
    const sender = input.sendAs ?? input.mailbox;
    const path = input.signatureFile ?? msGraphCliSignatureFileForSender({ sender, config: input.config ?? (await msGraphCliConfigStore(msGraphCliPaths()).loadConfigFile()) });

    if (path) {
      result = await readMsGraphCliSignatureFile(path);
    } else if (input.serverSettings) {
      result = msGraphCliSignatureFromServerItem(msGraphCliServerSignatureForSender({ sender, settings: await input.serverSettings() }));
    }
  }

  return result;
}

/**
 * Reads a signature file: `.html` / `.htm` as HTML with its local images attached inline, anything else as text.
 *
 * @param path - The signature file.
 * @returns The signature.
 * @throws {CliError} `INVALID_ARGUMENT` when an image the HTML references cannot be read.
 */
export async function readMsGraphCliSignatureFile(path: string): Promise<MsGraphCliSignature> {
  const content = (await readFile(path, 'utf8')).trim();
  return isMsGraphCliHtmlFile(path) ? embedMsGraphCliSignatureImages({ html: content, baseDir: dirname(path) }) : { content, isHtml: false };
}

/**
 * Matches an `<img>` tag's quoted `src`: the text before the value, the quote, and the value.
 */
const MSGRAPH_CLI_IMG_SRC_REGEX = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi;

/**
 * Matches an image `src` that is not a local file: a web URL, a protocol-relative URL, `cid:` or `data:`.
 */
const MSGRAPH_CLI_REMOTE_IMG_SRC_REGEX = /^(?:https?:|cid:|data:|\/\/)/i;

/**
 * Returns the `<img src>` values of an HTML signature that point at local files: not a web URL, `cid:` or `data:`.
 *
 * @param html - The signature HTML.
 * @returns The local sources, in order.
 */
export function msGraphCliSignatureLocalImageSources(html: string): string[] {
  return Array.from(html.matchAll(MSGRAPH_CLI_IMG_SRC_REGEX), (match) => match[3].trim()).filter((src) => src && !MSGRAPH_CLI_REMOTE_IMG_SRC_REGEX.test(src));
}

/**
 * Attaches the local images an HTML signature shows inline, the way Outlook does.
 *
 * Every `<img src>` naming a local file (relative to `baseDir`, absolute, or a `file:` URL, as Outlook's
 * exported `<name>_files/image001.png` are) is read, attached with `isInline` and a content id, and its
 * `src` rewritten to `cid:<contentId>`. Web, `cid:` and `data:` images are left alone. A file referenced
 * twice is attached once.
 *
 * @param input - The signature HTML and the folder its relative image paths start from.
 * @param input.html - The signature HTML.
 * @param input.baseDir - The folder relative `src` values resolve against (the signature file's folder).
 * @returns The signature with the rewritten HTML and its inline images.
 * @throws {CliError} `INVALID_ARGUMENT` when an image cannot be read.
 */
export async function embedMsGraphCliSignatureImages(input: { readonly html: string; readonly baseDir: string }): Promise<MsGraphCliSignature> {
  const { html, baseDir } = input;
  const contentIdByPath = new Map<string, string>();
  const inlineImages: MicrosoftGraphFileAttachmentInput[] = [];

  for (const match of html.matchAll(MSGRAPH_CLI_IMG_SRC_REGEX)) {
    const src = match[3].trim();

    if (src && !MSGRAPH_CLI_REMOTE_IMG_SRC_REGEX.test(src)) {
      const path = msGraphCliSignatureImagePath(src, baseDir);

      if (!contentIdByPath.has(path)) {
        const bytes = await readFile(path).catch(() => {
          throw new CliError({ message: `The signature image "${src}" (${path}) cannot be read.`, code: 'INVALID_ARGUMENT', suggestion: 'Keep the images next to the signature file (relative src paths start from its folder), or use a web URL.' });
        });
        const name = basename(path);
        const contentId = `signature${inlineImages.length + 1}-${name.replaceAll(/[^\w.-]/g, '_')}`;
        contentIdByPath.set(path, contentId);
        inlineImages.push({ name, contentType: mimeTypeForFileExtension(extname(path).slice(1).toLowerCase()) ?? msGraphCliContentTypeForFile(path), bytes: new Uint8Array(bytes), isInline: true, contentId });
      }
    }
  }

  const content = html.replaceAll(MSGRAPH_CLI_IMG_SRC_REGEX, (...match: string[]) => {
    const [whole, prefix, quote, src] = match;
    const value = src.trim();
    const contentId = value && !MSGRAPH_CLI_REMOTE_IMG_SRC_REGEX.test(value) ? contentIdByPath.get(msGraphCliSignatureImagePath(value, baseDir)) : undefined;
    return contentId ? `${prefix}${quote}cid:${contentId}${quote}` : whole;
  });

  return { content, isHtml: true, inlineImages: inlineImages.length > 0 ? inlineImages : undefined };
}

/**
 * Resolves a local image `src` to a file path: a `file:` URL, or a path (URL-encoded, as `%20`, or not) against `baseDir`.
 *
 * @param src - The `src` value.
 * @param baseDir - The folder a relative path starts from.
 * @returns The absolute file path.
 */
function msGraphCliSignatureImagePath(src: string, baseDir: string): string {
  let result: string;

  if (/^file:/i.test(src)) {
    result = fileURLToPath(src);
  } else {
    let decoded = src;

    try {
      decoded = decodeURI(src);
    } catch {
      // keep a src that is not valid URI encoding as written
    }

    result = resolve(baseDir, decoded);
  }

  return result;
}

/**
 * Returns the signature images to attach with a body: the signature's inline images when the body it was
 * appended to is HTML. A text body carries the signature as text, so its images are dropped.
 *
 * @param body - The body after the signature was appended (for a reply or forward comment, an HTML body of the comment).
 * @param signature - The signature, if any.
 * @returns The inline attachments.
 */
export function msGraphCliSignatureAttachments(body: Maybe<MicrosoftGraphItemBody>, signature: Maybe<MsGraphCliSignature>): MicrosoftGraphFileAttachmentInput[] {
  return body?.contentType === 'html' && signature?.isHtml && signature.inlineImages ? [...signature.inlineImages] : [];
}

/**
 * Returns the signature as HTML.
 *
 * @param signature - The signature.
 * @returns The HTML.
 */
export function msGraphCliSignatureHtml(signature: MsGraphCliSignature): string {
  return signature.isHtml ? signature.content : msGraphCliTextToHtml(signature.content);
}

/**
 * Appends a signature to a body: as HTML to an HTML body, as text to a text body.
 *
 * @param body - The body. With none, the body is the signature alone.
 * @param signature - The signature, if any.
 * @returns The body with the signature.
 */
export function appendMsGraphCliSignature(body: Maybe<MicrosoftGraphItemBody>, signature: Maybe<MsGraphCliSignature>): Maybe<MicrosoftGraphItemBody> {
  let result = body;

  if (signature) {
    if (body == null) {
      result = signature.isHtml ? { contentType: 'html', content: signature.content } : { contentType: 'text', content: signature.content };
    } else if (body.contentType === 'html') {
      result = { contentType: 'html', content: `${body.content}<br><br>${msGraphCliSignatureHtml(signature)}` };
    } else {
      result = { contentType: 'text', content: `${body.content}\n\n${signature.isHtml ? msGraphCliHtmlToText(signature.content) : signature.content}` };
    }
  }

  return result;
}

/**
 * Appends a signature to a reply or forward `comment`, which Outlook places as HTML above the quoted
 * original (UNVERIFIED until live test B-reply).
 *
 * @param comment - The comment.
 * @param signature - The signature, if any.
 * @returns The comment with the signature.
 */
export function appendMsGraphCliSignatureToComment(comment: string, signature: Maybe<MsGraphCliSignature>): string {
  return signature ? `${comment}<br><br>${msGraphCliSignatureHtml(signature)}` : comment;
}

// MARK: Results
/**
 * One row of the per-id result table a move, copy or delete prints.
 */
export interface MsGraphCliWriteResultRow {
  readonly id: string;
  readonly ok: boolean;
  readonly status: number;
  /**
   * After a move or copy: the message's id at its destination.
   */
  readonly newId?: string;
  readonly code?: string;
  readonly message?: string;
}

/**
 * What a move, copy or delete prints: counts plus one row per id.
 */
export interface MsGraphCliWriteResultsOutput {
  readonly total: number;
  readonly ok: number;
  readonly failed: number;
  readonly results: MsGraphCliWriteResultRow[];
}

/**
 * Builds the per-id result table of a move, copy or delete.
 *
 * @param results - The per-id results.
 * @returns The output.
 */
export function msGraphCliWriteResultsOutput(results: readonly MicrosoftGraphMessageWriteResult[]): MsGraphCliWriteResultsOutput {
  const rows: MsGraphCliWriteResultRow[] = results.map((x) => {
    const ok = x.status >= 200 && x.status < 300;
    return { id: x.id, ok, status: x.status, ...(x.message?.id ? { newId: x.message.id } : {}), ...(x.error ? { code: x.error.code, ...(x.error.message ? { message: x.error.message } : {}) } : {}) };
  });

  const ok = rows.filter((x) => x.ok).length;
  return { total: rows.length, ok, failed: rows.length - ok, results: rows };
}
