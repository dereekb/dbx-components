import {
  type MicrosoftGraphChat,
  type MicrosoftGraphChatMessageSearchResource,
  type MicrosoftGraphChatType,
  type MicrosoftGraphContext,
  type MicrosoftGraphItemBody,
  type MicrosoftGraphRequestInput,
  type MicrosoftGraphSearchResponse,
  MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_MAX_SIZE,
  MICROSOFT_GRAPH_SEARCH_MAX_RESULTS,
  microsoftGraphChannelFilesFolderRequest,
  microsoftGraphChannelMessagesRequest,
  microsoftGraphChatMatches,
  microsoftGraphChatMessageSearchRequest,
  microsoftGraphChatMessagesRequest,
  microsoftGraphChatsRequest,
  microsoftGraphJoinedTeamsRequest,
  microsoftGraphPresenceRequest,
  microsoftGraphRequest,
  microsoftGraphRequestAllPages,
  microsoftGraphSendChannelMessageRequest,
  microsoftGraphSendChatMessageRequest,
  microsoftGraphSoftDeleteChannelMessageRequest,
  microsoftGraphSoftDeleteChatMessageRequest,
  microsoftGraphTeamChannelsRequest,
  microsoftGraphUpdateChannelMessageRequest,
  microsoftGraphUpdateChatMessageRequest,
  readMicrosoftGraphSearchResponsePage
} from '@dereekb/microsoft';
import { CliError, cliConcurrencyOption, cliConcurrencyValue, withCliInterruptSignal, wrapCommandHandler } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCliPaths } from '../config/cli.config';
import { type MsGraphCliContext } from '../context/cli.context';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { MSGRAPH_CLI_TEAMS_CHANNEL_DELETE_ADMIN_CONSENT, MSGRAPH_CLI_TEAMS_CHANNEL_EDIT_ADMIN_CONSENT, MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT, MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT, msGraphCliAdminConsentTag, runMsGraphCliAdminConsentCall } from '../util/admin.consent';
import { parseMsGraphCliDateOption } from '../util/option';
import { parseMsGraphCliEnumOption } from '../util/auto.reply';
import { msGraphCliConfirmOptions, msGraphCliDryRunOptions, msGraphCliDryRunOutput, requireMsGraphCliConfirmation } from '../util/mail.write';
import { msGraphCliIdleTimeoutMs, msGraphCliIdleTimeoutOption } from '../util/file.download';
import { outputMsGraphCliResult } from '../util/output';
import { DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_LOOKBACK_DAYS, DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_MAX_MESSAGES, MSGRAPH_CLI_TEAMS_CHAT_DUMP_CONCURRENCY, dumpMsGraphCliTeamsChats } from '../util/teams.chat.dump';
import { DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_SEARCH_TOP, type MsGraphCliTeamsChatSearchHit, msGraphCliTeamsChatSearchHitFromGraph, searchMsGraphCliTeamsChatDump } from '../util/teams.chat.search';
import { MSGRAPH_CLI_TEAMS_TERMS_NOTE, awaitMsGraphCliTeamsSendSlot, msGraphCliChatOutput, parseMsGraphCliTeamsWithNames, readMsGraphCliTeamsBody } from '../util/teams';

const CHAT_TYPES: readonly MicrosoftGraphChatType[] = ['oneOnOne', 'group', 'meeting'];

/**
 * How many chat pages `teams chats` reads (50 chats each) before matching.
 */
export const DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_MAX_PAGES = 10;

function get(graphContext: MicrosoftGraphContext, request: MicrosoftGraphRequestInput): Promise<unknown> {
  return microsoftGraphRequest(graphContext)(request);
}

function bodyOptions<T>(yargs: Argv<T>) {
  return msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), `Confirm the send: it posts to Teams. ${MSGRAPH_CLI_TEAMS_TERMS_NOTE}`)
    .option('text', { type: 'string', describe: 'The message as plain text' })
    .option('html', { type: 'string', describe: 'The message as HTML' })
    .option('file', { type: 'string', describe: 'Read the message from a file (.html / .htm as HTML)' });
}

interface SendTeamsMessageInput {
  readonly argv: any;
  readonly graphContext: MicrosoftGraphContext;
  /**
   * Builds the request from the body.
   */
  readonly build: (body: MicrosoftGraphItemBody) => MicrosoftGraphRequestInput;
  /**
   * What the send does, for the confirmation message.
   */
  readonly action: string;
}

