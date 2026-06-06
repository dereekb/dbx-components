import type { MiddlewareFunction } from 'yargs';
import { type CliEnvDefault, readEnvTokenEntry } from '../config/env';
import { type CliEnvConfigComplete, resolveCliEnvOrThrow } from '../config/env.resolve';
import { buildCliPaths } from '../config/paths';
import { type CliTokenEntry, createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { discoverOidcMetadata, refreshAccessToken } from '../auth/oidc.client';
import { type CliContext, createCliContext, setCliContext } from '../context/cli.context';
import { type CliModelManifest } from '../manifest/types';
import { CLI_EXIT_CODE_AUTH, CliError, outputError, setCliTimeoutMs, setCliVerbose } from '../util/output';

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

  return async (argv: any) => {
    // Configure verbose/timeout as early as possible so HTTP calls made from this very
    // middleware (OIDC discovery + token refresh) honor the flags.
    setCliVerbose(Boolean(argv.verbose));
    // No `--timeout` flag → undefined → the default timeout applies. `--timeout 0` disables it.
    setCliTimeoutMs(typeof argv.timeout === 'number' ? argv.timeout * 1000 : undefined);

    const command = argv._?.[0];

    if (typeof command === 'string' && input.skipCommands.has(command)) {
      return;
    }

    try {
      const { envName, env } = await resolveCliEnvOrThrow({
        cliName: input.cliName,
        paths,
        flagEnv: argv.env as string | undefined,
        defaultEnvs: input.defaultEnvs,
        requireComplete: true
      });

      const entry = await resolveAccessTokenEntry({ cliName: input.cliName, envName, env, tokens });

      setCliContext(createCliContext({ cliName: input.cliName, envName, env, accessToken: entry.accessToken, modelManifest: input.modelManifest }));
    } catch (e) {
      outputError(e);
      process.exit(CLI_EXIT_CODE_AUTH);
    }
  };
}

type CliTokenCacheStore = ReturnType<typeof createCliTokenCacheStore>;
// `requireComplete: true` is passed at the call site, so the resolved env is the narrowed, fully-populated shape.
type ResolvedCliEnv = CliEnvConfigComplete;

interface ResolveAccessTokenEntryInput {
  readonly cliName: string;
  readonly envName: string;
  readonly env: ResolvedCliEnv;
  readonly tokens: CliTokenCacheStore;
}

/**
 * Resolves the access-token entry for an env: prefers the cached token, falls
 * back to an env-supplied token, requires at least one token to be present,
 * and refreshes when the access token is missing or expired.
 *
 * @param input - The CLI name, resolved env, env name, and token cache store.
 * @returns The resolved (and refreshed when necessary) token entry.
 * @throws {CliError} When no tokens are available for the env.
 */
async function resolveAccessTokenEntry(input: ResolveAccessTokenEntryInput): Promise<CliTokenEntry> {
  const { cliName, envName, env, tokens } = input;

  // Cache always wins; fall back to env-supplied tokens only when nothing is cached so the
  // interactive flow is untouched. Env entries are flagged `fromEnv` and never written back.
  let entry: CliTokenEntry | undefined = (await tokens.get(envName)) ?? undefined;

  if (!entry) {
    entry = readEnvTokenEntry({ cliName }) ?? undefined;
  }

  if (!entry?.accessToken && !entry?.refreshToken) {
    throw new CliError({
      message: `No tokens for env "${envName}". Run \`${cliName} auth login --env ${envName}\`.`,
      code: 'NOT_LOGGED_IN'
    });
  }

  // Mint an access token when none is present (env refresh-only case) or the cached one is expired.
  if (!entry.accessToken || isTokenExpired(entry)) {
    entry = await refreshTokenEntry({ cliName, envName, env, tokens, entry });
  }

  return entry;
}

interface RefreshTokenEntryInput extends ResolveAccessTokenEntryInput {
  readonly entry: CliTokenEntry;
}

/**
 * Refreshes an absent/expired access token via OIDC. Cache-sourced entries are
 * persisted; env-sourced service tokens are durable for the one-shot
 * invocation and not written back (and a rotated env refresh token is warned
 * about, since it cannot be persisted).
 *
 * @param input - The CLI name, env, env name, token store, and the entry to refresh.
 * @returns The refreshed token entry.
 * @throws {CliError} When the entry is expired and has no refresh token.
 */
async function refreshTokenEntry(input: RefreshTokenEntryInput): Promise<CliTokenEntry> {
  const { cliName, envName, env, tokens, entry } = input;

  if (!entry.refreshToken) {
    throw new CliError({
      message: `Token for env "${envName}" is expired and no refresh token is cached. Re-login.`,
      code: 'TOKEN_EXPIRED',
      suggestion: `Run \`${cliName} auth login --env ${envName}\`.`
    });
  }

  const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
  const suppliedRefreshToken = entry.refreshToken;
  const refreshed = await refreshAccessToken({
    tokenEndpoint: meta.token_endpoint,
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    refreshToken: suppliedRefreshToken
  });

  const updated: CliTokenEntry = {
    ...entry,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? entry.refreshToken,
    tokenType: refreshed.token_type ?? entry.tokenType,
    scope: refreshed.scope ?? entry.scope,
    expiresAt: Date.now() + (refreshed.expires_in ?? 0) * 1000
  };

  if (updated.fromEnv) {
    // Service tokens do not rotate, so a one-shot env-sourced invocation is durable without
    // persisting. If a *rotating* refresh token was supplied, the rotation is lost on exit —
    // warn that env credentials should be non-rotating service tokens.
    if (refreshed.refresh_token != null && refreshed.refresh_token !== suppliedRefreshToken) {
      process.stderr.write('Warning: the refresh token supplied via environment rotated on use; the rotated token cannot be persisted for a one-shot invocation. Use a non-rotating service token (auth login --service-token).\n');
    }
  } else {
    await tokens.set(envName, updated);
  }

  return updated;
}

/**
 * Test-only middleware that skips OIDC discovery, disk token loading, and token refresh, attaching
 * a pre-built {@link CliContext} directly via {@link setCliContext}.
 *
 * @param input - The pre-built context to attach on every invocation.
 * @param input.cliContext - The {@link CliContext} that will be attached via {@link setCliContext}.
 * @returns A yargs middleware function that always sets the provided context.
 *
 * @internal Intended for use by `@dereekb/dbx-cli/test`. Not for production wiring.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createPassthroughAuthMiddleware(input: { readonly cliContext: CliContext }): MiddlewareFunction {
  return () => {
    setCliContext(input.cliContext);
  };
}
