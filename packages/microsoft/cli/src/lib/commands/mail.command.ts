import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, type MicrosoftGraphGetMessagesItem, type MicrosoftGraphMailRequest, getMessage, getMessages, microsoftGraphGetMessageMimeRequest, microsoftGraphListMessagesRequest, microsoftGraphRequest, microsoftGraphRequestAllPages, microsoftGraphSearchMessagesRequest } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { msGraphCliMailboxOptions, msGraphCliPagingOptions, parseMsGraphCliDateOption, readMsGraphCliIdsOption } from '../util/option';
import { DEFAULT_MSGRAPH_CLI_MAIL_DUMP_MAX_MESSAGES, dumpMsGraphCliMail } from '../util/mail.dump';
import { downloadMsGraphCliFile, msGraphCliIdleTimeoutMs, msGraphCliIdleTimeoutOption } from '../util/file.download';
import { outputMsGraphCliResult } from '../util/output';
import { MAIL_AUTO_REPLY_COMMAND } from './mail.auto.reply.command';
import { MAIL_MAILBOXES_COMMAND } from './mail.mailboxes.command';
import { MAIL_WRITE_COMMANDS } from './mail.write.command';

/**
 * GETs a mail list or search: the first page (with its `@odata.nextLink`), or with `--all-pages` every
 * item as one array.
 *
 * @param graphContext - The Graph context.
 * @param request - The built request.
 * @param argv - The parsed arguments.
 * @param argv.allPages - Whether to follow `@odata.nextLink` and return every item.
 * @param argv.maxPages - With `allPages`: the most pages to read.
 * @returns The page or the items.
 */
async function requestMsGraphCliMailPages(graphContext: MicrosoftGraphContext, request: MicrosoftGraphMailRequest, argv: { readonly allPages?: boolean; readonly maxPages?: Maybe<number> }): Promise<unknown> {
  return argv.allPages ? microsoftGraphRequestAllPages(graphContext)({ ...request, maxPages: argv.maxPages }) : microsoftGraphRequest(graphContext)({ method: 'GET', ...request });
}

export const MAIL_LIST_COMMAND: CommandModule = {
  command: 'list',
  describe: 'List messages newest first, filtered by date, sender, read state and attachments ($filter)',
  builder: (yargs: Argv) =>
    msGraphCliPagingOptions(msGraphCliMailboxOptions(yargs))
      .option('folder', { type: 'string', describe: 'One mail folder by id or well-known name (inbox, sentitems, drafts, deleteditems). Default: every folder' })
      .option('since', { type: 'string', describe: 'Received at or after this date/instant (ISO 8601)' })
      .option('until', { type: 'string', describe: 'Received before this date/instant (ISO 8601)' })
      .option('from', { type: 'string', describe: "The sender's address" })
      .option('unread', { type: 'boolean', default: false, describe: 'Only unread messages' })
      .option('has-attachments', { type: 'boolean', default: false, describe: 'Only messages with file attachments' })
      .option('select', { type: 'string', describe: 'Comma-separated fields to return instead of the default set (e.g. id,subject,receivedDateTime)' })
      .option('top', { type: 'number', describe: 'Page size (default 25)' })
      .example([
        ['$0 mail list --folder inbox --unread --top 10', 'Ten newest unread inbox messages'],
        ['$0 mail list --since 2026-11-01 --from ada@example.com --all-pages --pick id,subject', 'Every message from ada since Nov 1, ids and subjects only']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const request = microsoftGraphListMessagesRequest({
      mailbox: argv.mailbox,
      immutableIds: !argv.mutableIds,
      folder: argv.folder,
      since: parseMsGraphCliDateOption('since', argv.since),
      until: parseMsGraphCliDateOption('until', argv.until),
      from: argv.from,
      unread: argv.unread,
      hasAttachments: argv.hasAttachments,
      select: argv.select,
      top: argv.top
    });

    outputMsGraphCliResult(await requestMsGraphCliMailPages(graphContext, request, argv));
  })
};

