import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { getAnalyticsApi } from '../../middleware/auth.middleware';
import { outputResult, outputError } from '../../util/output';

const orgsListCommand: CommandModule = {
  command: 'list',
  describe: 'List the organizations available to the authenticated user',
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const result = await api.getOrgs();
      outputResult(result.data.orgs, { count: result.data.orgs?.length });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const ANALYTICS_ORGS_COMMAND: CommandModule = {
  command: 'orgs',
  describe: 'Analytics organization operations',
  builder: (yargs: Argv) =>
    yargs
      .command(orgsListCommand)
      .demandCommand(1)
      .example([['$0 analytics orgs list', 'Find the org id needed by every other Analytics command']]),
  handler: noop
};
