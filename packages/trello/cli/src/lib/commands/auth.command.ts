import { CliError, buildCliTokenSourceAuthCommand } from '@dereekb/dbx-cli';
import { ALL_TRELLO_API_TOKEN_EXPIRATIONS, ALL_TRELLO_API_TOKEN_SCOPES, type TrelloApiKey, type TrelloApiToken, type TrelloApiTokenExpiration, type TrelloApiTokenScope, type TrelloFactoryConfig, type TrelloMemberId, probeTrelloAuth, trelloApiTokenAuthorizeUrl, trelloFactory } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import type { Arguments, Argv } from 'yargs';
import { trelloCliCredentialsStore, trelloCliPaths, trelloCliTokenSourceCommandConfig } from '../config/cli.config';
import { type TrelloCliCommand } from '../context/cli.command';
import { type TrelloCliContext } from '../context/cli.context';
import { TRELLO_CLI_NOT_CONFIGURED_SUGGESTION } from '../middleware/auth.middleware';
import { TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_SUGGESTION } from '../util/download';
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

    result = { ...base, member: probe.member, ...(ctx.auth.mode === 'token-source' ? { download: await trelloCliDownloadAuthReport(ctx, probe.member.id) } : {}) };
  }

  return result;
}

/**
 * The `download` part of the `auth show` report (see {@link trelloCliDownloadAuthReport}). Never carries a secret.
 */
export interface TrelloCliDownloadAuthReport {
  /**
   * Where the key + token pair came from, or null when token-source mode has none.
   */
  readonly source: Maybe<string>;
  /**
   * The member the pair acts as, when it works.
   */
  readonly member?: Maybe<{ readonly id: TrelloMemberId; readonly username: string; readonly fullName: string }>;
  /**
   * Set when the pair acts as another member than the token source.
   */
  readonly warning?: Maybe<string>;
  /**
   * What to configure, when there is no pair.
   */
  readonly suggestion?: Maybe<string>;
  /**
   * The probe's message and code, when the pair does not work.
   */
  readonly error?: Maybe<string>;
  readonly code?: Maybe<string>;
}

/**
 * The `download` part of the `auth show` report in token-source mode: where the key + token pair attachment downloads
 * use came from and the member it acts as, or what to configure when there is none. Never throws: the run's own
 * credentials work, so a broken download pair is reported, not raised.
 *
 * @param ctx - The run's context.
 * @param memberId - The member the token source acts as, to flag a pair for another member.
 * @returns The report.
 */
export async function trelloCliDownloadAuthReport(ctx: TrelloCliContext, memberId: TrelloMemberId): Promise<TrelloCliDownloadAuthReport> {
  const source = ctx.auth.downloadSource;
  let result: TrelloCliDownloadAuthReport;

  if (source == null) {
    result = { source: null, suggestion: TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_SUGGESTION };
  } else {
    const probe = await probeTrelloAuth({ trelloContext: ctx.downloadTrelloContext });

    if (probe.ok) {
      result = { source, member: probe.member, ...(probe.member.id === memberId ? {} : { warning: `The download pair acts as @${probe.member.username}, not as the token source's member. Downloads only work for cards that member can see.` }) };
    } else {
      result = { source, error: probe.message, code: probe.code };
    }
  }

  return result;
}

/**
 * Input for {@link saveTrelloCliKeyTokenPair}.
 */
interface SaveTrelloCliKeyTokenPairInput {
  readonly apiKey: TrelloApiKey;
  readonly apiToken: TrelloApiToken;
  readonly argv: Arguments;
  readonly ctx: TrelloCliContext;
  readonly trelloFactoryConfig?: Maybe<TrelloFactoryConfig>;
}

/**
 * Checks a key + token pair against Trello (unless `--no-verify`), then saves it and prints the result.
 *
 * @param input - The pair, the parsed arguments, the context and the client overrides.
 * @throws {CliError} The probe's code when Trello rejects the pair; nothing is saved then.
 */
