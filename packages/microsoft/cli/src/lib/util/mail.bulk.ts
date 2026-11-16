import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, type MicrosoftGraphRequestInput, isMicrosoftGraphBatchResponseOk, microsoftGraphBatch, microsoftGraphBatchRequestItems, microsoftGraphSendMailRequest } from '@dereekb/microsoft';
import { type EmailAddress, type Maybe, type Milliseconds, MS_IN_MINUTE, waitForMs } from '@dereekb/util';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { appendMsGraphCliSignature, msGraphCliEscapeHtml, msGraphCliSignatureAttachments, parseMsGraphCliAddressesOption, type MsGraphCliSignature } from './mail.write';

/**
 * The most messages `mail send-bulk` sends per minute: Exchange Online's limit per mailbox.
 *
 * @see https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits#sending-limits
 */
export const MSGRAPH_CLI_BULK_MAX_PER_MINUTE = 30;

/**
 * The most rows `mail send-bulk` sends in one run unless `--limit` is given.
 */
export const MSGRAPH_CLI_BULK_MAX_ROWS_WITHOUT_LIMIT = 500;

/**
 * How many `sendMail` calls go in one `$batch`.
 */
export const MSGRAPH_CLI_BULK_BATCH_SIZE = 10;

export const MSGRAPH_CLI_BULK_PROGRESS_VERSION = 1;

/**
 * One row of a bulk recipients file: one message, to its own recipient set.
 */
export interface MsGraphCliBulkRow {
  /**
   * The row's position in the file, from 0.
   */
  readonly index: number;
  readonly to: EmailAddress[];
  readonly cc: EmailAddress[];
  /**
   * The template fields: every other column (CSV) or key (JSON), plus `to`.
   */
  readonly fields: Record<string, string>;
}

/**
 * Parses CSV text into rows of cells: quoted cells may hold commas, new lines and `""` escapes.
 *
 * @param content - The CSV text.
 * @returns The rows; blank lines dropped.
 */
export function parseMsGraphCliCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') {
        i += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((x) => x.some((c) => c.trim().length > 0));
}

function bulkRow(index: number, record: Record<string, unknown>): MsGraphCliBulkRow {
  const keys = Object.keys(record).map((x) => x.toLowerCase());

  if (keys.includes('bcc')) {
    throw new CliError({ message: `Row ${index + 1} has a bcc column. mail send-bulk sends one message per recipient set and never Bcc-blasts.`, code: 'INVALID_ARGUMENT', suggestion: 'Give each recipient their own row (to, optional cc).' });
  }

  const value = (name: string) => Object.entries(record).find(([key]) => key.toLowerCase() === name)?.[1];
  const list = (x: unknown) => (Array.isArray(x) ? x.join(';') : x);
  const to = parseMsGraphCliAddressesOption('to', list(value('to'))) ?? [];
  const cc = parseMsGraphCliAddressesOption('cc', list(value('cc'))) ?? [];

  if (to.length === 0) {
    throw new CliError({ message: `Row ${index + 1} has no "to" address.`, code: 'INVALID_ARGUMENT' });
  }

  const fields: Record<string, string> = {};
  Object.entries(record).forEach(([key, x]) => {
    if (x != null && typeof x !== 'object') {
      fields[key] = String(x);
    }
  });
  fields['to'] = to.join(', ');

  return { index, to, cc, fields };
}

/**
 * Parses a bulk recipients file: CSV with a header row and a `to` column, or a JSON array of objects with a
 * `to` (a string or an array). Several addresses in one cell are `;`-separated. Every other column or key
 * is a template field. A `bcc` column is refused.
 *
 * @param content - The file content.
 * @param format - `csv` or `json`.
 * @returns The rows, in file order.
 * @throws {CliError} `INVALID_ARGUMENT` for a row without `to`, a `bcc` column, or a malformed file.
 */
