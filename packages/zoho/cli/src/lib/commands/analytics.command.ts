import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { ANALYTICS_ORGS_COMMAND } from './analytics/analytics.orgs.command';
import { ANALYTICS_WORKSPACES_COMMAND } from './analytics/analytics.workspaces.command';
import { ANALYTICS_VIEWS_COMMAND } from './analytics/analytics.views.command';
import { ANALYTICS_IMPORT_COMMAND } from './analytics/analytics.import.command';
import { ANALYTICS_EXPORT_COMMAND } from './analytics/analytics.export.command';

export const ANALYTICS_COMMAND: CommandModule = {
  command: 'analytics',
  describe: 'Zoho Analytics operations',
  builder: (yargs: Argv) =>
    yargs
      .command(ANALYTICS_ORGS_COMMAND)
      .command(ANALYTICS_WORKSPACES_COMMAND)
      .command(ANALYTICS_VIEWS_COMMAND)
      .command(ANALYTICS_IMPORT_COMMAND)
      .command(ANALYTICS_EXPORT_COMMAND)
      .demandCommand(1, 'Please specify an analytics subcommand.')
      .example([
        ['$0 analytics orgs list', 'Find the org id every other command needs'],
        ['$0 analytics workspaces list', 'List the accessible workspaces'],
        ['$0 analytics import data WS VIEW -f rows.csv -m truncateadd', 'Replace a table with the rows of a CSV'],
        ['$0 analytics export data WS VIEW -o rows.csv', 'Export a table to a CSV file']
      ]),
  handler: noop
};
