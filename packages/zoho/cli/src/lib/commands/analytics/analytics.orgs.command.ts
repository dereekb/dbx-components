import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { getAnalyticsContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { outputResult } from '../../util/output';
import { zohoAnalyticsGetOrgs } from '@dereekb/zoho';

const orgsListCommand: CommandModule = {
  command: 'list',
  describe: 'List the organizations available to the authenticated user',
  handler: async (argv: any) => {
    try {
      const analyticsContext = getAnalyticsContext(argv);
      const result = await zohoAnalyticsGetOrgs(analyticsContext)();
      outputResult(result.data.orgs, { count: result.data.orgs?.length });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
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