export function parseMsGraphCliBulkRecipients(content: string, format: 'csv' | 'json'): MsGraphCliBulkRow[] {
  let records: Record<string, unknown>[];

  if (format === 'json') {
    const parsed = JSON.parse(content) as unknown;

    if (!Array.isArray(parsed) || parsed.some((x) => x == null || typeof x !== 'object' || Array.isArray(x))) {
      throw new CliError({ message: 'The recipients JSON must be an array of objects, each with a "to".', code: 'INVALID_ARGUMENT' });
    }

    records = parsed as Record<string, unknown>[];
  } else {
    const [header, ...rows] = parseMsGraphCliCsv(content);
    const names = (header ?? []).map((x) => x.trim());

    if (!names.some((x) => x.toLowerCase() === 'to')) {
      throw new CliError({ message: 'The recipients CSV needs a header row with a "to" column.', code: 'INVALID_ARGUMENT' });
    }

    records = rows.map((cells) => Object.fromEntries(names.map((name, i) => [name, cells[i] ?? ''])));
  }

  return records.map((x, index) => bulkRow(index, x));
}

/**
 * Fills a template's `{{field}}` placeholders from a row's fields.
 *
 * @param template - The template text.
 * @param fields - The row's fields.
 * @param html - Whether the template is HTML, so field values are escaped.
 * @returns The filled text.
 * @throws {CliError} `INVALID_ARGUMENT` when a placeholder has no field, rather than sending it unfilled.
 */
export function renderMsGraphCliTemplate(template: string, fields: Record<string, string>, html: boolean): string {
  const missing = new Set<string>();
  const rendered = template.replaceAll(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, name: string) => {
    const value = fields[name];

    if (value == null) {
      missing.add(name);
    }

    return html ? msGraphCliEscapeHtml(value ?? '') : (value ?? '');
  });

  if (missing.size > 0) {
    throw new CliError({ message: `The template uses fields no row column provides: ${Array.from(missing).join(', ')}.`, code: 'INVALID_ARGUMENT', suggestion: 'Add the columns to the recipients file, or remove the placeholders.' });
  }

  return rendered;
}

/**
 * Identifies a row in the progress file: its position and recipients, so an edited file does not mark the
 * wrong row sent.
 *
 * @param row - The row.
 * @returns The key.
 */
export function msGraphCliBulkRowKey(row: Pick<MsGraphCliBulkRow, 'index' | 'to' | 'cc'>): string {
  return `${row.index}:${createHash('sha256')
    .update(JSON.stringify([row.to, row.cc]))
    .digest('hex')
    .slice(0, 12)}`;
}

// MARK: Pacing
/**
 * Holds sends to at most `maxPerWindow` within any `windowMs`.
 */
export interface MsGraphCliSendPacer {
  /**
   * Waits until `count` more sends fit in the window, then records them as sent now.
   */
  acquire(count: number): Promise<void>;
}

export interface MsGraphCliSendPacerConfig {
  readonly maxPerWindow: number;
  readonly windowMs: Milliseconds;
  /**
   * The clock. Defaults to `Date.now`; a spec passes a fake.
   */
  readonly now?: Maybe<() => number>;
  /**
   * Waits. Defaults to a real timer; a spec passes one that advances the fake clock.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
}

/**
 * Creates a sliding-window send pacer.
 *
 * @param config - The limit, window, clock and wait.
 * @returns The pacer.
 * @throws {Error} From `acquire` when `count` exceeds `maxPerWindow`.
 */
export function msGraphCliSendPacer(config: MsGraphCliSendPacerConfig): MsGraphCliSendPacer {
  const now = config.now ?? Date.now;
  const wait = config.wait ?? waitForMs;
  const sent: number[] = [];

  const prune = () => {
    const cutoff = now() - config.windowMs;

    while (sent.length > 0 && sent[0] <= cutoff) {
      sent.shift();
    }
  };

  return {
    acquire: async (count) => {
      if (count > config.maxPerWindow) {
        throw new Error(`Cannot send ${count} at once; the limit is ${config.maxPerWindow} per window.`);
      }

      prune();

      while (sent.length + count > config.maxPerWindow) {
        await wait(sent[sent.length + count - config.maxPerWindow - 1] + config.windowMs - now());
        prune();
      }

      const at = now();

      for (let i = 0; i < count; i += 1) {
        sent.push(at);
      }
    }
  };
}

// MARK: Progress
/**
 * The progress file of a bulk send. A re-run skips every row recorded here.
 */
export interface MsGraphCliBulkProgress {
  readonly version: number;
  readonly sent: Record<string, string>;
}

/**
 * Reads a bulk send's progress file, or starts a new one.
 *
 * @param path - The progress file.
 * @returns The progress.
 */
export async function readMsGraphCliBulkProgress(path: string): Promise<MsGraphCliBulkProgress> {
  let result: MsGraphCliBulkProgress = { version: MSGRAPH_CLI_BULK_PROGRESS_VERSION, sent: {} };

  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as MsGraphCliBulkProgress;
    result = { version: MSGRAPH_CLI_BULK_PROGRESS_VERSION, sent: parsed.sent ?? {} };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new CliError({ message: `The progress file "${path}" cannot be read: ${(e as Error).message}`, code: 'INVALID_ARGUMENT', suggestion: 'Fix or move the file; it records which rows were already sent.' });
    }
  }

  return result;
}