export const MAIL_SEARCH_COMMAND: CommandModule = {
  command: 'search <query>',
  describe: "Search the user's mail (Graph $search, KQL; results by relevance)",
  builder: (yargs: Argv) =>
    msGraphCliPagingOptions(msGraphCliMailboxOptions(yargs))
      .positional('query', { type: 'string', demandOption: true, describe: 'KQL search text, e.g. invoice, from:ada@example.com, subject:"weekly report", received>=2026-11-01' })
      .option('top', { type: 'number', describe: 'Page size (default 25)' })
      .option('folder', { type: 'string', describe: 'Limit to one mail folder by id or well-known name (e.g. inbox, sentitems)' })
      .option('select', { type: 'string', describe: 'Comma-separated fields to return instead of the default set' })
      .option('since', { type: 'string', hidden: true })
      .option('from', { type: 'string', hidden: true })
      .example([
        ['$0 mail search "invoice" --top 10', 'Ten messages matching "invoice"'],
        ['$0 mail search "from:ada@example.com received>=2026-11-01" --all-pages --max-pages 5', 'Up to five pages of matches']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    if (argv.since != null || argv.from != null) {
      // models: M-i — Graph rejects $search combined with $filter on messages
      throw new CliError({ message: 'mail search does not take --since or --from: Graph cannot combine $search with a filter.', code: 'INVALID_ARGUMENT', suggestion: 'Put them in the query as KQL (from:ada@example.com received>=2026-11-01), or use mail list --since … --from … to filter without searching.' });
    }

    const request = microsoftGraphSearchMessagesRequest({ query: argv.query, top: argv.top, folder: argv.folder, select: argv.select, mailbox: argv.mailbox, immutableIds: !argv.mutableIds });
    outputMsGraphCliResult(await requestMsGraphCliMailPages(graphContext, request, argv));
  })
};

/**
 * What `mail get --mime` prints: where the MIME was written and its size, never the content.
 */
export interface MsGraphCliMailMimeOutput {
  readonly id: string;
  readonly file: string;
  readonly bytes: number;
  readonly contentType?: string;
}

export const MAIL_GET_COMMAND: CommandModule = {
  command: 'get <id>',
  describe: 'Get one message with its body, or its MIME (.eml) to a file',
  builder: (yargs: Argv) =>
    msGraphCliIdleTimeoutOption(msGraphCliMailboxOptions(yargs))
      .positional('id', { type: 'string', demandOption: true, describe: 'The message id' })
      .option('format', { type: 'string', choices: ['text', 'html'] as const, default: 'text', describe: 'Body format' })
      .option('select', { type: 'string', describe: 'Comma-separated fields to return instead of the default set plus body' })
      .option('mime', { type: 'boolean', default: false, describe: 'Download the raw MIME message (RFC 822) to --out instead of reading the JSON message' })
      .option('out', { type: 'string', describe: 'With --mime: the file to write (e.g. message.eml), streamed to disk. Only the path and size are printed' })
      .example([
        ['$0 mail get AAMk... --format html', 'One message with an HTML body'],
        ['$0 mail get AAMk... --mime --out message.eml', 'Save the message as .eml']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    if (argv.mime) {
      if (!argv.out) {
        throw new CliError({ message: '--mime needs --out <file>: the MIME content is never printed.', code: 'INVALID_ARGUMENT', suggestion: 'e.g. --mime --out message.eml' });
      }

      const download = await downloadMsGraphCliFile({ graphContext, request: microsoftGraphGetMessageMimeRequest({ id: argv.id, mailbox: argv.mailbox }), out: argv.out, idleTimeout: msGraphCliIdleTimeoutMs(argv.idleTimeout) });
      const output: MsGraphCliMailMimeOutput = { id: argv.id, ...download };
      outputMsGraphCliResult(output);
    } else {
      outputMsGraphCliResult(await getMessage(graphContext)({ id: argv.id, format: argv.format, select: argv.select, mailbox: argv.mailbox, immutableIds: !argv.mutableIds }));
    }
  })
};

/**
 * Turns {@link getMessages} items into what `mail get-many` prints: each message as Graph returned it, or
 * `{ id, error }` for an id Graph could not read. Both carry `id`, so `--pick id,subject` works per item.
 *
 * @param items - The items, in id order.
 * @returns The printed items.
 */
export function msGraphCliGetManyOutput(items: readonly MicrosoftGraphGetMessagesItem[]): unknown[] {
  return items.map((item) => item.message ?? { id: item.id, error: { status: item.status, code: item.error?.code, message: item.error?.message } });
}

