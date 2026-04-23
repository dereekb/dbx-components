import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';

const commentsListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List comments on a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('sort-by', { type: 'string', describe: 'Sort field' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketComments({ ticketId: argv.ticketId, from: argv.from, limit: argv.limit, sortBy: argv.sortBy });
      outputResult(result.data, { from: argv.from, limit: argv.limit, count: result.data?.length });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const commentsGetCommand: CommandModule = {
  command: 'get <ticketId> <commentId>',
  describe: 'Get a comment by ID',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).positional('commentId', { type: 'string', demandOption: true, describe: 'Comment ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketCommentById({ ticketId: argv.ticketId, commentId: argv.commentId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
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
      const api = getDeskApi(argv);
      const result = await api.createTicketComment({ ticketId: argv.ticketId, content: argv.content, isPublic: argv.public, contentType: argv.contentType });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const commentsDeleteCommand: CommandModule = {
  command: 'delete <ticketId> <commentId>',
  describe: 'Delete a comment',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).positional('commentId', { type: 'string', demandOption: true, describe: 'Comment ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      await api.deleteTicketComment({ ticketId: argv.ticketId, commentId: argv.commentId });
      outputResult({ deleted: true });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskCommentsCommand: CommandModule = {
  command: 'comments',
  describe: 'Desk comment operations',
  builder: (yargs: Argv) => yargs.command(commentsListCommand).command(commentsGetCommand).command(commentsCreateCommand).command(commentsDeleteCommand).demandCommand(1),
  handler: noop
};