/**
 * Sends one Teams message after `--yes` and the 1-per-second gate, or prints it on `--dry-run`.
 *
 * @param input - The options, Graph context, request builder and action.
 * @param input.argv - The parsed options.
 * @param input.graphContext - The Graph context.
 * @param input.build - Builds the request from the body.
 * @param input.action - What the send does, for the confirmation message.
 */
async function sendTeamsMessage({ argv, graphContext, build, action }: SendTeamsMessageInput): Promise<void> {
  const request = build(await readMsGraphCliTeamsBody({ text: argv.text, html: argv.html, file: argv.file }));

  if (argv.dryRun) {
    outputMsGraphCliResult(msGraphCliDryRunOutput([request]));
  } else {
    requireMsGraphCliConfirmation({ yes: argv.yes, action });
    await awaitMsGraphCliTeamsSendSlot({ configDir: msGraphCliPaths().configDir });
    const message = (await get(graphContext, request)) as { readonly id?: string; readonly createdDateTime?: string; readonly webUrl?: string };
    outputMsGraphCliResult({ sent: true, id: message?.id, createdDateTime: message?.createdDateTime, webUrl: message?.webUrl });
  }
}

function editBodyOptions<T>(yargs: Argv<T>) {
  return msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), 'Confirm the edit: everyone in the conversation sees the new text, marked Edited')
    .option('text', { type: 'string', describe: 'The new message as plain text' })
    .option('html', { type: 'string', describe: 'The new message as HTML' })
    .option('file', { type: 'string', describe: 'Read the new message from a file (.html / .htm as HTML)' });
}

interface EditTeamsMessageInput {
  readonly argv: any;
  readonly graphContext: MicrosoftGraphContext;
  /**
   * Builds the PATCH from the new body.
   */
  readonly build: (body: MicrosoftGraphItemBody) => MicrosoftGraphRequestInput;
  /**
   * What the edit does, for the confirmation message.
   */
  readonly action: string;
  /**
   * Sends the PATCH; a channel edit wraps it in its admin-consent check.
   */
  readonly run?: Maybe<(request: MicrosoftGraphRequestInput) => Promise<unknown>>;
}

/**
 * What `teams chat edit` and `teams channel edit` print. Graph answers 204, so only the id comes back.
 */
export interface MsGraphCliTeamsEditOutput {
  readonly id: string;
  readonly edited: true;
}

/**
 * Edits one of the user's Teams messages after `--yes` and the 1-per-second gate, or prints the PATCH on `--dry-run`.
 * The new body replaces the old one whole.
 *
 * @param input - The options, Graph context, request builder, action and runner.
 * @param input.argv - The parsed options.
 * @param input.graphContext - The Graph context.
 * @param input.build - Builds the PATCH from the new body.
 * @param input.action - What the edit does, for the confirmation message.
 * @param input.run - Sends the PATCH. Defaults to a plain Graph call.
 */
async function editTeamsMessage({ argv, graphContext, build, action, run }: EditTeamsMessageInput): Promise<void> {
  const request = build(await readMsGraphCliTeamsBody({ text: argv.text, html: argv.html, file: argv.file }));

  if (argv.dryRun) {
    outputMsGraphCliResult(msGraphCliDryRunOutput([request], 'The new body replaces the old one whole: @mentions and inline images of the original are not kept.'));
  } else {
    requireMsGraphCliConfirmation({ yes: argv.yes, action });
    await awaitMsGraphCliTeamsSendSlot({ configDir: msGraphCliPaths().configDir });
    await (run ?? ((x: MicrosoftGraphRequestInput) => get(graphContext, x)))(request);
    const output: MsGraphCliTeamsEditOutput = { id: String(argv.message), edited: true };
    outputMsGraphCliResult(output);
  }
}

// MARK: Reads
export const TEAMS_LIST_COMMAND: CommandModule = {
  command: 'list',
  describe: 'List the teams you belong to',
  handler: msGraphCommandHandler(async (_argv, { graphContext }) => outputMsGraphCliResult(await get(graphContext, microsoftGraphJoinedTeamsRequest())))
};

