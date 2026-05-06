import type { MiddlewareFunction } from 'yargs';
import { type CliConfig, loadCliConfig } from '../config/cli.config';
import { applyEnvVarOverrides, isCliEnvConfigComplete } from '../config/env';
import { buildCliPaths } from '../config/paths';
import { type CliTokenEntry, createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { discoverOidcMetadata, refreshAccessToken } from '../auth/oidc.client';
import { createCliContext, setCliContext } from '../context/cli.context';
import { CliError, outputError } from '../util/output';

export interface CreateAuthMiddlewareInput {
  readonly cliName: string;
  /**
   * Top-level command names that bypass authentication entirely.
   *
   * Conventionally: `auth`, `env`, `doctor`, plus any other config/utility commands.
   */
  readonly skipCommands: ReadonlySet<string>;
}

/**
 * Yargs middleware that resolves the active env, loads/refreshes its access token, and attaches
 * a {@link CliContext} via the module-level slot.
 *
 * Skips auth for the configured top-level commands so `auth login`, `env list`, etc. don't require
 * a valid token.
 */
export function createAuthMiddleware(input: CreateAuthMiddlewareInput): MiddlewareFunction {
  const paths = buildCliPaths({ cliName: input.cliName });
  const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
  const envVarName = `${input.cliName.replaceAll('-', '_').toUpperCase()}_ENV`;

  return async (argv: any) => {
    const command = argv._?.[0];

    if (typeof command === 'string' && input.skipCommands.has(command)) {
      return;
    }

    try {
      const config: CliConfig | undefined = (await loadCliConfig({ configFilePath: paths.configFilePath })) ?? undefined;
      const envName = (argv.env as string | undefined) ?? process.env[envVarName] ?? config?.activeEnv;

      if (!envName) {
        throw new CliError({
          message: `No env selected. Run \`${input.cliName} env add <name>\` and \`${input.cliName} env use <name>\`, or pass \`--env <name>\`.`,
          code: 'NO_ACTIVE_ENV'
        });
      }

      const env = applyEnvVarOverrides({ cliName: input.cliName, env: config?.envs?.[envName] });

      if (!isCliEnvConfigComplete(env)) {
        throw new CliError({
          message: `Env "${envName}" is missing fields. Run \`${input.cliName} auth setup --env ${envName}\`.`,
          code: 'AUTH_ENV_INCOMPLETE'
        });
      }

      let entry: CliTokenEntry | undefined = (await tokens.get(envName)) ?? undefined;

      if (!entry?.accessToken) {
        throw new CliError({
          message: `No tokens for env "${envName}". Run \`${input.cliName} auth login --env ${envName}\`.`,
          code: 'NOT_LOGGED_IN'
        });
      }

      if (isTokenExpired(entry)) {
        if (!entry.refreshToken) {
          throw new CliError({
            message: `Token for env "${envName}" is expired and no refresh token is cached. Re-login.`,
            code: 'TOKEN_EXPIRED',
            suggestion: `Run \`${input.cliName} auth login --env ${envName}\`.`
          });
        }

        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        const refreshed = await refreshAccessToken({
          tokenEndpoint: meta.token_endpoint,
          clientId: env.clientId,
          clientSecret: env.clientSecret,
          refreshToken: entry.refreshToken
        });

        entry = {
          ...entry,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? entry.refreshToken,
          tokenType: refreshed.token_type ?? entry.tokenType,
          scope: refreshed.scope ?? entry.scope,
          expiresAt: Date.now() + (refreshed.expires_in ?? 0) * 1000
        };
        await tokens.set(envName, entry);
      }

      setCliContext(createCliContext({ cliName: input.cliName, envName, env, accessToken: entry.accessToken }));
    } catch (e) {
      outputError(e);
      process.exit(4);
    }
  };
}
