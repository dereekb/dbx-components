import type { CommandModule, Argv } from 'yargs';
import { getDeskContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, ZOHO_DESK_PAGINATION_ADAPTER } from '../../util/pagination';
import { zohoDeskDeleteTicketAttachment, zohoDeskGetTicketAttachments } from '@dereekb/zoho';

const attachmentsListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List attachments on a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const initialInput = { ticketId: argv.ticketId, from: argv.from, limit: argv.limit };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => zohoDeskGetTicketAttachments(deskContext)(input),
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

const attachmentsDeleteCommand: CommandModule = {
  command: 'delete <ticketId> <attachmentId>',
  describe: 'Delete an attachment',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).positional('attachmentId', { type: 'string', demandOption: true, describe: 'Attachment ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      await zohoDeskDeleteTicketAttachment(deskContext)({ ticketId: argv.ticketId, attachmentId: argv.attachmentId });
      outputResult({ deleted: true });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const DESK_ATTACHMENTS_COMMAND: CommandModule = {
  command: 'attachments',
  describe: 'Desk attachment operations',
  builder: (yargs: Argv) => yargs.command(attachmentsListCommand).command(attachmentsDeleteCommand).demandCommand(1),
  handler: noop
};