export const TEAMS_CHANNELS_COMMAND: CommandModule = {
  command: 'channels <team>',
  describe: "List a team's channels",
  builder: (yargs: Argv) => yargs.positional('team', { type: 'string', demandOption: true, describe: 'The team id' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => outputMsGraphCliResult(await get(graphContext, microsoftGraphTeamChannelsRequest(String(argv.team)))))
};

export const TEAMS_CHATS_COMMAND: CommandModule = {
  command: 'chats',
  describe: 'List your chats, matched locally by member names (--with), topic or type. Only matching chats are printed',
  builder: (yargs: Argv) =>
    yargs
      .option('with', { type: 'string', array: true, describe: 'Member names or addresses that must all be in the chat (repeat, or comma-separated; case-insensitive substring)' })
      .option('topic', { type: 'string', describe: 'A substring of the chat topic' })
      .option('type', { type: 'string', describe: `${CHAT_TYPES.join(' | ')}` })
      .option('max-pages', { type: 'number', describe: `Chat pages of 50 to read before matching (default ${DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_MAX_PAGES})` })
      .example([['$0 teams chats --with "Ada Lovelace" --type oneOnOne', 'Find your 1:1 chat with Ada']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const filter = { withNames: parseMsGraphCliTeamsWithNames(argv.with), topic: argv.topic, chatType: parseMsGraphCliEnumOption('type', argv.type, CHAT_TYPES) };
    const chats = await microsoftGraphRequestAllPages(graphContext)<MicrosoftGraphChat>({ ...microsoftGraphChatsRequest(), maxPages: argv.maxPages ?? DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_MAX_PAGES });
    // non-matching chats (and their members) are never printed
    outputMsGraphCliResult(chats.filter((x) => microsoftGraphChatMatches(x, filter)).map(msGraphCliChatOutput));
  })
};

export const TEAMS_PRESENCE_COMMAND: CommandModule = {
  command: 'presence',
  describe: 'Show your presence, or --user for another user (Presence.Read / Presence.Read.All)',
  builder: (yargs: Argv) => yargs.option('user', { type: 'string', describe: "Another user's id or UPN" }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => outputMsGraphCliResult(await get(graphContext, microsoftGraphPresenceRequest(argv.user))))
};

export const TEAMS_FILES_COMMAND: CommandModule = {
  command: 'files <team> <channel>',
  describe: "Show a channel's files folder; pass its parentReference.driveId to the files commands as --drive",
  builder: (yargs: Argv) => yargs.positional('team', { type: 'string', demandOption: true, describe: 'The team id' }).positional('channel', { type: 'string', demandOption: true, describe: 'The channel id' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => outputMsGraphCliResult(await get(graphContext, microsoftGraphChannelFilesFolderRequest(String(argv.team), String(argv.channel)))))
};

// MARK: Chat
export const TEAMS_CHAT_MESSAGES_COMMAND: CommandModule = {
  command: 'messages <chat>',
  describe: "List a chat's messages, newest first",
  builder: (yargs: Argv) =>
    yargs
      .positional('chat', { type: 'string', demandOption: true, describe: 'The chat id' })
      .option('since', { type: 'string', describe: 'Only messages created after this ISO 8601 date/time. Graph filters on lastModifiedDateTime but returns edits, deletes and reactions to older messages only sometimes, so this is not a change feed' })
      .option('top', { type: 'number', describe: 'Messages to return (at most 50)' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputMsGraphCliResult(await get(graphContext, microsoftGraphChatMessagesRequest({ chatId: String(argv.chat), since: parseMsGraphCliDateOption('since', argv.since)?.toISOString(), top: argv.top })));
  })
};

export const TEAMS_CHAT_SEND_COMMAND: CommandModule = {
  command: 'send <chat>',
  describe: `Send a chat message. Needs --yes. ${MSGRAPH_CLI_TEAMS_TERMS_NOTE}`,
  builder: (yargs: Argv) => bodyOptions(yargs).positional('chat', { type: 'string', demandOption: true, describe: 'The chat id' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => sendTeamsMessage({ argv, graphContext, build: (body) => microsoftGraphSendChatMessageRequest({ chatId: String(argv.chat), body }), action: 'send a Teams chat message' }))
};

export const TEAMS_CHAT_EDIT_COMMAND: CommandModule = {
  command: 'edit <chat> <message>',
  describe: 'Edit one of your chat messages: replace its text (Chat.ReadWrite; only the sender can edit). Needs --yes',
  builder: (yargs: Argv) =>
    editBodyOptions(yargs)
      .positional('chat', { type: 'string', demandOption: true, describe: 'The chat id' })
      .positional('message', { type: 'string', demandOption: true, describe: 'The message id (from teams chat messages)' })
      .example([
        ['$0 teams chat edit 19:abc@thread.v2 1731900000000 --text "Corrected: the call is at 3 pm." --yes', 'Replace the text of one of your messages'],
        ['$0 teams chat edit 19:abc@thread.v2 1731900000000 --html "<p>Updated <b>agenda</b></p>" --dry-run', 'Print the PATCH without sending it']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => editTeamsMessage({ argv, graphContext, build: (body) => microsoftGraphUpdateChatMessageRequest({ chatId: String(argv.chat), messageId: String(argv.message), body }), action: 'edit the Teams chat message' }))
};

export const TEAMS_CHAT_DELETE_COMMAND: CommandModule = {
  command: 'delete <chat> <message>',
  describe: 'Soft-delete one of your chat messages (--undo restores it). Needs --yes',
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), 'Confirm the delete')
      .positional('chat', { type: 'string', demandOption: true, describe: 'The chat id' })
      .positional('message', { type: 'string', demandOption: true, describe: 'The message id' })
      .option('undo', { type: 'boolean', default: false, describe: 'Restore a soft-deleted message (undoSoftDelete)' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const input = { chatId: String(argv.chat), messageId: String(argv.message), undo: argv.undo };
    const request = microsoftGraphSoftDeleteChatMessageRequest(input);

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([request]));
    } else {
      requireMsGraphCliConfirmation({ yes: argv.yes, action: argv.undo ? 'restore the chat message' : 'delete the chat message' });
      await get(graphContext, request);
      outputMsGraphCliResult({ id: input.messageId, ...(argv.undo ? { restored: true } : { deleted: true }) });
    }
  })
};

