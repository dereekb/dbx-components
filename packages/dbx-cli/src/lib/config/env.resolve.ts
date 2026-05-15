import { type Maybe } from '@dereekb/util';
import { type CliConfig, loadCliConfig } from './cli.config';
import { type CliEnvConfig, type CliEnvDefault, applyEnvVarOverrides, findCliEnvDefault, isCliEnvConfigComplete, mergeCliEnvWithDefault } from './env';
import { type CliPaths } from './paths';
import { CliError } from '../util/output';

/**
 * The narrowed env shape returned by {@link resolveCliEnvOrThrow} when `requireComplete: true`.
 *
 * Guarantees that the OIDC client fields are present so callers can pass them through to the
 * OIDC client/token helpers without a non-null assertion or extra runtime check.
 */
export type CliEnvConfigComplete = Required<Pick<CliEnvConfig, 'apiBaseUrl' | 'oidcIssuer' | 'clientId' | 'clientSecret' | 'redirectUri'>> & CliEnvConfig;

/**
 * Builds the conventional `<CLINAME>_ENV` env var name from the CLI binary name.
 *
 * Example: `demo-cli` → `DEMO_CLI_ENV`.
 *
 * @param cliName - The CLI's binary name (typically a kebab-case slug).
 * @returns The uppercased, underscored env var name used to override the active env.
 * @__NO_SIDE_EFFECTS__
 */
export function getCliEnvVarName(cliName: string): string {
  return `${cliName.replaceAll('-', '_').toUpperCase()}_ENV`;
}

export interface ResolveCliEnvInput {
  readonly cliName: string;
  readonly paths: CliPaths;
  /**
   * Value passed via `--env <name>` (highest priority).
   */
  readonly flagEnv?: Maybe<string>;
  /**
   * Optional override for the env-name env var. Defaults to {@link getCliEnvVarName}(cliName).
   */
  readonly envVarName?: string;
  /**
   * Optional built-in env presets merged underneath the user's stored env when names match.
   */
  readonly defaultEnvs?: readonly CliEnvDefault[];
}

export interface ResolveCliEnvResult {
  /**
   * The loaded persisted CLI config (possibly empty when no config has been saved yet).
   */
  readonly config: CliConfig;
  /**
   * The resolved active env name from flag/env-var/active default, or `undefined` when none.
   */
  readonly envName: Maybe<string>;
  /**
   * The merged env config (stored env + default + env-var overrides), or `undefined` when
   * neither the stored env nor any defaults/overrides cover this name.
   */
  readonly env: Maybe<CliEnvConfig>;
}

/**
 * Resolves the active env for a CLI invocation in one call.
 *
 * Performs the env-resolution dance that every per-env command needs:
 *   1. Load `<configDir>/config.json` (may be missing — returns `{}` in that case).
 *   2. Resolve env name: `flagEnv` → `process.env[<CLINAME>_ENV]` → `config.activeEnv`.
 *   3. Look up the stored env block (may be missing).
 *   4. Merge with the matching {@link CliEnvDefault} (when one is registered).
 *   5. Overlay `<CLINAME>_*` env var overrides.
 *
 * Non-throwing: returns `{ env: undefined, envName: undefined }` when the user has not
 * configured anything. Use {@link resolveCliEnvOrThrow} for the "command requires an env"
 * variant.
 *
 * @param input - Resolution inputs.
 * @returns The resolved env triple.
 */
export async function resolveCliEnv(input: ResolveCliEnvInput): Promise<ResolveCliEnvResult> {
  const config = (await loadCliConfig({ configFilePath: input.paths.configFilePath })) ?? {};
  const envVarName = input.envVarName ?? getCliEnvVarName(input.cliName);
  const envName = input.flagEnv ?? process.env[envVarName] ?? config.activeEnv;

  const stored = envName ? config.envs?.[envName] : undefined;
  const defaultEnv = envName ? findCliEnvDefault({ name: envName, defaults: input.defaultEnvs })?.env : undefined;
  const merged = mergeCliEnvWithDefault({ env: stored, defaultEnv });
  const env = applyEnvVarOverrides({ cliName: input.cliName, env: merged });

  return { config, envName, env };
}

export interface ResolveCliEnvOrThrowInput extends ResolveCliEnvInput {
  /**
   * When `true`, throws `AUTH_ENV_INCOMPLETE` if the resolved env is missing OIDC fields
   * (apiBaseUrl, oidcIssuer, clientId, clientSecret, redirectUri). The returned env is narrowed
   * to {@link CliEnvConfigComplete}. Defaults to `false`.
   */
  readonly requireComplete?: boolean;
}

export interface ResolveCliEnvOrThrowResult<E extends CliEnvConfig = CliEnvConfig> {
  readonly config: CliConfig;
  readonly envName: string;
  readonly env: E;
}

/**
 * Throwing variant of {@link resolveCliEnv}.
 *
 *  - Throws `NO_ACTIVE_ENV` when neither `--env`, the env var, nor `activeEnv` resolves.
 *  - Throws `ENV_NOT_FOUND` when the resolved name has no stored config and no matching default.
 *  - Throws `AUTH_ENV_INCOMPLETE` when `requireComplete` is set and OIDC fields are missing.
 *
 * @param input - Resolution inputs (with optional `requireComplete`).
 * @returns The resolved env triple with `envName` and `env` guaranteed present. When
 *   `requireComplete` is `true`, `env` is narrowed to {@link CliEnvConfigComplete}.
 */
export async function resolveCliEnvOrThrow(input: ResolveCliEnvOrThrowInput & { readonly requireComplete: true }): Promise<ResolveCliEnvOrThrowResult<CliEnvConfigComplete>>;
export async function resolveCliEnvOrThrow(input: ResolveCliEnvOrThrowInput): Promise<ResolveCliEnvOrThrowResult>;
export async function resolveCliEnvOrThrow(input: ResolveCliEnvOrThrowInput): Promise<ResolveCliEnvOrThrowResult> {
  const { config, envName, env } = await resolveCliEnv(input);

  if (!envName) {
    throw new CliError({
      message: 'No env selected. Run `<cli> env add <name>` and `<cli> env use <name>`, or pass `--env <name>`.',
      code: 'NO_ACTIVE_ENV'
    });
  }

  if (!env) {
    throw new CliError({
      message: `Env "${envName}" is not configured. Run \`${input.cliName} auth setup --env ${envName}\`.`,
      code: 'ENV_NOT_FOUND'
    });
  }

  if (input.requireComplete && !isCliEnvConfigComplete(env)) {
    throw new CliError({
      message: `Env "${envName}" is missing OIDC fields. Run \`${input.cliName} auth setup --env ${envName}\` first.`,
      code: 'AUTH_ENV_INCOMPLETE'
    });
  }

  return { config, envName, env };
}
