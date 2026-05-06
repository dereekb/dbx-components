import type { Argv, CommandModule } from 'yargs';
import { type Maybe } from '@dereekb/util';
import { type CliConfig, loadCliConfig, maskSecret, mergeCliConfig } from '../config/cli.config';
import { type CliEnvConfig, applyEnvVarOverrides, isCliEnvConfigComplete } from '../config/env';
import { type CliPaths, buildCliPaths } from '../config/paths';
import { type CliTokenEntry, createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { discoverOidcMetadata, exchangeAuthorizationCode, fetchUserInfo, refreshAccessToken, revokeToken } from './oidc.client';
import { buildAuthorizationUrl, generateOAuthState, generatePkceMaterial, parsePastedRedirect } from './oidc.flow';
import { CliError, outputError, outputResult } from '../util/output';
import { promptLine } from '../util/interactive';
import { noop } from '../util/noop';
import { withEnv } from '../util/args';

export interface CreateAuthCommandInput {
  readonly cliName: string;
  /**
   * The env var name used to resolve the active env when no flag is provided.
   *
   * Conventionally `<CLINAME>_ENV` (e.g. `DEMO_CLI_ENV`).
   */
  readonly envVarName?: string;
}

interface ResolveEnvInput {
  readonly paths: CliPaths;
  readonly cliName: string;
  readonly envVarName: string;
  readonly flagEnv: Maybe<string>;
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
  const env = applyEnvVarOverrides({ cliName: input.cliName, env: stored });

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
    clientId: env.clientId ? maskSecret(env.clientId) : undefined,
    clientSecret: env.clientSecret ? maskSecret(env.clientSecret) : undefined,
    redirectUri: env.redirectUri,
    scopes: env.scopes
  };
}

export function createAuthCommand(input: CreateAuthCommandInput): CommandModule {
  const cliName = input.cliName;
  const envVarName = input.envVarName ?? `${cliName.replaceAll('-', '_').toUpperCase()}_ENV`;
  const paths = buildCliPaths({ cliName });
  const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });

  // MARK: setup
  const setupCommand: CommandModule = {
    command: 'setup',
    describe: 'Persist OIDC client + API config for an env (interactive when flags are omitted)',
    builder: (yargs: Argv) =>
      withEnv(yargs)
        .option('api-base-url', { type: 'string', describe: 'API base URL (e.g. http://localhost:9902/.../api)' })
        .option('oidc-issuer', { type: 'string', describe: 'OIDC issuer URL (e.g. <api-base-url>/oidc)' })
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

        const existing = (await loadCliConfig({ configFilePath: paths.configFilePath }))?.envs?.[envName];

        async function resolve(argvValue: string | undefined, existingValue: string | undefined, prompt: string, options?: { mask?: boolean }): Promise<string | undefined> {
          if (argvValue) return argvValue;
          if (existingValue) return existingValue;
          const answer = (await promptLine({ question: prompt, mask: options?.mask })).trim();
          return answer.length > 0 ? answer : existingValue;
        }

        const apiBaseUrl = await resolve(argv.apiBaseUrl as string | undefined, existing?.apiBaseUrl, `API base URL [${existing?.apiBaseUrl ?? ''}]: `);
        const oidcIssuer = await resolve(argv.oidcIssuer as string | undefined, existing?.oidcIssuer, `OIDC issuer [${existing?.oidcIssuer ?? ''}]: `);
        const clientId = await resolve(argv.clientId as string | undefined, existing?.clientId, 'Client ID: ');
        const clientSecret = await resolve(argv.clientSecret as string | undefined, existing?.clientSecret, 'Client secret: ', { mask: true });
        const redirectUri = (await resolve(argv.redirectUri as string | undefined, existing?.redirectUri, `Redirect URI [${existing?.redirectUri ?? 'urn:ietf:wg:oauth:2.0:oob'}]: `)) ?? 'urn:ietf:wg:oauth:2.0:oob';
        const scopes = (argv.scopes as string | undefined) ?? existing?.scopes;

        if (!apiBaseUrl || !oidcIssuer || !clientId || !clientSecret) {
          throw new CliError({ message: 'apiBaseUrl, oidcIssuer, clientId, and clientSecret are all required.', code: 'AUTH_SETUP_INCOMPLETE' });
        }

        const nextEnv: CliEnvConfig = { apiBaseUrl, oidcIssuer, clientId, clientSecret, redirectUri, ...(scopes ? { scopes } : {}) };

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
    builder: (yargs: Argv) => withEnv(yargs).option('open', { type: 'boolean', default: false, describe: 'Print the auth URL only (does not auto-open a browser)' }).option('code', { type: 'string', describe: 'Skip the prompt and pass the redirect URL or bare code directly' }),
    handler: async (argv: any) => {
      try {
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env });

        if (!isCliEnvConfigComplete(env)) {
          throw new CliError({
            message: `Env "${envName}" is missing OIDC fields. Run \`${cliName} auth setup --env ${envName}\` first.`,
            code: 'AUTH_ENV_INCOMPLETE'
          });
        }

        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        const { codeVerifier, codeChallenge } = await generatePkceMaterial();
        const state = generateOAuthState();

        const url = buildAuthorizationUrl({
          authorizationEndpoint: meta.authorization_endpoint,
          clientId: env.clientId,
          redirectUri: env.redirectUri,
          scopes: env.scopes,
          state,
          codeChallenge
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
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env });
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
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env });
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
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env });
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
        const { envName, env } = await resolveEnvOrThrow({ paths, cliName, envVarName, flagEnv: argv.env });
        const entry = await tokens.get(envName);

        if (!entry?.refreshToken) {
          throw new CliError({
            message: `No refresh token for env "${envName}". Run \`${cliName} auth login --env ${envName}\`.`,
            code: 'NO_REFRESH_TOKEN'
          });
        }

        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        const refreshed = await refreshAccessToken({
          tokenEndpoint: meta.token_endpoint,
          clientId: env.clientId!,
          clientSecret: env.clientSecret!,
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