export const TEAMS_CHAT_DUMP_COMMAND: CommandModule = {
  command: 'dump [chat]',
  describe: 'Archive chats to a directory, incrementally: JSON + Markdown per message, inline images, optional file attachments. Pick one chat, --all-chats, or --with/--topic/--type',
  builder: (yargs: Argv) =>
    cliConcurrencyOption(msGraphCliIdleTimeoutOption(yargs), MSGRAPH_CLI_TEAMS_CHAT_DUMP_CONCURRENCY)
      .positional('chat', { type: 'string', describe: 'One chat id (teams chats lists them)' })
      .option('dir', { type: 'string', demandOption: true, describe: 'The dump directory (created with mode 0700). Re-running into it continues from its manifests' })
      .option('all-chats', { type: 'boolean', describe: 'Every chat you are in' })
      .option('with', { type: 'string', array: true, describe: 'Chats whose members include all these names or addresses (repeat, or comma-separated; case-insensitive substring)' })
      .option('topic', { type: 'string', describe: 'Chats whose topic contains this (case-insensitive)' })
      .option('type', { type: 'string', describe: `Chats of this type: ${CHAT_TYPES.join(' | ')}` })
      .option('since', { type: 'string', describe: 'Skip messages created before this ISO 8601 date/time. Stored by the first run; later runs inherit it' })
      .option('lookback', { type: 'number', default: DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_LOOKBACK_DAYS, describe: 'Days before now each re-run re-reads for edits, deletes and reactions (0: new messages only)' })
      .option('max-messages', { type: 'number', default: DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_MAX_MESSAGES, describe: 'The most messages one run writes (unchanged ones do not count); re-run to continue' })
      .option('max-bytes', { type: 'number', describe: 'The most bytes one run writes; re-run to continue' })
      .option('markdown', { type: 'boolean', default: true, describe: 'Also write a .md rendering of each message (--no-markdown to skip)' })
      .option('hosted-contents', { type: 'boolean', default: true, describe: 'Also download inline images (--no-hosted-contents to skip)' })
      .option('attachments', { type: 'boolean', default: false, describe: 'Also download file attachments (SharePoint / OneDrive links; Files.Read.All)' })
      .option('prune', { type: 'boolean', default: false, describe: "Delete a soft-deleted message's files (default: keep them and mark the message deleted)" })
      .example([
        ['$0 teams chat dump <chat> --dir ./ada', 'Archive one chat; re-run later to add only new or changed messages'],
        ['$0 teams chat dump --all-chats --dir ./teams', 'Archive every chat, 5000 messages per run'],
        ['$0 teams chat dump --with "Ada" --type oneOnOne --dir ./ada --attachments', 'Your 1:1 chat with Ada, with its file attachments']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext, tokenSource }) => {
    const concurrency = cliConcurrencyValue(argv.concurrency, MSGRAPH_CLI_TEAMS_CHAT_DUMP_CONCURRENCY);
    const chatType = parseMsGraphCliEnumOption('type', argv.type, CHAT_TYPES);
    const withNames = parseMsGraphCliTeamsWithNames(argv.with);
    const since = parseMsGraphCliDateOption('since', argv.since);
    // Ctrl+C stops the run with finished messages kept and the manifests saved (ABORTED); re-run to continue
    const result = await withCliInterruptSignal((signal) =>
      dumpMsGraphCliTeamsChats({
        graphContext,
        tokenSource,
        signal,
        concurrency,
        dir: argv.dir,
        chatId: argv.chat,
        allChats: argv.allChats,
        withNames,
        topic: argv.topic,
        chatType,
        since,
        lookbackDays: argv.lookback ?? DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_LOOKBACK_DAYS,
        markdown: argv.markdown ?? true,
        hostedContents: argv.hostedContents ?? true,
        attachments: argv.attachments ?? false,
        prune: argv.prune ?? false,
        maxMessages: argv.maxMessages ?? DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_MAX_MESSAGES,
        maxBytes: argv.maxBytes,
        idleTimeout: msGraphCliIdleTimeoutMs(argv.idleTimeout),
        progress: (line) => process.stderr.write(`${line}\n`)
      })
    );

    outputMsGraphCliResult(result);
  })
};

