import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { getSignContext, exitZohoCliCommandWithError } from '../middleware/auth.middleware';
import { outputResult } from '../util/output';
import { SIGN_DOCUMENTS_COMMAND } from './sign/sign.documents.command';
import { SIGN_TEMPLATES_COMMAND } from './sign/sign.templates.command';
import { zohoSignRetrieveFieldTypes } from '@dereekb/zoho';

const signFieldTypesCommand: CommandModule = {
  command: 'field-types',
  describe: 'List available document field types',
  builder: (yargs: Argv) => yargs,
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const result = await zohoSignRetrieveFieldTypes(signContext)();
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const SIGN_COMMAND: CommandModule = {
  command: 'sign',
  describe: 'Zoho Sign operations',
  builder: (yargs: Argv) =>
    yargs
      .command(SIGN_DOCUMENTS_COMMAND)
      .command(SIGN_TEMPLATES_COMMAND)
      .command(signFieldTypesCommand)
      .demandCommand(1, 'Please specify a sign subcommand.')
      .example([
        ['$0 sign documents list --row-count 10', 'List first 10 sign requests'],
        ['$0 sign templates list', 'List templates'],
        ['$0 sign documents get 12345', 'Get a request by ID'],
        ['$0 sign field-types', 'List available field types']
      ]),
  handler: noop
};