export const MAIL_GET_MANY_COMMAND: CommandModule = {
  command: 'get-many [ids..]',
  describe: 'Get several messages through $batch (20 per HTTP call), in the order given',
  builder: (yargs: Argv) =>
    msGraphCliMailboxOptions(yargs)
      .positional('ids', { type: 'string', array: true, describe: 'Message ids' })
      .option('ids-file', { type: 'string', describe: 'A file of message ids: one per line, or a JSON array' })
      .option('format', { type: 'string', choices: ['text', 'html'] as const, default: 'text', describe: 'Body format' })
      .option('select', { type: 'string', describe: 'Comma-separated fields to return instead of the default set plus body' })
      .example([
        ['$0 mail get-many AAMk1... AAMk2... --pick id,subject,body', 'Two messages'],
        ['$0 mail list --since 2026-11-01 --all-pages --pick id | jq -r ".data[].id" > ids.txt && $0 mail get-many --ids-file ids.txt', 'Every message since Nov 1, with bodies']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const ids = await readMsGraphCliIdsOption({ ids: argv.ids, idsFile: argv.idsFile });
    const items = await getMessages(graphContext)({ ids, format: argv.format, select: argv.select, mailbox: argv.mailbox, immutableIds: !argv.mutableIds });
    outputMsGraphCliResult(msGraphCliGetManyOutput(items));
  })
};

export const MAIL_DUMP_COMMAND: CommandModule = {
  command: 'dump',
  describe: 'Dump a mail folder to a directory, incrementally (delta): JSON + Markdown per message, optional .eml and attachments',
  builder: (yargs: Argv) =>
    msGraphCliMailboxOptions(yargs)
      .option('dir', { type: 'string', demandOption: true, describe: 'The dump directory (created with mode 0700). Re-running into it resumes from its manifest.json' })
      .option('folder', { type: 'string', default: 'inbox', describe: 'The mail folder by id or well-known name (inbox, sentitems, archive). Delta is per-folder' })
      .option('since', { type: 'string', describe: 'First run only: messages received at or after this date/instant (ISO 8601)' })
      .option('body-format', { type: 'string', choices: ['text', 'html'] as const, default: 'text', describe: 'Body format written to the .json / .md files' })
      .option('markdown', { type: 'boolean', default: true, describe: 'Also write a .md rendering of each message (--no-markdown to skip)' })
      .option('eml', { type: 'boolean', default: false, describe: 'Also write each message as .eml (MIME)' })
      .option('attachments', { type: 'boolean', default: false, describe: "Also write each message's file attachments" })
      .option('max-bytes', { type: 'number', describe: 'With --attachments: the most attachment bytes one run writes' })
      .option('prune', { type: 'boolean', default: false, describe: 'Delete the files of messages Graph reports removed (default: only record them in the manifest)' })
      .option('max-messages', { type: 'number', default: DEFAULT_MSGRAPH_CLI_MAIL_DUMP_MAX_MESSAGES, describe: 'The most messages one run processes; re-run to continue' })
      .example([
        ['$0 mail dump --dir ./mail --since 2026-10-01', 'Dump the inbox since Oct 1; re-run later to add only new or changed messages'],
        ['$0 mail dump --dir ./sent --folder sentitems --eml --attachments --max-bytes 50000000', 'Sent items with .eml files and up to 50 MB of attachments']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const result = await dumpMsGraphCliMail({
      graphContext,
      dir: argv.dir,
      mailbox: argv.mailbox,
      folder: argv.folder,
      since: parseMsGraphCliDateOption('since', argv.since),
      bodyFormat: argv.bodyFormat ?? 'text',
      markdown: argv.markdown ?? true,
      eml: argv.eml ?? false,
      attachments: argv.attachments ?? false,
      prune: argv.prune ?? false,
      maxMessages: argv.maxMessages ?? DEFAULT_MSGRAPH_CLI_MAIL_DUMP_MAX_MESSAGES,
      maxBytes: argv.maxBytes,
      immutableIds: !argv.mutableIds,
      progress: (line) => process.stderr.write(`${line}\n`)
    });

    outputMsGraphCliResult(result);
  })
};

/**
 * The `mail` command: reads (`list`, `search`, `get`, `get-many`, `dump`) and writes (`draft`, `send`,
 * `send-bulk`, `reply`, `forward`, `move`, `copy`, `delete`), `mailboxes check` for shared mailboxes, and
 * `auto-reply` for automatic replies.
 */
export const MAIL_COMMAND: CommandModule = {
  command: 'mail',
  describe: "Read and write the user's (or a shared mailbox's) Outlook mail",
  builder: (yargs: Argv) =>
    yargs
      .command(MAIL_LIST_COMMAND)
      .command(MAIL_SEARCH_COMMAND)
      .command(MAIL_GET_COMMAND)
      .command(MAIL_GET_MANY_COMMAND)
      .command(MAIL_DUMP_COMMAND)
      .command([...MAIL_WRITE_COMMANDS])
      .command(MAIL_MAILBOXES_COMMAND)
      .command(MAIL_AUTO_REPLY_COMMAND)
      .demandCommand(1, 'Please specify a mail subcommand.'),
  handler: () => undefined
};
