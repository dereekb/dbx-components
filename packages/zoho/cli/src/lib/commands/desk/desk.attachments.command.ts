import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, zohoDeskPaginationAdapter } from '../../util/pagination';

const attachmentsListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List attachments on a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const initialInput = { ticketId: argv.ticketId, from: argv.from, limit: argv.limit };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => api.getTicketAttachments(input as any),
        adapter: zohoDeskPaginationAdapter,
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
      outputError(e);
      process.exit(1);
    }
  }
};

const attachmentsDeleteCommand: CommandModule = {
  command: 'delete <ticketId> <attachmentId>',
  describe: 'Delete an attachment',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).positional('attachmentId', { type: 'string', demandOption: true, describe: 'Attachment ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      await api.deleteTicketAttachment({ ticketId: argv.ticketId, attachmentId: argv.attachmentId });
      outputResult({ deleted: true });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskAttachmentsCommand: CommandModule = {
  command: 'attachments',
  describe: 'Desk attachment operations',
  builder: (yargs: Argv) => yargs.command(attachmentsListCommand).command(attachmentsDeleteCommand).demandCommand(1),
  handler: noop
};
