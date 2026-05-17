import type { Argv, CommandModule } from 'yargs';
import { type Maybe } from '@dereekb/util';
import { type CliConfig } from '../config/cli.config';
import { type CliEnvConfig, type CliEnvDefault } from '../config/env';
import { resolveCliEnv } from '../config/env.resolve';
import { buildCliPaths } from '../config/paths';
import { createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { buildOidcDiscoveryCandidates, discoverOidcMetadata, refreshAccessToken } from '../auth/oidc.client';
import { CALL_MODEL_API_PATH } from '../api/call-model.client';
import { outputResult, tracedFetch } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { withEnv } from '../util/args';

export interface DoctorCheckInput {
  readonly cliName: string;
  readonly envName: Maybe<string>;
  readonly env: Maybe<CliEnvConfig>;
  readonly config: Maybe<CliConfig>;
}

export interface DoctorCheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: unknown;
  readonly suggestion?: string;
}

export type DoctorCheck = (input: DoctorCheckInput) => Promise<DoctorCheckResult>;

/**
 * Built-in checks: config file present, active env resolved, OIDC discovery, token refresh, API reachability.
 *
 * @returns The default {@link DoctorCheck} list, in execution order.
 */
export function defaultDoctorChecks(): DoctorCheck[] {
  return [
    async ({ config }) => ({ name: 'config-file-present', ok: !!config, ...(config ? {} : { suggestion: 'Run `<cli> auth setup --env <name>`.' }) }),
    async ({ envName, env }) => ({ name: 'active-env-resolved', ok: !!envName && !!env, detail: { envName }, ...(envName && env ? {} : { suggestion: 'Run `<cli> env add <name>` and `<cli> env use <name>`, or pass `--env <name>`.' }) }),
    async ({ env }) => {
      let result: DoctorCheckResult;
      if (!env?.oidcIssuer) {
        result = { name: 'oidc-issuer-set', ok: false, suggestion: 'Set `oidcIssuer` via `<cli> auth setup`.' };
      } else {
        const candidates = buildOidcDiscoveryCandidates({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });

        try {
          const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
          result = { name: 'oidc-discovery-reachable', ok: true, detail: { candidates, authorization_endpoint: meta.authorization_endpoint, token_endpoint: meta.token_endpoint } };
        } catch (e) {
          result = { name: 'oidc-discovery-reachable', ok: false, detail: { candidates, error: e instanceof Error ? e.message : String(e) }, suggestion: 'Verify the env oidcIssuer URL and that the API is running.' };
        }
      }
      return result;
    },
    async ({ cliName, envName, env }) => {
      let result: DoctorCheckResult;
      if (!envName || !env) {
        result = { name: 'token-cache-fresh', ok: false, suggestion: 'No env to check.' };
      } else {
        const paths = buildCliPaths({ cliName });
        const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
        const entry = await tokens.get(envName);

        if (!entry) {
          result = { name: 'token-cache-fresh', ok: false, suggestion: `Run \`${cliName} auth login --env ${envName}\`.` };
        } else {
          const expired = isTokenExpired(entry);
          result = { name: 'token-cache-fresh', ok: !expired, detail: { expiresAt: entry.expiresAt, expired }, ...(expired ? { suggestion: `Run \`${cliName} auth check --env ${envName}\` to refresh.` } : {}) };
        }
      }
      return result;
    },
    async ({ cliName, envName, env }) => {
      let result: DoctorCheckResult;
      if (!envName || !env?.clientId || !env?.clientSecret) {
        result = { name: 'token-refresh-round-trip', ok: false, suggestion: 'Env credentials are incomplete.' };
      } else {
        const paths = buildCliPaths({ cliName });
        const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
        const entry = await tokens.get(envName);

        if (!entry?.refreshToken) {
          result = {
            name: 'token-refresh-round-trip',
            ok: false,
            detail: { reason: 'no-refresh-token' },
            suggestion: `No refresh token cached for env "${envName}". Run \`${cliName} auth login --env ${envName}\` — if the env's scopes omit \`offline_access\`, the OIDC provider may not issue one.`
          };
        } else {
          try {
            const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
            await refreshAccessToken({
              tokenEndpoint: meta.token_endpoint,
              clientId: env.clientId,
              clientSecret: env.clientSecret,
              refreshToken: entry.refreshToken
            });
            result = { name: 'token-refresh-round-trip', ok: true };
          } catch (e) {
            result = { name: 'token-refresh-round-trip', ok: false, detail: { error: e instanceof Error ? e.message : String(e) }, suggestion: `Run \`${cliName} auth login --env ${envName}\`.` };
          }
        }
      }
      return result;
    },
    async ({ env }) => {
      let result: DoctorCheckResult;
      if (!env?.apiBaseUrl) {
        result = { name: 'api-base-url-reachable', ok: false, suggestion: 'Set `apiBaseUrl` via `<cli> auth setup`.' };
      } else {
        const url = `${env.apiBaseUrl.replace(/\/+$/, '')}${CALL_MODEL_API_PATH}`;

        try {
          // Probe with OPTIONS to avoid auth errors clouding reachability
          const res = await tracedFetch(undefined, url, { method: 'OPTIONS' });
          result = { name: 'api-base-url-reachable', ok: res.status < 500, detail: { url, status: res.status } };
        } catch (e) {
          result = { name: 'api-base-url-reachable', ok: false, detail: { url, error: e instanceof Error ? e.message : String(e) }, suggestion: 'Verify the API is running at apiBaseUrl.' };
        }
      }
      return result;
    }
  ];
}

export interface CreateDoctorCommandInput {
  readonly cliName: string;
  /**
   * Additional checks to append after the default check list.
   */
  readonly checks?: DoctorCheck[];
  /**
   * Built-in env presets. Resolved by env name and merged underneath the user's stored config so
   * doctor can run against an env that only stores overrides on top of a registered default.
   */
  readonly defaultEnvs?: readonly CliEnvDefault[];
}

/**
 * Composable doctor command.
 *
 * Runs all checks, prints a JSON summary, and exits 0 even when checks fail (the `ok` flag in the
 * envelope is what callers script against).
 *
 * @param input - Factory configuration.
 * @param input.cliName - The CLI's binary name.
 * @param input.checks - Additional checks to append after the default check list.
 * @param input.defaultEnvs - Built-in env presets merged underneath the user's stored env when names match.
 * @returns A yargs `CommandModule` exposing the `doctor` command.
 * @__NO_SIDE_EFFECTS__
 */
export function createDoctorCommand(input: CreateDoctorCommandInput): CommandModule {
  const cliName = input.cliName;
  const checks: DoctorCheck[] = [...defaultDoctorChecks(), ...(input.checks ?? [])];
  const defaultEnvs = input.defaultEnvs;

  const paths = buildCliPaths({ cliName });

  return {
    command: 'doctor',
    describe: 'Run diagnostic checks for the active env',
    builder: (yargs: Argv) => withEnv(yargs),
    handler: wrapCommandHandler(async (argv: any) => {
      const { config, envName, env } = await resolveCliEnv({ cliName, paths, flagEnv: argv.env, defaultEnvs });

      const checkInput: DoctorCheckInput = { cliName, envName, env, config };
      const results: DoctorCheckResult[] = [];

      for (const check of checks) {
        try {
          results.push(await check(checkInput));
        } catch (e) {
          results.push({ name: 'check-threw', ok: false, detail: { error: e instanceof Error ? e.message : String(e) } });
        }
      }

      const allOk = results.every((r) => r.ok);
      outputResult({ allOk, env: envName, checks: results });
    })
  };
}