// MARK: Send
export interface MsGraphCliBulkMessageTemplate {
  readonly subject: string;
  readonly body: string;
  readonly html: boolean;
  readonly signature?: Maybe<MsGraphCliSignature>;
  readonly mailbox?: Maybe<EmailAddress>;
  readonly sendAs?: Maybe<EmailAddress>;
  readonly saveToSentItems?: Maybe<boolean>;
}

/**
 * Builds the `sendMail` request for one row: the subject and body filled from its fields, one message to
 * its own recipients.
 *
 * @param template - The subject and body templates and the send options.
 * @param row - The row.
 * @returns The request.
 */
export function msGraphCliBulkSendMailRequest(template: MsGraphCliBulkMessageTemplate, row: MsGraphCliBulkRow): MicrosoftGraphRequestInput {
  const body = appendMsGraphCliSignature({ contentType: template.html ? 'html' : 'text', content: renderMsGraphCliTemplate(template.body, row.fields, template.html) }, template.signature);
  const attachments = msGraphCliSignatureAttachments(body, template.signature);

  return microsoftGraphSendMailRequest({
    mailbox: template.mailbox,
    saveToSentItems: template.saveToSentItems,
    message: { subject: renderMsGraphCliTemplate(template.subject, row.fields, false), body, to: row.to, cc: row.cc.length > 0 ? row.cc : undefined, from: template.sendAs, attachments: attachments.length > 0 ? attachments : undefined }
  });
}

/**
 * What one bulk run will do, before it sends.
 */
export interface MsGraphCliBulkPlan {
  readonly rows: number;
  readonly alreadySent: number;
  /**
   * The rows this run sends, each with its request.
   */
  readonly toSend: readonly { readonly row: MsGraphCliBulkRow; readonly request: MicrosoftGraphRequestInput }[];
  /**
   * Rows left for a later run because of `--limit`.
   */
  readonly deferred: number;
}

/**
 * Works out which rows a bulk run sends and builds every request up front, so a template error stops the
 * run before the first message goes out.
 *
 * @param input - The rows, progress, template and limit.
 * @param input.rows - Every row of the file.
 * @param input.progress - The rows already sent.
 * @param input.template - The message template.
 * @param input.limit - The most rows to send this run.
 * @returns The plan.
 * @throws {CliError} `TOO_MANY_RECIPIENTS` when more than {@link MSGRAPH_CLI_BULK_MAX_ROWS_WITHOUT_LIMIT} rows are left and no limit is given.
 */
export function planMsGraphCliBulkSend(input: { readonly rows: readonly MsGraphCliBulkRow[]; readonly progress: MsGraphCliBulkProgress; readonly template: MsGraphCliBulkMessageTemplate; readonly limit?: Maybe<number> }): MsGraphCliBulkPlan {
  const pending = input.rows.filter((x) => input.progress.sent[msGraphCliBulkRowKey(x)] == null);

  if (input.limit == null && pending.length > MSGRAPH_CLI_BULK_MAX_ROWS_WITHOUT_LIMIT) {
    throw new CliError({
      message: `${pending.length} messages are left to send; one run sends at most ${MSGRAPH_CLI_BULK_MAX_ROWS_WITHOUT_LIMIT} unless --limit is given.`,
      code: 'TOO_MANY_RECIPIENTS',
      suggestion: `Pass --limit <n> to send n this run (at ${MSGRAPH_CLI_BULK_MAX_PER_MINUTE}/min); re-run with the same --progress-file to continue. Exchange Online allows 10,000 recipients a day.`
    });
  }

  const chosen = input.limit == null ? pending : pending.slice(0, Math.max(0, input.limit));
  const toSend = chosen.map((row) => ({ row, request: msGraphCliBulkSendMailRequest(input.template, row) }));
  return { rows: input.rows.length, alreadySent: input.rows.length - pending.length, toSend, deferred: pending.length - chosen.length };
}

