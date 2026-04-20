import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';

const tagsListCommand: CommandModule = {
  command: 'list',
  describe: 'List all tags',
  builder: (yargs: Argv) => withDeskPagination(yargs),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getAllTags({ from: argv.from, limit: argv.limit });
      outputResult(result.data, { count: result.data?.length });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const tagsSearchCommand: CommandModule = {
  command: 'search',
  describe: 'Search tags',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('query', { alias: 'q', type: 'string', demandOption: true, describe: 'Search string' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.searchTags({ from: argv.from, limit: argv.limit, searchStr: argv.query });
      outputResult(result.data, { count: result.data?.length });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const tagsForTicketCommand: CommandModule = {
  command: 'for-ticket <ticketId>',
  describe: 'Get tags on a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketTags({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const tagsAssociateCommand: CommandModule = {
  command: 'associate <ticketId>',
  describe: 'Add tags to a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('tags', { type: 'string', demandOption: true, describe: 'Comma-separated tag names' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const tags = (argv.tags as string).split(',').map((t: string) => t.trim());
      const result = await api.associateTicketTags({ ticketId: argv.ticketId, tags });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const tagsDissociateCommand: CommandModule = {
  command: 'dissociate <ticketId>',
  describe: 'Remove a tag from a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('tag-id', { type: 'string', demandOption: true, describe: 'Tag ID to remove' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      await api.dissociateTicketTag({ ticketId: argv.ticketId, tagId: argv.tagId });
      outputResult({ removed: true });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskTagsCommand: CommandModule = {
  command: 'tags',
  describe: 'Desk tag operations',
  builder: (yargs: Argv) => yargs.command(tagsListCommand).command(tagsSearchCommand).command(tagsForTicketCommand).command(tagsAssociateCommand).command(tagsDissociateCommand).demandCommand(1),
  handler: noop
};
