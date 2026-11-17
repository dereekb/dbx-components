import type { CommandModule, Argv } from 'yargs';
import { getDeskContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, ZOHO_DESK_PAGINATION_ADAPTER } from '../../util/pagination';
import { zohoDeskCreateTicketComment, zohoDeskDeleteTicketComment, zohoDeskGetTicketCommentById, zohoDeskGetTicketComments } from '@dereekb/zoho';

const commentsListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List comments on a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('sort-by', { type: 'string', describe: 'Sort field' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const initialInput = { ticketId: argv.ticketId, from: argv.from, limit: argv.limit, sortBy: argv.sortBy };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => zohoDeskGetTicketComments(deskContext)(input),
        adapter: ZOHO_DESK_PAGINATION_ADAPTER,
        multiplePages: argv.multiplePages,
        multiplePagesOutput: argv.multiplePagesOutput,
        dumpOutput: argv.dumpOutput,
        dumpMerge: argv.dumpMerge
      });
      if (outcome.handled === false) {
        const result = outcome.result;
        outputResult(result.data, { from: argv.from, limit: argv.limit, count: result.data?.length });
      }
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const commentsGetCommand: CommandModule = {
  command: 'get <ticketId> <commentId>',
  describe: 'Get a comment by ID',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).positional('commentId', { type: 'string', demandOption: true, describe: 'Comment ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskGetTicketCommentById(deskContext)({ ticketId: argv.ticketId, commentId: argv.commentId });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const commentsCreateCommand: CommandModule = {
  command: 'create <ticketId>',
  describe: 'Create a comment on a ticket',
  builder: (yargs: Argv) =>
    yargs
      .positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' })
      .option('content', { type: 'string', demandOption: true, describe: 'Comment content' })
      .option('public', { type: 'boolean', default: false, describe: 'Make comment public' })
      .option('content-type', { type: 'string', default: 'plainText', choices: ['plainText', 'html'] as const, describe: 'Content type' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskCreateTicketComment(deskContext)({ ticketId: argv.ticketId, content: argv.content, isPublic: argv.public, contentType: argv.contentType });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const commentsDeleteCommand: CommandModule = {
  command: 'delete <ticketId> <commentId>',
  describe: 'Delete a comment',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).positional('commentId', { type: 'string', demandOption: true, describe: 'Comment ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      await zohoDeskDeleteTicketComment(deskContext)({ ticketId: argv.ticketId, commentId: argv.commentId });
      outputResult({ deleted: true });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const DESK_COMMENTS_COMMAND: CommandModule = {
  command: 'comments',
  describe: 'Desk comment operations',
  builder: (yargs: Argv) => yargs.command(commentsListCommand).command(commentsGetCommand).command(commentsCreateCommand).command(commentsDeleteCommand).demandCommand(1),
  handler: noop
};