/**
 * One row a bulk run could not send.
 */
export interface MsGraphCliBulkFailure {
  readonly row: number;
  readonly status: number;
  readonly code?: string;
  readonly message?: string;
}

/**
 * What `mail send-bulk` prints: counts and the failed rows (by row number), never addresses or content.
 */
export interface MsGraphCliBulkResult {
  readonly rows: number;
  readonly alreadySent: number;
  readonly sent: number;
  readonly failed: number;
  /**
   * Rows not sent yet: failed, or deferred by `--limit`. A re-run with the same progress file sends them.
   */
  readonly remaining: number;
  readonly progressFile: string;
  readonly failures: MsGraphCliBulkFailure[];
}

export interface SendMsGraphCliBulkMailInput {
  readonly graphContext: MicrosoftGraphContext;
  readonly plan: MsGraphCliBulkPlan;
  readonly progress: MsGraphCliBulkProgress;
  readonly progressFile: string;
  /**
   * Holds the run to {@link MSGRAPH_CLI_BULK_MAX_PER_MINUTE}. Defaults to a real-time pacer.
   */
  readonly pacer?: Maybe<MsGraphCliSendPacer>;
  /**
   * Waits between `$batch` retries of throttled items. Defaults to a real timer.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
  readonly batchSize?: Maybe<number>;
  /**
   * Called after each batch with a progress line (stderr in the command).
   */
  readonly onProgress?: Maybe<(line: string) => void>;
  /**
   * The clock the progress file's timestamps use. Defaults to `Date.now`.
   */
  readonly now?: Maybe<() => number>;
}

/**
 * Sends a planned bulk run: `$batch`es of `sendMail`, paced to {@link MSGRAPH_CLI_BULK_MAX_PER_MINUTE}, the
 * progress file written after every batch so an interrupted run resumes where it stopped.
 *
 * @param input - The plan, progress, pacing and Graph context.
 * @returns The counts and failed rows.
 */
export async function sendMsGraphCliBulkMail(input: SendMsGraphCliBulkMailInput): Promise<MsGraphCliBulkResult> {
  const batch = microsoftGraphBatch(input.graphContext);
  const now = input.now ?? Date.now;
  const pacer = input.pacer ?? msGraphCliSendPacer({ maxPerWindow: MSGRAPH_CLI_BULK_MAX_PER_MINUTE, windowMs: MS_IN_MINUTE, now });
  const batchSize = Math.min(input.batchSize ?? MSGRAPH_CLI_BULK_BATCH_SIZE, MSGRAPH_CLI_BULK_MAX_PER_MINUTE);
  const sentKeys: Record<string, string> = { ...input.progress.sent };
  const failures: MsGraphCliBulkFailure[] = [];
  let sent = 0;

  for (let i = 0; i < input.plan.toSend.length; i += batchSize) {
    const chunk = input.plan.toSend.slice(i, i + batchSize);
    await pacer.acquire(chunk.length);
    const { responses } = await batch<{ readonly error?: { readonly code?: string; readonly message?: string } }>({ requests: microsoftGraphBatchRequestItems(chunk.map((x) => x.request)), wait: input.wait });
    const at = new Date(now()).toISOString();

    responses.forEach((response, index) => {
      const { row } = chunk[index];

      if (isMicrosoftGraphBatchResponseOk(response)) {
        sentKeys[msGraphCliBulkRowKey(row)] = at;
        sent += 1;
      } else {
        failures.push({ row: row.index + 1, status: response.status, ...(response.body?.error?.code ? { code: response.body.error.code } : {}), ...(response.body?.error?.message ? { message: response.body.error.message } : {}) });
      }
    });

    const progress: MsGraphCliBulkProgress = { version: MSGRAPH_CLI_BULK_PROGRESS_VERSION, sent: sentKeys };
    await writeFile(input.progressFile, JSON.stringify(progress, null, 2), { mode: 0o600 });
    input.onProgress?.(`mail send-bulk: ${sent} sent, ${failures.length} failed, ${input.plan.toSend.length - i - chunk.length} left this run`);
  }

  return { rows: input.plan.rows, alreadySent: input.plan.alreadySent, sent, failed: failures.length, remaining: input.plan.deferred + failures.length, progressFile: input.progressFile, failures };
}
