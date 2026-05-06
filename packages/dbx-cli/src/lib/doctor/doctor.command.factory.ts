import type { Argv, CommandModule } from 'yargs';
import { type Maybe } from '@dereekb/util';
import { type CliConfig, loadCliConfig } from '../config/cli.config';
import { type CliEnvConfig, applyEnvVarOverrides } from '../config/env';
import { buildCliPaths } from '../config/paths';
import { createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { discoverOidcMetadata, refreshAccessToken } from '../auth/oidc.client';
import { CALL_MODEL_API_PATH } from '../api/call-model.client';
import { outputError, outputResult } from '../util/output';
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
 */
export function defaultDoctorChecks(): DoctorCheck[] {
  return [
    async ({ config }) => ({ name: 'config-file-present', ok: !!config, ...(config ? {} : { suggestion: 'Run `<cli> auth setup --env <name>`.' }) }),
    async ({ envName, env }) => ({ name: 'active-env-resolved', ok: !!envName && !!env, detail: { envName }, ...(envName && env ? {} : { suggestion: 'Run `<cli> env add <name>` and `<cli> env use <name>`, or pass `--env <name>`.' }) }),
    async ({ env }) => {
      if (!env?.oidcIssuer) {
        return { name: 'oidc-issuer-set', ok: false, suggestion: 'Set `oidcIssuer` via `<cli> auth setup`.' };
      }

      try {
        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        return { name: 'oidc-discovery-reachable', ok: true, detail: { authorization_endpoint: meta.authorization_endpoint, token_endpoint: meta.token_endpoint } };
      } catch (e) {
        return { name: 'oidc-discovery-reachable', ok: false, detail: { error: e instanceof Error ? e.message : String(e) }, suggestion: 'Verify the env oidcIssuer URL and that the API is running.' };
      }
    },
    async ({ cliName, envName, env }) => {
      if (!envName || !env) {
        return { name: 'token-cache-fresh', ok: false, suggestion: 'No env to check.' };
      }

      const paths = buildCliPaths({ cliName });
      const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
      const entry = await tokens.get(envName);

      if (!entry) {
        return { name: 'token-cache-fresh', ok: false, suggestion: `Run \`${cliName} auth login --env ${envName}\`.` };
      }

      const expired = isTokenExpired(entry);
      return { name: 'token-cache-fresh', ok: !expired, detail: { expiresAt: entry.expiresAt, expired }, ...(expired ? { suggestion: `Run \`${cliName} auth check --env ${envName}\` to refresh.` } : {}) };
    },
    async ({ cliName, envName, env }) => {
      if (!envName || !env?.clientId || !env?.clientSecret) {
        return { name: 'token-refresh-round-trip', ok: false, suggestion: 'Env credentials are incomplete.' };
      }

      const paths = buildCliPaths({ cliName });
      const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
      const entry = await tokens.get(envName);

      if (!entry?.refreshToken) {
        return { name: 'token-refresh-round-trip', ok: false, suggestion: `Run \`${cliName} auth login --env ${envName}\`.` };
      }

      try {
        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        await refreshAccessToken({
          tokenEndpoint: meta.token_endpoint,
          clientId: env.clientId,
          clientSecret: env.clientSecret,
          refreshToken: entry.refreshToken
        });
        return { name: 'token-refresh-round-trip', ok: true };
      } catch (e) {
        return { name: 'token-refresh-round-trip', ok: false, detail: { error: e instanceof Error ? e.message : String(e) }, suggestion: `Run \`${cliName} auth login --env ${envName}\`.` };
      }
    },
    async ({ env }) => {
      if (!env?.apiBaseUrl) {
        return { name: 'api-base-url-reachable', ok: false, suggestion: 'Set `apiBaseUrl` via `<cli> auth setup`.' };
      }

      try {
        const url = `${env.apiBaseUrl.replace(/\/+$/, '')}${CALL_MODEL_API_PATH}`;
        // Probe with OPTIONS to avoid auth errors clouding reachability
        const res = await fetch(url, { method: 'OPTIONS' });
        return { name: 'api-base-url-reachable', ok: res.status < 500, detail: { status: res.status } };
      } catch (e) {
        return { name: 'api-base-url-reachable', ok: false, detail: { error: e instanceof Error ? e.message : String(e) }, suggestion: 'Verify the API is running at apiBaseUrl.' };
      }
    }
  ];
}

export interface CreateDoctorCommandInput {
  readonly cliName: string;
  /**
   * Additional checks to append after the default check list.
   */
  readonly checks?: DoctorCheck[];
}

/**
 * Composable doctor command.
 *
 * Runs all checks, prints a JSON summary, and exits 0 even when checks fail (the `ok` flag in the
 * envelope is what callers script against).
 */
export function createDoctorCommand(input: CreateDoctorCommandInput): CommandModule {
  const cliName = input.cliName;
  const checks: DoctorCheck[] = [...defaultDoctorChecks(), ...(input.checks ?? [])];

  return {
    command: 'doctor',
    describe: 'Run diagnostic checks for the active env',
    builder: (yargs: Argv) => withEnv(yargs),
    handler: async (argv: any) => {
      try {
        const paths = buildCliPaths({ cliName });
        const config = await loadCliConfig({ configFilePath: paths.configFilePath });
        const envName = (argv.env as string | undefined) ?? process.env[`${cliName.replaceAll('-', '_').toUpperCase()}_ENV`] ?? config?.activeEnv;
        const env = applyEnvVarOverrides({ cliName, env: envName ? config?.envs?.[envName] : undefined });

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
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };
}
