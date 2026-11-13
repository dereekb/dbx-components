import type { Argv, CommandModule } from 'yargs';
import { type Maybe } from '@dereekb/util';
import { maskSecret } from '../config/cli.config';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR, isCliCredentialProcess } from '../util/credential-process';
import { wrapCommandHandler } from '../util/handler';
import { outputResult } from '../util/output';
import { type CliExternalConnectionDataAdapter, type CliExternalConnectionDataAdapters, type CliExternalConnectionSettings, summarizeCliExternalConnectionSettings } from './external-connection-data';
import { type CliExternalConnectionTokenBundle, cliExternalConnectionTokenBundle, fetchExternalConnectionToken } from './external-token';

/**
 * Default command name for the external connection access-token mint.
 */
export const DEFAULT_EXTERNAL_TOKEN_COMMAND_NAME = 'external-token';

/**
 * Options accepted by {@link buildExternalTokenCommand}.
 */
export interface BuildExternalTokenCommandOptions {
  readonly commandName?: Maybe<string>;
  /**
   * The CLI's binary name, used in the command's help text. Defaults to `<cli>`.
   */
  readonly cliName?: Maybe<string>;
  /**
   * Connection-data adapters keyed by provider type (`CreateCliInput.externalConnectionData.adapters`).
   *
   * The token is requested with `?include=data` only for a provider that has an adapter, and the
   * adapter's `unpack` output rides the bundle as `settings`. Other providers never receive stored data.
   */
  readonly dataAdapters?: Maybe<CliExternalConnectionDataAdapters>;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: Maybe<typeof fetch>;
}

/**
 * Builds the top-level `external-token <providerType>` command.
 *
 * Mints a short-lived access token for one of the signed-in user's external connections (e.g. their
 * `zoho_admin` connection) so another CLI can call that provider without its own OAuth login, client
 * secret, or refresh token.
 *
 * Run directly, it prints a REDACTED token plus its metadata. The raw token is written only when the
 * command runs as a credential process ({@link DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR} set — the consuming
 * CLI sets it on the child it spawns): then stdout carries exactly one JSON line, the
 * {@link CliExternalConnectionTokenBundle}, and nothing else. The raw token never passes through
 * `outputResult`, so `--dump-dir` / `--pick` never see it, and the command never touches the dataset
 * cache.
 *
 * With a data adapter for the provider ({@link BuildExternalTokenCommandOptions.dataAdapters}), the
 * caller's stored connection data is requested too and unpacked into the bundle's `settings` — the
 * consuming CLI's defaults. A failing unpack prints one warning to stderr and never fails the mint.
 * Direct runs print only the settings' keys.
 *
 * @param options - Optional command-name override, CLI name for the help text, data adapters, and fetch override.
 * @returns A yargs `CommandModule` for the API command list.
 *
 * @example
 * ```typescript
 * runCli({ cliName: 'demo-cli', externalConnectionToken: true });
 * // then: zoho-cli auth token-source set "demo-cli external-token zoho_admin"
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildExternalTokenCommand(options?: Maybe<BuildExternalTokenCommandOptions>): CommandModule {
  const commandName = options?.commandName ?? DEFAULT_EXTERNAL_TOKEN_COMMAND_NAME;
  const cliName = options?.cliName ?? '<cli>';
  const fetcher = options?.fetcher;
  const dataAdapters = options?.dataAdapters;

  return {
    command: `${commandName} <providerType>`,
    describe: `Mint a short-lived access token for one of your external connections (e.g. zoho_admin). Prints it REDACTED; the raw token is only written for a credential process (${DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR}=1), e.g. \`zoho-cli auth token-source set "${cliName} ${commandName} zoho_admin"\`.`,
    builder: (yargs: Argv) => yargs.positional('providerType', { type: 'string', demandOption: true, describe: 'The external connection provider type, e.g. "zoho_admin".' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const context: CliContext = requireCliContext();
      const providerType = String(argv.providerType);
      const adapter: Maybe<CliExternalConnectionDataAdapter> = dataAdapters != null && Object.hasOwn(dataAdapters, providerType) ? dataAdapters[providerType] : undefined;
      const token = await fetchExternalConnectionToken({ apiBaseUrl: context.env.apiBaseUrl, accessToken: context.accessToken, providerType, cliName: context.cliName, envName: context.envName, scope: context.scope, credential: context.credential, includeData: adapter != null, fetcher });
      let settings: Maybe<CliExternalConnectionSettings>;

      if (adapter && token.data != null) {
        try {
          settings = adapter.unpack({ providerType, data: token.data, env: context.env });
        } catch {
          // stored data must never block a mint, and its contents never reach the output
          process.stderr.write(`${commandName}: could not apply connection defaults for "${providerType}".\n`);
        }
      }

      const bundle: CliExternalConnectionTokenBundle = cliExternalConnectionTokenBundle(token, context.env.externalConnectionHints, settings);

      if (isCliCredentialProcess()) {
        // the ONLY place the raw token is written: one line, straight to stdout, for the parent
        // process to capture — bypassing outputResult keeps it out of --dump-dir and --pick
        process.stdout.write(`${JSON.stringify(bundle)}\n`);
      } else {
        outputResult(
          {
            uid: bundle.uid,
            providerType: bundle.providerType,
            accessToken: maskSecret(bundle.accessToken),
            tokenType: bundle.tokenType,
            scopes: bundle.scopes,
            expiresAt: bundle.expiresAt,
            extra: bundle.extra,
            hints: bundle.hints,
            settings: summarizeCliExternalConnectionSettings(bundle.settings)
          },
          {
            redacted: true,
            note: `The raw token is only printed when run as a credential process (${DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR}=1), e.g. by \`zoho-cli auth token-source set "${context.cliName} ${commandName} ${providerType}"\`.`
          }
        );
      }
    })
  };
}
