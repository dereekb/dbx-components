import { buildCliTokenSourceAuthCommand, cliTokenSourceReport, cliTokenSourceSelectionFromArgv, loadCliTokenSourceStatus, outputResult, wrapCommandHandler } from '@dereekb/dbx-cli';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCliScopesFromArgv, msGraphCliTokenSourceCommandConfig } from '../config/cli.config';
import { MSGRAPH_CLI_NO_TOKEN_SOURCE_HINT } from '../middleware/auth.middleware';

/**
 * `auth show`: the active token source and its token (never the token itself), minting one when no
 * cached token is reusable.
 */
const AUTH_SHOW_COMMAND: CommandModule = {
  command: 'show',
  describe: 'Show the active token source and the scopes and expiry of its token (never the token)',
  builder: (yargs: Argv) => yargs.example([['$0 auth show --scopes "Mail.Read"', 'Mint (or reuse) a token narrowed to Mail.Read and show it']]),
  handler: wrapCommandHandler(async (argv: any) => {
    const config = msGraphCliTokenSourceCommandConfig();
    const status = await loadCliTokenSourceStatus({ resolver: config.resolver, fileConfig: await config.loadConfigFile(), tokenCachePath: config.tokenCachePath, scopes: msGraphCliScopesFromArgv(argv), ...cliTokenSourceSelectionFromArgv(argv) });
    outputResult(status ? { tokenSource: cliTokenSourceReport(status) } : { tokenSource: null, suggestion: MSGRAPH_CLI_NO_TOKEN_SOURCE_HINT });
  })
};

/**
 * The `auth` command: `auth token-source set/use/show/clear` and `auth show`.
 *
 * msgraph-cli authenticates only through a token source, so there is no `auth login`.
 */
export const AUTH_COMMAND: CommandModule = {
  command: 'auth',
  describe: 'Manage the token source that mints Microsoft Graph access tokens',
  builder: (yargs: Argv) =>
    yargs
      .command(
        buildCliTokenSourceAuthCommand({
          ...msGraphCliTokenSourceCommandConfig(),
          tokenDescription: 'a Microsoft Graph access token bundle',
          exampleCommand: 'demo-cli external-token microsoft --env msgraph-read',
          // explicit: the derived default appends `--env prod` to exampleCommand, which already names an env
          setExamples: [
            ['$0 auth token-source set "demo-cli external-token microsoft --env msgraph-read"', 'Use Read tokens minted by demo-cli'],
            ['$0 auth token-source set "demo-cli external-token microsoft --env msgraph-admin" --name admin', 'Save a named source whose grant allows Read + Write'],
            ['$0 auth token-source set "demo-cli external-token microsoft --env prod-msgraph-read" --name prod', 'Save a named source for production']
          ]
        })
      )
      .command(AUTH_SHOW_COMMAND)
      .demandCommand(1, 'Please specify an auth subcommand.'),
  handler: () => undefined
};
