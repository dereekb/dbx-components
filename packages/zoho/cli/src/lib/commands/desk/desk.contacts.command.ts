import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';

const contactsListCommand: CommandModule = {
  command: 'list',
  describe: 'List contacts',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('sort-by', { type: 'string', describe: 'Field to sort by' }).option('include', { type: 'string', describe: 'Comma-separated includes' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getContacts({ from: argv.from, limit: argv.limit, sortBy: argv.sortBy, include: argv.include });
      outputResult(result.data, { from: argv.from, limit: argv.limit, count: result.data?.length });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const contactsGetCommand: CommandModule = {
  command: 'get <contactId>',
  describe: 'Get a contact by ID',
  builder: (yargs: Argv) => yargs.positional('contactId', { type: 'string', demandOption: true, describe: 'Contact ID' }).option('include', { type: 'string', describe: 'Comma-separated includes' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getContactById({ contactId: argv.contactId, include: argv.include });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskContactsCommand: CommandModule = {
  command: 'contacts',
  describe: 'Desk contact operations',
  builder: (yargs: Argv) => yargs.command(contactsListCommand).command(contactsGetCommand).demandCommand(1),
  handler: noop
};
