import type { Argv, CommandModule } from 'yargs';
import { type Maybe, MS_IN_SECOND, noop } from '@dereekb/util';
import { durationDataToMilliseconds, parseDurationString } from '@dereekb/date';
import { type CliConfig, loadCliConfig, maskSecret, mergeCliConfig } from '../config/cli.config';
import { type CliEnvConfig, type CliEnvDefault, DEFAULT_CLI_REDIRECT_URI, applyEnvVarOverrides, filterReadOnlyModelScopes, findCliEnvDefault, isCliEnvConfigComplete, mergeCliEnvWithDefault } from '../config/env';
import { type CliPaths, buildCliPaths } from '../config/paths';
import { type CliTokenEntry, createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { discoverOidcMetadata, exchangeAuthorizationCode, fetchUserInfo, refreshAccessToken, revokeToken } from './oidc.client';
import { buildAuthorizationUrl, generateOAuthState, generatePkceMaterial, parsePastedRedirect } from './oidc.flow';
import { CliError, outputError, outputResult } from '../util/output';
import { promptLine } from '../util/interactive';
import { withEnv } from '../util/args';

export interface CreateAuthCommandInput {
  readonly cliName: string;
  /**
   * The env var name used to resolve the active env when no flag is provided.
   *
   * Conventionally `<CLINAME>_ENV` (e.g. `DEMO_CLI_ENV`).
   */
  readonly envVarName?: string;
  /**
   * Built-in env presets. Merged underneath the user's stored env when the env name matches.
   */
  readonly defaultEnvs?: readonly CliEnvDefault[];
}

interface ResolveEnvInput {
  readonly paths: CliPaths;
  readonly cliName: string;
  readonly envVarName: string;
  readonly flagEnv: Maybe<string>;
  readonly defaultEnvs?: readonly CliEnvDefault[];
}

interface ResolvedEnv {
  readonly envName: string;
  readonly env: CliEnvConfig;
  readonly config: CliConfig;
}

async function resolveEnvOrThrow(input: ResolveEnvInput): Promise<ResolvedEnv> {
  const config = (await loadCliConfig({ configFilePath: input.paths.configFilePath })) ?? {};
  const envName = input.flagEnv ?? process.env[input.envVarName] ?? config.activeEnv;

  if (!envName) {
    throw new CliError({
      message: 'No env selected. Run `<cli> env add <name>` and `<cli> env use <name>`, or pass `--env <name>`.',
      code: 'NO_ACTIVE_ENV'
    });
  }

  const stored = config.envs?.[envName];
  const defaultEnv = findCliEnvDefault({ name: envName, defaults: input.defaultEnvs })?.env;
  const merged = mergeCliEnvWithDefault({ env: stored, defaultEnv });
  const env = applyEnvVarOverrides({ cliName: input.cliName, env: merged });

  if (!env) {
    throw new CliError({
      message: `Env "${envName}" is not configured. Run \`<cli> auth setup --env ${envName}\`.`,
      code: 'ENV_NOT_FOUND'
    });
  }

  return { envName, env, config };
}

function maskEnv(env: CliEnvConfig): Record<string, unknown> {
  return {
    apiBaseUrl: env.apiBaseUrl,
    oidcIssuer: env.oidcIssuer,
    appClientUrl: env.appClientUrl,
    clientId: env.clientId ? maskSecret(env.clientId) : undefined,
    clientSecret: env.clientSecret ? maskSecret(env.clientSecret) : undefined,
    redirectUri: env.redirectUri,
    scopes: env.scopes
  };
}

/**
 * Factory for the built-in `auth` command tree.
 *
 * Wires `setup`, `login`, `logout`, `status`, `show`, and `check` subcommands that drive the OIDC
 * PKCE flow against the active env, persist tokens via the per-CLI token cache, and print a
 * structured envelope.
 *
 * @param input - Factory configuration.
 * @param input.cliName - The CLI's binary name. Used for the per-user config dir, env-var prefix, and error messages.
 * @param input.envVarName - Override for the env-name env var. Defaults to `<CLINAME>_ENV` (e.g. `DEMO_CLI_ENV`).
 * @param input.defaultEnvs - Built-in env presets merged underneath the user's stored env when names match.
 * @returns A yargs `CommandModule` exposing the full `auth` subcommand surface.
 * @__NO_SIDE_EFFECTS__
 */
export function createAuthCommand(input: CreateAuthCommandInput): CommandModule {
  const cliName = input.cliName;
  const envVarName = input.envVarName ?? `${cliName.replaceAll('-', '_').toUpperCase()}_ENV`;
  const paths = buildCliPaths({ cliName });
  const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
  const defaultEnvs = input.defaultEnvs;

  // MARK: setup
  const setupCommand: CommandModule = {
    command: 'setup',
    describe: 'Persist OIDC client + API config for an env (interactive when flags are omitted)',
    builder: (yargs: Argv) =>
      withEnv(yargs)
        .option('api-base-url', { type: 'string', describe: 'API base URL (e.g. http://localhost:9902/.../api)' })
        .option('oidc-issuer', { type: 'string', describe: 'OIDC issuer URL (e.g. <api-base-url>/oidc)' })
        .option('app-client-url', { type: 'string', describe: 'Frontend client base URL to rebase the auth URL onto (e.g. http://localhost:9010)' })
        .option('client-id', { type: 'string', describe: 'OAuth client ID registered with the target app' })
        .option('client-secret', { type: 'string', describe: 'OAuth client secret' })
        .option('redirect-uri', { type: 'string', describe: 'OAuth redirect URI registered with the OAuth client' })
        .option('scopes', { type: 'string', describe: 'Space-separated OAuth scopes (default: openid profile email)' })
        .option('set-active', { type: 'boolean', default: false, describe: 'Also set the env as the active env after saving' }),
    handler: async (argv: any) => {
      try {
        const envName = (argv.env as string | undefined) ?? process.env[envVarName] ?? (await loadCliConfig({ configFilePath: paths.configFilePath }))?.activeEnv;

        if (!envName) {
          throw new CliError({ message: 'Provide --env <name> on first setup.', code: 'NO_ACTIVE_ENV' });
        }

        const stored = (await loadCliConfig({ configFilePath: paths.configFilePath }))?.envs?.[envName];
        const defaultEnv = findCliEnvDefault({ name: envName, defaults: defaultEnvs })?.env;
        const existing = mergeCliEnvWithDefault({ env: stored, defaultEnv });

        async function resolve(input: { argvValue: string | undefined; existingValue: string | undefined; prompt: string; mask?: boolean }): Promise<string | undefined> {
          const { argvValue, existingValue, prompt, mask } = input;
          if (argvValue) return argvValue;
          if (existingValue) return existingValue;
          const answer = (await promptLine({ question: prompt, mask })).trim();
          return answer.length > 0 ? answer : existingValue;
        }

        const apiBaseUrl = await resolve({ argvValue: argv.apiBaseUrl as string | undefined, existingValue: existing?.apiBaseUrl, prompt: `API base URL [${existing?.apiBaseUrl ?? ''}]: ` });
        const oidcIssuer = await resolve({ argvValue: argv.oidcIssuer as string | undefined, existingValue: existing?.oidcIssuer, prompt: `OIDC issuer [${existing?.oidcIssuer ?? ''}]: ` });
        const appClientUrl = (argv.appClientUrl as string | undefined) ?? existing?.appClientUrl;
        const clientId = await resolve({ argvValue: argv.clientId as string | undefined, existingValue: existing?.clientId, prompt: 'Client ID: ' });
        const clientSecret = await resolve({ argvValue: argv.clientSecret as string | undefined, existingValue: existing?.clientSecret, prompt: 'Client secret: ', mask: true });
        const redirectUri = (await resolve({ argvValue: argv.redirectUri as string | undefined, existingValue: existing?.redirectUri, prompt: `Redirect URI [${existing?.redirectUri ?? DEFAULT_CLI_REDIRECT_URI}]: ` })) ?? DEFAULT_CLI_REDIRECT_URI;
        const scopes = (argv.scopes as string | undefined) ?? existing?.scopes;

        if (!apiBaseUrl || !oidcIssuer || !clientId || !clientSecret) {
          throw new CliError({ message: 'apiBaseUrl, oidcIssuer, clientId, and clientSecret are all required.', code: 'AUTH_SETUP_INCOMPLETE' });
        }

        const nextEnv: CliEnvConfig = { apiBaseUrl, oidcIssuer, clientId, clientSecret, redirectUri, ...(appClientUrl ? { appClientUrl } : {}), ...(scopes ? { scopes } : {}) };

        const merged = await mergeCliConfig({
          configFilePath: paths.configFilePath,
          configDir: paths.configDir,
          updates: {
            envs: { [envName]: nextEnv },
            ...(argv.setActive ? { activeEnv: envName } : {})
          }
        });

        outputResult({
          saved: true,
          env: envName,
          activeEnv: merged.activeEnv,
          config: maskEnv(nextEnv)
        });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  // MARK: login
  const loginCommand: CommandModule = {
    command: 'login',
    describe: 'Run OIDC PKCE flow and persist tokens for the active env',
    builder: (yargs: Argv) =>
      withEnv(yargs)
        .option('open', { type: 'boolean', default: false, describe: 'Print the auth URL only (does not auto-open a browser)' })
        .option('code', { type: 'string', describe: 'Skip the prompt and pass the redirect URL or bare code directly' })
        .option('read-only-scopes', { type: 'boolean', default: false, describe: 'Drop model.create/model.update/model.delete from the requested scopes (keeps model.read and model.query)' })
        .option('login-for', { type: 'string', describe: 'Requested login duration with a unit (e.g. 30d, 12h, 3600s). Mixed units are allowed (e.g. "1h30m", "2d 12h"). Subject to server/client caps. Applied to Session, Grant, and RefreshToken.' }),
    handler: async (argv: any) => {
      try {
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env, defaultEnvs });

        if (!isCliEnvConfigComplete(env)) {
          throw new CliError({
            message: `Env "${envName}" is missing OIDC fields. Run \`${cliName} auth setup --env ${envName}\` first.`,
            code: 'AUTH_ENV_INCOMPLETE'
          });
        }

        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        const { codeVerifier, codeChallenge } = await generatePkceMaterial();
        const state = generateOAuthState();
        const requestedScopes = argv.readOnlyScopes ? filterReadOnlyModelScopes(env.scopes) : env.scopes;

        let requestedSessionTtlSeconds: number | undefined;

        if (argv.loginFor) {
          const ms = durationDataToMilliseconds(parseDurationString(argv.loginFor as string));

          if (ms <= 0) {
            throw new CliError({
              message: `--login-for: invalid duration "${argv.loginFor}". Use formats like "30d", "12h", "3600s", or mixed units like "1h30m" or "2d 12h".`,
              code: 'AUTH_LOGIN_FOR_INVALID'
            });
          }

          requestedSessionTtlSeconds = Math.floor(ms / MS_IN_SECOND);
        }

        const url = buildAuthorizationUrl({
          authorizationEndpoint: meta.authorization_endpoint,
          apiBaseUrl: env.apiBaseUrl,
          appClientUrl: env.appClientUrl,
          clientId: env.clientId,
          redirectUri: env.redirectUri,
          scopes: requestedScopes,
          state,
          codeChallenge,
          requestedSessionTtlSeconds
        });

        // The CLI never opens a browser itself — it prints the URL and reads the redirect back.
        // Emit the URL through a clearly-prefixed stderr line so JSON stdout stays parseable.
        process.stderr.write(`Authorization URL:\n  ${url}\n`);

        const pasted = (argv.code as string | undefined) ?? (await promptLine({ question: 'Paste redirect URL or code: ' }));
        const { code } = parsePastedRedirect({ pasted, expectedState: state });

        const tokenResponse = await exchangeAuthorizationCode({
          tokenEndpoint: meta.token_endpoint,
          clientId: env.clientId,
          clientSecret: env.clientSecret,
          redirectUri: env.redirectUri,
          code,
          codeVerifier
        });

        const expiresAt = Date.now() + (tokenResponse.expires_in ?? 0) * 1000;
        const entry: CliTokenEntry = {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          idToken: tokenResponse.id_token,
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope,
          expiresAt
        };

        await tokens.set(envName, entry);

        outputResult({
          loggedIn: true,
          env: envName,
          accessToken: maskSecret(entry.accessToken),
          refreshToken: entry.refreshToken ? maskSecret(entry.refreshToken) : undefined,
          tokenType: entry.tokenType,
          scope: entry.scope,
          expiresAt
        });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  // MARK: logout
  const logoutCommand: CommandModule = {
    command: 'logout',
    describe: 'Clear cached tokens for the active env, optionally revoking on the server',
    builder: (yargs: Argv) => withEnv(yargs).option('revoke', { type: 'boolean', default: false, describe: 'Call the OIDC revocation endpoint before clearing local tokens' }),
    handler: async (argv: any) => {
      try {
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env, defaultEnvs });
        const entry = await tokens.get(envName);

        if (argv.revoke && entry?.refreshToken && env.clientId && env.clientSecret) {
          try {
            const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });

            if (meta.revocation_endpoint) {
              await revokeToken({
                revocationEndpoint: meta.revocation_endpoint,
                clientId: env.clientId,
                clientSecret: env.clientSecret,
                token: entry.refreshToken,
                tokenTypeHint: 'refresh_token'
              });
            }
          } catch {
            // Best-effort revocation; clear local cache regardless.
          }
        }

        await tokens.remove(envName);
        outputResult({ loggedOut: true, env: envName });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  // MARK: status
  const statusCommand: CommandModule = {
    command: 'status',
    describe: 'Show whoami via /userinfo plus active env and token expiry',
    builder: (yargs: Argv) => withEnv(yargs),
    handler: async (argv: any) => {
      try {
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env, defaultEnvs });
        const entry = await tokens.get(envName);

        if (!entry) {
          outputResult({ env: envName, authenticated: false, suggestion: `Run: ${cliName} auth login --env ${envName}` });
          return;
        }

        const expired = isTokenExpired(entry);
        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        const userinfoEndpoint = meta.userinfo_endpoint;

        if (!userinfoEndpoint) {
          outputResult({ env: envName, authenticated: !expired, expiresAt: entry.expiresAt, expired, scope: entry.scope });
          return;
        }

        const claims = await fetchUserInfo({ userinfoEndpoint, accessToken: entry.accessToken });
        outputResult({
          env: envName,
          authenticated: !expired,
          expiresAt: entry.expiresAt,
          expired,
          scope: entry.scope,
          sub: claims.sub,
          claims
        });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  // MARK: show
  const showCommand: CommandModule = {
    command: 'show',
    describe: 'Print env config and cached token metadata (secrets masked)',
    builder: (yargs: Argv) => withEnv(yargs),
    handler: async (argv: any) => {
      try {
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env, defaultEnvs });
        const entry = await tokens.get(envName);

        outputResult({
          env: envName,
          config: maskEnv(env),
          token: entry
            ? {
                accessToken: maskSecret(entry.accessToken),
                refreshToken: entry.refreshToken ? maskSecret(entry.refreshToken) : undefined,
                tokenType: entry.tokenType,
                scope: entry.scope,
                expiresAt: entry.expiresAt,
                expired: isTokenExpired(entry)
              }
            : null
        });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  // MARK: check
  const checkCommand: CommandModule = {
    command: 'check',
    describe: 'Verify the cached refresh token is still valid by performing a refresh round-trip',
    builder: (yargs: Argv) => withEnv(yargs),
    handler: async (argv: any) => {
      try {
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env, defaultEnvs });
        const entry = await tokens.get(envName);

        if (!entry?.refreshToken) {
          throw new CliError({
            message: `No refresh token for env "${envName}". Run \`${cliName} auth login --env ${envName}\`.`,
            code: 'NO_REFRESH_TOKEN'
          });
        }

        if (!isCliEnvConfigComplete(env)) {
          throw new CliError({
            message: `Env "${envName}" is missing OIDC fields. Run \`${cliName} auth setup --env ${envName}\` first.`,
            code: 'AUTH_ENV_INCOMPLETE'
          });
        }

        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        const refreshed = await refreshAccessToken({
          tokenEndpoint: meta.token_endpoint,
          clientId: env.clientId,
          clientSecret: env.clientSecret,
          refreshToken: entry.refreshToken
        });

        const expiresAt = Date.now() + (refreshed.expires_in ?? 0) * 1000;
        await tokens.set(envName, {
          ...entry,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? entry.refreshToken,
          tokenType: refreshed.token_type ?? entry.tokenType,
          scope: refreshed.scope ?? entry.scope,
          expiresAt
        });

        outputResult({ env: envName, refreshed: true, expiresAt });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  return {
    command: 'auth',
    describe: 'Manage OIDC authentication for the active env',
    builder: (yargs: Argv) => yargs.command(setupCommand).command(loginCommand).command(logoutCommand).command(statusCommand).command(showCommand).command(checkCommand).demandCommand(1, 'Specify an auth subcommand.'),
    handler: noop
  };
}
