import {
  type MicrosoftGraphChat,
  type MicrosoftGraphChatType,
  type MicrosoftGraphContext,
  type MicrosoftGraphItemBody,
  type MicrosoftGraphRequestInput,
  MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE,
  MICROSOFT_GRAPH_CHANNEL_MESSAGE_WRITE_SCOPE,
  microsoftGraphChannelFilesFolderRequest,
  microsoftGraphChannelMessagesRequest,
  microsoftGraphChatMatches,
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
  microsoftGraphTeamChannelsRequest
} from '@dereekb/microsoft';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCliPaths } from '../config/cli.config';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { parseMsGraphCliDateOption } from '../util/option';
import { parseMsGraphCliEnumOption } from '../util/auto.reply';
import { msGraphCliConfirmOptions, msGraphCliDryRunOptions, msGraphCliDryRunOutput, requireMsGraphCliConfirmation } from '../util/mail.write';
import { outputMsGraphCliResult } from '../util/output';
import { MSGRAPH_CLI_TEAMS_TERMS_NOTE, awaitMsGraphCliTeamsSendSlot, msGraphCliChatOutput, readMsGraphCliTeamsBody, runMsGraphCliTeamsAdminCall } from '../util/teams';

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
    const withNames = ((argv.with ?? []) as unknown[])
      .flatMap((x) => String(x).split(','))
      .map((x) => x.trim())
      .filter(Boolean);
    const filter = { withNames, topic: argv.topic, chatType: parseMsGraphCliEnumOption('type', argv.type, CHAT_TYPES) };
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
  describe: "List a chat's messages, newest change first",
  builder: (yargs: Argv) => yargs.positional('chat', { type: 'string', demandOption: true, describe: 'The chat id' }).option('since', { type: 'string', describe: 'Only messages changed after this ISO 8601 date/time' }).option('top', { type: 'number', describe: 'Messages to return (at most 50)' }),
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

const TEAMS_CHAT_COMMAND: CommandModule = {
  command: 'chat',
  describe: 'Read, send and delete chat messages',
  builder: (yargs: Argv) => yargs.command(TEAMS_CHAT_MESSAGES_COMMAND).command(TEAMS_CHAT_SEND_COMMAND).command(TEAMS_CHAT_DELETE_COMMAND).demandCommand(1, 'Please specify a chat subcommand.'),
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
  describe: `List a channel's messages. Admin preset only: needs ${MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE} (admin consent), even for your own posts`,
  builder: (yargs: Argv) => channelPositionals(yargs).option('replies', { type: 'boolean', default: false, describe: "Include each message's replies" }).option('top', { type: 'number', describe: 'Messages to return (at most 50)' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const request = microsoftGraphChannelMessagesRequest({ teamId: String(argv.team), channelId: String(argv.channel), top: argv.top, replies: argv.replies });
    outputMsGraphCliResult(await runMsGraphCliTeamsAdminCall(MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE, () => get(graphContext, request)));
  })
};

export const TEAMS_CHANNEL_DELETE_COMMAND: CommandModule = {
  command: 'delete <team> <channel> <message>',
  describe: `Soft-delete a channel message. Admin preset only: needs ${MICROSOFT_GRAPH_CHANNEL_MESSAGE_WRITE_SCOPE} (admin consent), even for your own post. Needs --yes`,
  builder: (yargs: Argv) => channelPositionals(msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), 'Confirm the delete')).positional('message', { type: 'string', demandOption: true, describe: 'The message id' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const request = microsoftGraphSoftDeleteChannelMessageRequest({ teamId: String(argv.team), channelId: String(argv.channel), messageId: String(argv.message) });

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([request]));
    } else {
      requireMsGraphCliConfirmation({ yes: argv.yes, action: 'delete the channel message' });
      await runMsGraphCliTeamsAdminCall(MICROSOFT_GRAPH_CHANNEL_MESSAGE_WRITE_SCOPE, () => get(graphContext, request));
      outputMsGraphCliResult({ id: String(argv.message), deleted: true });
    }
  })
};

const TEAMS_CHANNEL_COMMAND: CommandModule = {
  command: 'channel',
  describe: 'Post and reply in channels; read and delete channel messages (Admin preset)',
  builder: (yargs: Argv) => yargs.command(TEAMS_CHANNEL_SEND_COMMAND).command(TEAMS_CHANNEL_REPLY_COMMAND).command(TEAMS_CHANNEL_MESSAGES_COMMAND).command(TEAMS_CHANNEL_DELETE_COMMAND).demandCommand(1, 'Please specify a channel subcommand.'),
  handler: () => undefined
};

/**
 * The `teams` command: teams, channels, chats, presence and channel files; chat and channel messages.
 */
export const TEAMS_COMMAND: CommandModule = {
  command: 'teams',
  describe: `Read Teams and send chat and channel messages. ${MSGRAPH_CLI_TEAMS_TERMS_NOTE}`,
  builder: (yargs: Argv) => yargs.command(TEAMS_LIST_COMMAND).command(TEAMS_CHANNELS_COMMAND).command(TEAMS_CHATS_COMMAND).command(TEAMS_PRESENCE_COMMAND).command(TEAMS_FILES_COMMAND).command(TEAMS_CHAT_COMMAND).command(TEAMS_CHANNEL_COMMAND).demandCommand(1, 'Please specify a teams subcommand.'),
  handler: () => undefined
};