async function saveTrelloCliKeyTokenPair(input: SaveTrelloCliKeyTokenPairInput): Promise<void> {
  const { apiKey, apiToken, argv, ctx } = input;
  let member: Maybe<unknown>;

  if (argv['verify'] !== false) {
    const apiUrl = parseTrelloCliApiUrl(argv['apiUrl']);
    const { trelloContext } = trelloFactory({ logTrelloServerErrorFunction: trelloCliStderrLogger(argv['verbose'] === true), ...input.trelloFactoryConfig })({ apiKey, apiToken, ...(apiUrl ? { apiUrl } : {}) });
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

/**
 * Input for {@link trelloCliApiTokenAuthorizeReport}.
 */
export interface TrelloCliApiTokenAuthorizeReportInput {
  readonly apiKey: TrelloApiKey;
  /**
   * The `--scope` value: comma-separated scopes, or undefined for the default.
   */
  readonly scope?: unknown;
  /**
   * The `--expiration` value.
   */
  readonly expiration?: unknown;
  readonly ctx: Pick<TrelloCliContext, 'auth' | 'cliName'>;
}

/**
 * The `auth login --key <key>` report (no `--token`): the url that grants the member's API token for the key, the
 * scopes it asks for, and the command to run with the token. Prints no secret: the API key is the public half.
 *
 * The scopes default to `read` when a token source is active, since the pair then only downloads attachments (Trello's
 * download endpoint refuses OAuth 2.0 tokens), and to `read,write` otherwise.
 *
 * @param input - The key, the `--scope` / `--expiration` values and the context.
 * @returns The report.
 * @throws {CliError} `INVALID_ARGUMENT` for an unknown scope.
 */
export function trelloCliApiTokenAuthorizeReport(input: TrelloCliApiTokenAuthorizeReportInput): Record<string, unknown> {
  const { apiKey, ctx } = input;
  const forDownloads = ctx.auth.mode === 'token-source';
  const scopeArg = typeof input.scope === 'string' && input.scope.trim() ? input.scope : undefined;
  const scopes = (scopeArg ?? (forDownloads ? 'read' : 'read,write'))
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const unknownScopes = scopes.filter((x) => !(ALL_TRELLO_API_TOKEN_SCOPES as readonly string[]).includes(x));

  if (unknownScopes.length > 0) {
    throw new CliError({ message: `Unknown scope(s): ${unknownScopes.join(', ')}.`, code: 'INVALID_ARGUMENT', suggestion: `Use ${ALL_TRELLO_API_TOKEN_SCOPES.join(', ')} (comma-separated).` });
  }

  const expiration = (input.expiration as Maybe<TrelloApiTokenExpiration>) ?? 'never';
  const authorizeUrl = trelloApiTokenAuthorizeUrl({ apiKey, scopes: scopes as TrelloApiTokenScope[], expiration, name: ctx.cliName });

  return {
    saved: false,
    authorizeUrl,
    scopes,
    expiration,
    use: forDownloads ? 'attachment downloads (a token source is active and handles everything else)' : 'every command',
    steps: [
      `Open authorizeUrl in a browser signed in to Trello as the member the CLI should act as${forDownloads ? ' (the same member as the token source)' : ''}.`,
      'Allow access, then copy the token Trello shows.',
      `Run: ${ctx.cliName} auth login --key <key> --token <token>`,
      `Check it with: ${ctx.cliName} ${forDownloads ? 'doctor' : 'auth show'}`
    ]
  };
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
    describe: 'Save an API key + token pair (to <configDir>/credentials.json, mode 0600), checking it against Trello first. Without --token, prints the url that grants the token',
    requires: 'none',
    builder: (yargs: Argv) =>
      yargs
        .option('key', { type: 'string', demandOption: true, describe: "The API key (the Power-Up's API key tab, https://trello.com/power-ups/admin)" })
        .option('token', { type: 'string', describe: "The member's API token. Omit it to get the url that grants one" })
        .option('scope', { type: 'string', describe: 'Without --token: the scopes the url asks for (read, write, account; comma-separated). Default: read with a token source (the pair is only used for downloads), else read,write' })
        .option('expiration', { type: 'string', choices: [...ALL_TRELLO_API_TOKEN_EXPIRATIONS], default: 'never', describe: 'Without --token: how long the granted token lives' })
        .option('verify', { type: 'boolean', default: true, describe: 'Check the pair against Trello before saving (--no-verify to skip)' })
        .example([
          ['$0 auth login --key "$KEY"', 'Print the url that grants a token for the key, and what to run next'],
          ['$0 auth login --key "$KEY" --token "$TOKEN"', 'Save and check a key + token pair']
        ]),
    handler: async (argv, ctx) => {
      const apiKey = String(argv['key']).trim();
      const tokenArg = typeof argv['token'] === 'string' ? argv['token'].trim() : '';

      if (tokenArg) {
        await saveTrelloCliKeyTokenPair({ apiKey, apiToken: tokenArg, argv, ctx, trelloFactoryConfig: config.trelloFactoryConfig });
      } else {
        ctx.output.result(trelloCliApiTokenAuthorizeReport({ apiKey, scope: argv['scope'], expiration: argv['expiration'], ctx }));
      }
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