/**
 * How many result pages `teams chat search --all-pages` reads by default (25 results each).
 */
export const DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_SEARCH_MAX_PAGES = 10;

/**
 * The options only an archive search (`--dir`) reads, by argv key and flag.
 */
const TEAMS_CHAT_SEARCH_ARCHIVE_OPTIONS: readonly (readonly [string, string])[] = [
  ['chat', '--chat'],
  ['with', '--with'],
  ['topic', '--topic'],
  ['type', '--type'],
  ['from', '--from'],
  ['since', '--since'],
  ['until', '--until'],
  ['regex', '--regex'],
  ['caseSensitive', '--case-sensitive'],
  ['deleted', '--no-deleted']
];

/**
 * The options only a Graph search reads.
 */
const TEAMS_CHAT_SEARCH_GRAPH_OPTIONS: readonly (readonly [string, string])[] = [
  ['offset', '--offset'],
  ['allPages', '--all-pages'],
  ['maxPages', '--max-pages']
];

interface RefuseTeamsChatSearchOptionsInput {
  readonly argv: any;
  /**
   * The options this mode does not take, by argv key and flag.
   */
  readonly options: readonly (readonly [string, string])[];
  readonly message: string;
  readonly suggestion: string;
}

function refuseTeamsChatSearchOptions({ argv, options, message, suggestion }: RefuseTeamsChatSearchOptionsInput): void {
  // --deleted defaults to true, so only --no-deleted counts as given
  const given = options.filter(([key]) => argv[key] != null && !(key === 'deleted' && argv[key] === true)).map(([, flag]) => flag);

  if (given.length > 0) {
    throw new CliError({ message: `${message}: ${given.join(', ')}.`, code: 'INVALID_ARGUMENT', suggestion });
  }
}

async function searchTeamsChatsThroughGraph(argv: any, { graphContext, tokenSource }: MsGraphCliContext): Promise<void> {
  refuseTeamsChatSearchOptions({ argv, options: TEAMS_CHAT_SEARCH_ARCHIVE_OPTIONS, message: 'A Graph search takes its filters as KQL, not', suggestion: 'Put them in the query (from:ada sent>=2026-11-01 IsMentioned:true), or search a teams chat dump with --dir, where these options apply.' });
  const size = Math.min(argv.top ?? MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_MAX_SIZE, MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_MAX_SIZE);
  const maxPages = argv.allPages ? (argv.maxPages ?? DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_SEARCH_MAX_PAGES) : 1;
  const hits: MsGraphCliTeamsChatSearchHit[] = [];
  let offset = Math.max(0, argv.offset ?? 0);
  let more = true;
  let pages = 0;

  await runMsGraphCliAdminConsentCall({
    tokenSource,
    requirement: MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT,
    run: async () => {
      while (more && pages < maxPages && offset < MICROSOFT_GRAPH_SEARCH_MAX_RESULTS) {
        const response = (await get(graphContext, microsoftGraphChatMessageSearchRequest({ queryString: String(argv.query), from: offset, size }))) as MicrosoftGraphSearchResponse<MicrosoftGraphChatMessageSearchResource>;
        const page = readMicrosoftGraphSearchResponsePage(response);
        hits.push(...page.hits.map(msGraphCliTeamsChatSearchHitFromGraph));
        offset += page.hits.length;
        more = page.moreResultsAvailable && page.hits.length > 0;
        pages += 1;
      }
    }
  });

  outputMsGraphCliResult({ hits, moreResultsAvailable: more, ...(more ? { nextOffset: offset } : undefined) });
}

