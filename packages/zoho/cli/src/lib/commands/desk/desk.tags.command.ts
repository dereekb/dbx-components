import type { CommandModule, Argv } from 'yargs';
import { getDeskContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, ZOHO_DESK_PAGINATION_ADAPTER } from '../../util/pagination';
import { zohoDeskAssociateTicketTags, zohoDeskDissociateTicketTag, zohoDeskGetAllTags, zohoDeskGetTicketTags, zohoDeskSearchTags } from '@dereekb/zoho';

const tagsListCommand: CommandModule = {
  command: 'list',
  describe: 'List all tags',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('department-id', { alias: 'd', type: 'string', demandOption: true, describe: 'Department ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const initialInput = { from: argv.from, limit: argv.limit, departmentId: argv.departmentId };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => zohoDeskGetAllTags(deskContext)(input),
        adapter: ZOHO_DESK_PAGINATION_ADAPTER,
        multiplePages: argv.multiplePages,
        multiplePagesOutput: argv.multiplePagesOutput,
        dumpOutput: argv.dumpOutput,
        dumpMerge: argv.dumpMerge
      });
      if (outcome.handled === false) {
        const result = outcome.result;
        outputResult(result.data, { count: result.data?.length });
      }
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const tagsSearchCommand: CommandModule = {
  command: 'search',
  describe: 'Search tags',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('department-id', { alias: 'd', type: 'string', describe: 'Department ID' }).option('query', { alias: 'q', type: 'string', demandOption: true, describe: 'Search string' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const initialInput = { from: argv.from, limit: argv.limit, departmentId: argv.departmentId, searchVal: argv.query };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => zohoDeskSearchTags(deskContext)(input),
        adapter: ZOHO_DESK_PAGINATION_ADAPTER,
        multiplePages: argv.multiplePages,
        multiplePagesOutput: argv.multiplePagesOutput,
        dumpOutput: argv.dumpOutput,
        dumpMerge: argv.dumpMerge
      });
      if (outcome.handled === false) {
        const result = outcome.result;
        outputResult(result.data, { count: result.data?.length });
      }
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const tagsForTicketCommand: CommandModule = {
  command: 'for-ticket <ticketId>',
  describe: 'Get tags on a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskGetTicketTags(deskContext)({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const tagsAssociateCommand: CommandModule = {
  command: 'associate <ticketId>',
  describe: 'Add tags to a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('tags', { type: 'string', demandOption: true, describe: 'Comma-separated tag names' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const tags = (argv.tags as string).split(',').map((t: string) => t.trim());
      const result = await zohoDeskAssociateTicketTags(deskContext)({ ticketId: argv.ticketId, tags });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const tagsDissociateCommand: CommandModule = {
  command: 'dissociate <ticketId>',
  describe: 'Remove a tag from a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('tag-id', { type: 'string', demandOption: true, describe: 'Tag ID to remove' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      await zohoDeskDissociateTicketTag(deskContext)({ ticketId: argv.ticketId, tagId: argv.tagId });
      outputResult({ removed: true });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const DESK_TAGS_COMMAND: CommandModule = {
  command: 'tags',
  describe: 'Desk tag operations',
  builder: (yargs: Argv) => yargs.command(tagsListCommand).command(tagsSearchCommand).command(tagsForTicketCommand).command(tagsAssociateCommand).command(tagsDissociateCommand).demandCommand(1),
  handler: noop
};
