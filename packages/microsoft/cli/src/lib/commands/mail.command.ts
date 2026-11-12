import { getMessage, searchMessages } from '@dereekb/microsoft';
import { outputResult } from '@dereekb/dbx-cli';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';

const MAIL_SEARCH_COMMAND: CommandModule = {
  command: 'search <query>',
  describe: "Search the user's mail (Graph $search)",
  builder: (yargs: Argv) =>
    yargs
      .positional('query', { type: 'string', demandOption: true, describe: 'Search text, e.g. a subject keyword or from:someone@example.com' })
      .option('top', { type: 'number', describe: 'Maximum messages to return (default 25)' })
      .option('folder', { type: 'string', describe: 'Limit to one mail folder by id or well-known name (e.g. inbox, sentitems)' })
      .example([['$0 mail search "invoice" --top 10', 'Ten messages matching "invoice"']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputResult(await searchMessages(graphContext)({ query: argv.query, top: argv.top, folder: argv.folder }));
  })
};

const MAIL_GET_COMMAND: CommandModule = {
  command: 'get <id>',
  describe: 'Get one message with its body',
  builder: (yargs: Argv) => yargs.positional('id', { type: 'string', demandOption: true, describe: 'The message id' }).option('format', { type: 'string', choices: ['text', 'html'] as const, default: 'text', describe: 'Body format' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputResult(await getMessage(graphContext)({ id: argv.id, format: argv.format }));
  })
};

/**
 * The `mail` command: `mail search <query>` and `mail get <id>`.
 */
export const MAIL_COMMAND: CommandModule = {
  command: 'mail',
  describe: "Read the user's Outlook mail",
  builder: (yargs: Argv) => yargs.command(MAIL_SEARCH_COMMAND).command(MAIL_GET_COMMAND).demandCommand(1, 'Please specify a mail subcommand.'),
  handler: () => undefined
};