async function searchTeamsChatDump(argv: any): Promise<void> {
  refuseTeamsChatSearchOptions({ argv, options: TEAMS_CHAT_SEARCH_GRAPH_OPTIONS, message: 'An archive search (--dir) returns every match newest first, so it does not take', suggestion: 'Use --top to return more hits.' });
  const result = await searchMsGraphCliTeamsChatDump({
    dir: String(argv.dir),
    query: String(argv.query ?? ''),
    regex: argv.regex,
    caseSensitive: argv.caseSensitive,
    chatId: argv.chat,
    withNames: parseMsGraphCliTeamsWithNames(argv.with),
    topic: argv.topic,
    chatType: parseMsGraphCliEnumOption('type', argv.type, CHAT_TYPES),
    from: argv.from,
    since: parseMsGraphCliDateOption('since', argv.since),
    until: parseMsGraphCliDateOption('until', argv.until),
    includeDeleted: argv.deleted ?? true,
    top: argv.top
  });

  outputMsGraphCliResult(result);
}

const searchTeamsChatsThroughGraphHandler = msGraphCommandHandler(searchTeamsChatsThroughGraph);
const searchTeamsChatDumpHandler = wrapCommandHandler(searchTeamsChatDump);

/**
 * `teams chat search`: Graph's Teams message search (KQL; organization admin consent), or with `--dir` a search of a
 * `teams chat dump` archive on disk, which needs no token or scope.
 */
export const TEAMS_CHAT_SEARCH_COMMAND: CommandModule = {
  command: 'search <query>',
  describe: `Search Teams messages through Graph (KQL, by relevance) ${msGraphCliAdminConsentTag(MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT)}, or with --dir search a teams chat dump on disk (no Graph call, any preset)`,
  builder: (yargs: Argv) =>
    yargs
      .positional('query', { type: 'string', demandOption: true, describe: 'Graph: KQL, e.g. budget from:ada sent>=2026-11-01 IsMentioned:true. --dir: words that must all appear ("quoted phrase" kept together; "" matches every message), or a regular expression with --regex' })
      .option('dir', { type: 'string', describe: 'Search this teams chat dump directory instead of Graph' })
      .option('top', { type: 'number', describe: `Graph: results per page (at most ${MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_MAX_SIZE}). --dir: the most hits, newest first (default ${DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_SEARCH_TOP})` })
      .option('offset', { type: 'number', describe: 'Graph: the 0-based result to start at (a previous nextOffset)' })
      .option('all-pages', { type: 'boolean', describe: `Graph: read pages until no more results (Graph pages through at most ${MICROSOFT_GRAPH_SEARCH_MAX_RESULTS})` })
      .option('max-pages', { type: 'number', describe: `Graph: with --all-pages, the most pages to read (default ${DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_SEARCH_MAX_PAGES})` })
      .option('chat', { type: 'string', describe: '--dir: only this chat id' })
      .option('with', { type: 'string', array: true, describe: '--dir: only chats whose members include all these names or addresses (repeat, or comma-separated)' })
      .option('topic', { type: 'string', describe: '--dir: only chats whose topic contains this' })
      .option('type', { type: 'string', describe: `--dir: only chats of this type: ${CHAT_TYPES.join(' | ')}` })
      .option('from', { type: 'string', describe: "--dir: only messages whose sender's name contains this (Graph: put from:<name> in the KQL)" })
      .option('since', { type: 'string', describe: '--dir: only messages created at or after this ISO 8601 date/time (Graph: sent>=<date> in the KQL)' })
      .option('until', { type: 'string', describe: '--dir: only messages created before this ISO 8601 date/time' })
      .option('regex', { type: 'boolean', describe: '--dir: the query is a JavaScript regular expression' })
      .option('case-sensitive', { type: 'boolean', describe: '--dir: match case' })
      .option('deleted', { type: 'boolean', describe: '--dir: also search messages deleted after they were archived (default; --no-deleted skips them)' })
      .example([
        ['$0 teams chat search "budget from:ada sent>=2026-11-01"', 'Graph search; needs a connection a tenant admin consented with ChannelMessage.Read.All'],
        ['$0 teams chat search "quarterly budget" --dir ./teams --with Ada --since 2026-01-01', 'Search an archive made by teams chat dump; no Graph call'],
        [String.raw`$0 teams chat search "invoice #\d+" --regex --dir ./teams --top 200`, 'A regular expression over the whole archive']
      ]),
  handler: (argv: any) => (argv.dir == null ? searchTeamsChatsThroughGraphHandler(argv) : searchTeamsChatDumpHandler(argv))
};

