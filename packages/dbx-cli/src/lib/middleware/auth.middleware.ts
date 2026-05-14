import type { MiddlewareFunction } from 'yargs';
import { type CliConfig, loadCliConfig } from '../config/cli.config';
import { type CliEnvDefault, applyEnvVarOverrides, findCliEnvDefault, isCliEnvConfigComplete, mergeCliEnvWithDefault } from '../config/env';
import { buildCliPaths } from '../config/paths';
import { type CliTokenEntry, createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { discoverOidcMetadata, refreshAccessToken } from '../auth/oidc.client';
import { type CliContext, createCliContext, setCliContext } from '../context/cli.context';
import { type CliModelManifest } from '../manifest/types';
import { CliError, outputError } from '../util/output';

export interface CreateAuthMiddlewareInput {
  readonly cliName: string;
  /**
   * Top-level command names that bypass authentication entirely.
   *
   * Conventionally: `auth`, `env`, `doctor`, plus any other config/utility commands.
   */
  readonly skipCommands: ReadonlySet<string>;
  /**
   * Built-in env presets. Merged underneath the user's stored env when the env name matches.
   */
  readonly defaultEnvs?: readonly CliEnvDefault[];
  /**
   * Optional generated model manifest. When supplied, attached to the `CliContext` so commands
   * can resolve `prefix/id` keys to a `modelType` via `decodeFirestoreModelKey`.
   */
  readonly modelManifest?: CliModelManifest;
}

/**
 * Yargs middleware that resolves the active env, loads/refreshes its access token, and attaches
 * a {@link CliContext} via the module-level slot.
 *
 * Skips auth for the configured top-level commands so `auth login`, `env list`, etc. don't require
 * a valid token.
 *
 * @param input - Middleware configuration.
 * @param input.cliName - The CLI's binary name (used to derive the env-var prefix and config dir).
 * @param input.skipCommands - Top-level command names that bypass authentication entirely.
 * @param input.defaultEnvs - Built-in env presets merged underneath the user's stored env when names match.
 * @returns A yargs middleware function suitable for `.middleware([..., true])`.
 * @__NO_SIDE_EFFECTS__
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

      const defaultEnv = findCliEnvDefault({ name: envName, defaults: input.defaultEnvs })?.env;
      const merged = mergeCliEnvWithDefault({ env: config?.envs?.[envName], defaultEnv });
      const env = applyEnvVarOverrides({ cliName: input.cliName, env: merged });

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

      setCliContext(createCliContext({ cliName: input.cliName, envName, env, accessToken: entry.accessToken, modelManifest: input.modelManifest }));
    } catch (e) {
      outputError(e);
      process.exit(4);
    }
  };
}

/**
 * Test-only middleware that skips OIDC discovery, disk token loading, and token refresh, attaching
 * a pre-built {@link CliContext} directly via {@link setCliContext}.
 *
 * @internal Intended for use by `@dereekb/dbx-cli/test`. Not for production wiring.
 *
 * @param input - The pre-built context to attach on every invocation.
 * @param input.cliContext - The {@link CliContext} that will be attached via {@link setCliContext}.
 * @returns A yargs middleware function that always sets the provided context.
 * @__NO_SIDE_EFFECTS__
 */
export function createPassthroughAuthMiddleware(input: { readonly cliContext: CliContext }): MiddlewareFunction {
  return () => {
    setCliContext(input.cliContext);
  };
}
