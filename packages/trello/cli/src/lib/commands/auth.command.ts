import { CliError, buildCliTokenSourceAuthCommand } from '@dereekb/dbx-cli';
import { type TrelloFactoryConfig, probeTrelloAuth, trelloFactory } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import type { Argv } from 'yargs';
import { trelloCliCredentialsStore, trelloCliPaths, trelloCliTokenSourceCommandConfig } from '../config/cli.config';
import { type TrelloCliCommand } from '../context/cli.command';
import { type TrelloCliContext } from '../context/cli.context';
import { TRELLO_CLI_NOT_CONFIGURED_SUGGESTION } from '../middleware/auth.middleware';
import { parseTrelloCliApiUrl } from '../util/option';
import { trelloCliStderrLogger } from '../util/output';

/**
 * Config for {@link trelloCliAuthCommand}.
 */
export interface TrelloCliAuthCommandConfig {
  /**
   * Overrides the Trello client `auth login` verifies with. Used by specs.
   */
  readonly trelloFactoryConfig?: Maybe<TrelloFactoryConfig>;
}

/**
 * The `auth show` report: how the run authenticates and who it is, never a secret.
 *
 * @param ctx - The run's context.
 * @returns The report.
 * @throws {CliError} The probe's code (`TOKEN_REJECTED`, `SCOPE_DENIED`, …) when the credentials do not work.
 */
export async function trelloCliAuthShowReport(ctx: TrelloCliContext): Promise<Record<string, unknown>> {
  let result: Record<string, unknown>;

  if (ctx.auth.mode === 'none') {
    result = { configured: false, mode: 'none', board: ctx.board ?? null, suggestion: TRELLO_CLI_NOT_CONFIGURED_SUGGESTION };
  } else {
    const probe = await probeTrelloAuth({ trelloContext: ctx.trelloContext });
    const base = { configured: true, mode: ctx.auth.mode, source: ctx.auth.source, board: ctx.board ?? null };

    if (!probe.ok) {
      throw new CliError({ message: probe.message, code: probe.code, suggestion: 'Check the credentials: a revoked token answers 401, a token without access to the member answers 403.', data: base });
    }

    result = { ...base, member: probe.member };
  }

  return result;
}

/**
 * Creates the `auth` command: `show`, `login`, `logout` and the `token-source` group.
 *
 * @param config - The client overrides.
 * @returns The command.
 */
export function trelloCliAuthCommand(config: TrelloCliAuthCommandConfig = {}): TrelloCliCommand {
  const show: TrelloCliCommand = {
    command: 'show',
    describe: 'Show how this run authenticates (mode and source, never a secret) and the member it acts as; fails when the credentials do not work',
    requires: 'none',
    handler: async (_argv, ctx) => ctx.output.result(await trelloCliAuthShowReport(ctx))
  };

  const login: TrelloCliCommand = {
    command: 'login',
    describe: 'Save an API key + token pair (to <configDir>/credentials.json, mode 0600), checking it against Trello first',
    requires: 'none',
    builder: (yargs: Argv) =>
      yargs
        .option('key', { type: 'string', demandOption: true, describe: 'The API key (https://trello.com/power-ups/admin)' })
        .option('token', { type: 'string', demandOption: true, describe: "The member's API token" })
        .option('verify', { type: 'boolean', default: true, describe: 'Check the pair against Trello before saving (--no-verify to skip)' })
        .example([['$0 auth login --key "$KEY" --token "$TOKEN"', 'Save and check a key + token pair']]),
    handler: async (argv, ctx) => {
      const apiKey = String(argv['key']).trim();
      const apiToken = String(argv['token']).trim();
      let member: Maybe<unknown>;

      if (argv['verify'] !== false) {
        const apiUrl = parseTrelloCliApiUrl(argv['apiUrl']);
        const { trelloContext } = trelloFactory({ logTrelloServerErrorFunction: trelloCliStderrLogger(argv['verbose'] === true), ...config.trelloFactoryConfig })({ apiKey, apiToken, ...(apiUrl ? { apiUrl } : {}) });
        const probe = await probeTrelloAuth({ trelloContext });

        if (!probe.ok) {
          throw new CliError({ message: `Trello rejected the key + token: ${probe.message}`, code: probe.code, suggestion: 'Nothing was saved. Check the key and token, or pass --no-verify to save them anyway.' });
        }

        member = probe.member;
      }

      const store = trelloCliCredentialsStore(trelloCliPaths());
      await store.write({ apiKey, apiToken });
      ctx.output.result({ saved: true, path: store.filePath, verified: member != null, member: member ?? null });
    }
  };

  const logout: TrelloCliCommand = {
    command: 'logout',
    describe: 'Delete the saved key + token pair',
    requires: 'none',
    handler: async (_argv, ctx) => {
      const store = trelloCliCredentialsStore(trelloCliPaths());
      const existed = (await store.read()) != null;
      await store.clear();
      ctx.output.result({ cleared: existed, path: store.filePath });
    }
  };

  return {
    command: 'auth',
    describe: 'Manage credentials: a saved key + token pair, env vars, or a token source that mints OAuth tokens',
    requires: 'none',
    builder: (yargs: Argv) =>
      yargs.command(
        buildCliTokenSourceAuthCommand({
          ...trelloCliTokenSourceCommandConfig(),
          tokenDescription: 'a Trello OAuth access token bundle',
          exampleCommand: 'demo-cli external-token trello'
        })
      ),
    subcommands: [show, login, logout]
  };
}

/**
 * The stock `auth` command.
 */
export const TRELLO_CLI_AUTH_COMMAND: TrelloCliCommand = trelloCliAuthCommand();