/**
 * Whether a run is `teams chat search --dir`, which searches files on disk and needs no token source.
 *
 * @param argv - The parsed arguments.
 * @param argv._ - The command path, e.g. `['teams', 'chat', 'search']`.
 * @param argv.dir - The `--dir` option.
 * @returns True for an archive search.
 */
export function isMsGraphCliTeamsChatArchiveSearch(argv: { readonly _?: Maybe<readonly (string | number)[]>; readonly dir?: unknown }): boolean {
  const [a, b, c] = argv._ ?? [];
  return a === 'teams' && b === 'chat' && c === 'search' && argv.dir != null;
}

const TEAMS_CHAT_COMMAND: CommandModule = {
  command: 'chat',
  describe: 'Read, search, archive, send and delete chat messages',
  builder: (yargs: Argv) => yargs.command(TEAMS_CHAT_MESSAGES_COMMAND).command(TEAMS_CHAT_SEARCH_COMMAND).command(TEAMS_CHAT_DUMP_COMMAND).command(TEAMS_CHAT_SEND_COMMAND).command(TEAMS_CHAT_EDIT_COMMAND).command(TEAMS_CHAT_DELETE_COMMAND).demandCommand(1, 'Please specify a chat subcommand.'),
  handler: () => undefined
};

// MARK: Channel
function channelPositionals<T>(yargs: Argv<T>) {
  return yargs.positional('team', { type: 'string', demandOption: true, describe: 'The team id' }).positional('channel', { type: 'string', demandOption: true, describe: 'The channel id' });
}

export const TEAMS_CHANNEL_SEND_COMMAND: CommandModule = {
  command: 'send <team> <channel>',
  describe: `Post to a channel (ChannelMessage.Send). Needs --yes. ${MSGRAPH_CLI_TEAMS_TERMS_NOTE}`,
  builder: (yargs: Argv) => channelPositionals(bodyOptions(yargs)),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => sendTeamsMessage({ argv, graphContext, build: (body) => microsoftGraphSendChannelMessageRequest({ teamId: String(argv.team), channelId: String(argv.channel), body }), action: 'post to a Teams channel' }))
};

export const TEAMS_CHANNEL_REPLY_COMMAND: CommandModule = {
  command: 'reply <team> <channel> <message>',
  describe: `Reply to a channel message (ChannelMessage.Send). Needs --yes. ${MSGRAPH_CLI_TEAMS_TERMS_NOTE}`,
  builder: (yargs: Argv) => channelPositionals(bodyOptions(yargs)).positional('message', { type: 'string', demandOption: true, describe: 'The message replied to' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => sendTeamsMessage({ argv, graphContext, build: (body) => microsoftGraphSendChannelMessageRequest({ teamId: String(argv.team), channelId: String(argv.channel), replyToId: String(argv.message), body }), action: 'reply in a Teams channel' }))
};

export const TEAMS_CHANNEL_MESSAGES_COMMAND: CommandModule = {
  command: 'messages <team> <channel>',
  describe: `List a channel's messages. ${msGraphCliAdminConsentTag(MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT)} Neither the Read nor the Read + Write preset grants it, even for your own posts`,
  builder: (yargs: Argv) => channelPositionals(yargs).option('replies', { type: 'boolean', default: false, describe: "Include each message's replies" }).option('top', { type: 'number', describe: 'Messages to return (at most 50)' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext, tokenSource }) => {
    const request = microsoftGraphChannelMessagesRequest({ teamId: String(argv.team), channelId: String(argv.channel), top: argv.top, replies: argv.replies });
    outputMsGraphCliResult(await runMsGraphCliAdminConsentCall({ tokenSource, requirement: MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT, run: () => get(graphContext, request) }));
  })
};

