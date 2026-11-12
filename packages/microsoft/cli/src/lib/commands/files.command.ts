import { CliError } from '@dereekb/dbx-cli';
import { outputMsGraphCliResult } from '../util/output';
import { getDriveItem, searchDriveItems } from '@dereekb/microsoft';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';

const FILES_SEARCH_COMMAND: CommandModule = {
  command: 'search <query>',
  describe: "Search the user's OneDrive",
  builder: (yargs: Argv) => yargs.positional('query', { type: 'string', demandOption: true, describe: 'Search text' }).option('top', { type: 'number', describe: 'Maximum items to return (default 25)' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputMsGraphCliResult(await searchDriveItems(graphContext)({ query: argv.query, top: argv.top }));
  })
};

const FILES_GET_COMMAND: CommandModule = {
  command: 'get [id]',
  describe: "Get one OneDrive item's metadata, by id or --path",
  builder: (yargs: Argv) =>
    yargs
      .positional('id', { type: 'string', describe: 'The drive item id' })
      .option('path', { type: 'string', describe: 'The item path from the drive root, e.g. Documents/report.docx' })
      .example([
        ['$0 files get 01ABCDEF', 'An item by id'],
        ['$0 files get --path Documents/report.docx', 'An item by path']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    if (!argv.id && !argv.path) {
      throw new CliError({ message: 'Pass an item id or --path.', code: 'INVALID_ARGUMENT' });
    }

    outputMsGraphCliResult(await getDriveItem(graphContext)({ id: argv.id, path: argv.path }));
  })
};

/**
 * The `files` command: `files search <query>` and `files get <id> | --path <path>` (metadata only).
 */
export const FILES_COMMAND: CommandModule = {
  command: 'files',
  describe: "Read the user's OneDrive file metadata",
  builder: (yargs: Argv) => yargs.command(FILES_SEARCH_COMMAND).command(FILES_GET_COMMAND).demandCommand(1, 'Please specify a files subcommand.'),
  handler: () => undefined
};
