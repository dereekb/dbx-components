import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphFileAttachmentInput, type MicrosoftGraphItemBody, type MicrosoftGraphMessageWriteResult, type MicrosoftGraphRequestInput, MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES, microsoftGraphPathWithQuery } from '@dereekb/microsoft';
import { type EmailAddress, type Maybe } from '@dereekb/util';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Argv } from 'yargs';
import { msGraphCliContentTypeForFile } from '../commands/request.command';
import { msGraphCliConfigStore, msGraphCliPaths } from '../config/cli.config';

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
    .option('signature-file', { type: 'string', describe: 'Append this signature (.html / .htm as HTML, else text). Default: the saved signature-file (msgraph-cli config set signature-file <file>). Graph cannot read the Outlook signature' })
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
 * @returns The output.
 */
export function msGraphCliDryRunOutput(requests: readonly MicrosoftGraphRequestInput[], note?: Maybe<string>): MsGraphCliDryRunOutput {
  return {
    dryRun: true,
    requests: requests.map((x) => ({
      method: x.method,
      url: microsoftGraphPathWithQuery(x.path, x.query),
      ...(x.headers ? { headers: x.headers } : {}),
      ...(x.body == null ? {} : { body: msGraphCliRedactRecipients(x.body) })
    })),
    ...(note ? { note } : {})
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
}

/**
 * Reads the signature a command appends: `--signature-file`, else the saved `signature-file`, unless
 * `--no-signature`.
 *
 * @param input - The option values.
 * @param input.signature - False with `--no-signature`.
 * @param input.signatureFile - The `--signature-file` path.
 * @param input.configSignatureFile - The saved default. Read from the config file when not given.
 * @returns The signature, or undefined when none applies.
 */
export async function readMsGraphCliSignature(input: { readonly signature?: Maybe<boolean>; readonly signatureFile?: Maybe<string>; readonly configSignatureFile?: Maybe<string> }): Promise<Maybe<MsGraphCliSignature>> {
  let result: Maybe<MsGraphCliSignature>;

  if (input.signature !== false) {
    const path = input.signatureFile ?? input.configSignatureFile ?? (await msGraphCliConfigStore(msGraphCliPaths()).loadConfigFile())?.signatureFile;

    if (path) {
      result = { content: (await readFile(path, 'utf8')).trim(), isHtml: isMsGraphCliHtmlFile(path) };
    }
  }

  return result;
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