export const TEAMS_CHANNEL_DELETE_COMMAND: CommandModule = {
  command: 'delete <team> <channel> <message>',
  describe: `Soft-delete a channel message. ${msGraphCliAdminConsentTag(MSGRAPH_CLI_TEAMS_CHANNEL_DELETE_ADMIN_CONSENT)} Neither the Read nor the Read + Write preset grants it, even for your own post. Needs --yes`,
  builder: (yargs: Argv) => channelPositionals(msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), 'Confirm the delete')).positional('message', { type: 'string', demandOption: true, describe: 'The message id' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext, tokenSource }) => {
    const request = microsoftGraphSoftDeleteChannelMessageRequest({ teamId: String(argv.team), channelId: String(argv.channel), messageId: String(argv.message) });

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([request]));
    } else {
      requireMsGraphCliConfirmation({ yes: argv.yes, action: 'delete the channel message' });
      await runMsGraphCliAdminConsentCall({ tokenSource, requirement: MSGRAPH_CLI_TEAMS_CHANNEL_DELETE_ADMIN_CONSENT, run: () => get(graphContext, request) });
      outputMsGraphCliResult({ id: String(argv.message), deleted: true });
    }
  })
};

export const TEAMS_CHANNEL_EDIT_COMMAND: CommandModule = {
  command: 'edit <team> <channel> <message>',
  describe: `Edit one of your channel messages, or a reply with --reply-to <parent>. ${msGraphCliAdminConsentTag(MSGRAPH_CLI_TEAMS_CHANNEL_EDIT_ADMIN_CONSENT)} Neither the Read nor the Read + Write preset grants it, even for your own post. Needs --yes`,
  builder: (yargs: Argv) =>
    channelPositionals(editBodyOptions(yargs))
      .positional('message', { type: 'string', demandOption: true, describe: 'The message (or reply) id' })
      .option('reply-to', { type: 'string', describe: 'The parent message id, when <message> is a reply' })
      .example([['$0 teams channel edit <team> <channel> <message> --text "Fixed the link." --yes', 'Replace the text of one of your posts']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext, tokenSource }) =>
    editTeamsMessage({
      argv,
      graphContext,
      build: (body) => microsoftGraphUpdateChannelMessageRequest({ teamId: String(argv.team), channelId: String(argv.channel), messageId: String(argv.message), replyToId: argv.replyTo, body }),
      action: 'edit the channel message',
      run: (request) => runMsGraphCliAdminConsentCall({ tokenSource, requirement: MSGRAPH_CLI_TEAMS_CHANNEL_EDIT_ADMIN_CONSENT, run: () => get(graphContext, request) })
    })
  )
};

const TEAMS_CHANNEL_COMMAND: CommandModule = {
  command: 'channel',
  describe: 'Post and reply in channels; read, edit and delete channel messages (admin consent only)',
  builder: (yargs: Argv) => yargs.command(TEAMS_CHANNEL_SEND_COMMAND).command(TEAMS_CHANNEL_REPLY_COMMAND).command(TEAMS_CHANNEL_MESSAGES_COMMAND).command(TEAMS_CHANNEL_EDIT_COMMAND).command(TEAMS_CHANNEL_DELETE_COMMAND).demandCommand(1, 'Please specify a channel subcommand.'),
  handler: () => undefined
};

/**
 * The `teams` command: teams, channels, chats, presence and channel files; chat and channel messages.
 */
export const TEAMS_COMMAND: CommandModule = {
  command: 'teams',
  describe: `Read Teams and send, edit and delete chat and channel messages. ${MSGRAPH_CLI_TEAMS_TERMS_NOTE}`,
  builder: (yargs: Argv) => yargs.command(TEAMS_LIST_COMMAND).command(TEAMS_CHANNELS_COMMAND).command(TEAMS_CHATS_COMMAND).command(TEAMS_PRESENCE_COMMAND).command(TEAMS_FILES_COMMAND).command(TEAMS_CHAT_COMMAND).command(TEAMS_CHANNEL_COMMAND).demandCommand(1, 'Please specify a teams subcommand.'),
  handler: () => undefined
};
