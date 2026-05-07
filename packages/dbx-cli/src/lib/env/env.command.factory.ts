import type { Argv, CommandModule } from 'yargs';
import { type Maybe, noop } from '@dereekb/util';
import { type CliConfig, loadCliConfig, mergeCliConfig, maskSecret, saveCliConfig } from '../config/cli.config';
import { type CliEnvConfig, type CliEnvDefault, findCliEnvDefault, mergeCliEnvWithDefault } from '../config/env';
import { buildCliPaths } from '../config/paths';
import { createCliTokenCacheStore } from '../config/token.cache';
import { CliError, outputError, outputResult } from '../util/output';

export interface CreateEnvCommandInput {
  readonly cliName: string;
  /**
   * Built-in env presets. Resolved by env name and merged underneath the user's stored config so
   * `env list` / `env show` / `env add` reflect the effective config.
   */
  readonly defaultEnvs?: readonly CliEnvDefault[];
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

interface ResolveEnvWithDefaultInput {
  readonly name: string;
  readonly storedEnv?: CliEnvConfig;
  readonly defaultEnvs?: readonly CliEnvDefault[];
}

interface ResolvedEnvWithDefault {
  readonly env: CliEnvConfig;
  readonly defaultName?: string;
}

function resolveEnvWithDefault(input: ResolveEnvWithDefaultInput): Maybe<ResolvedEnvWithDefault> {
  const def = findCliEnvDefault({ name: input.name, defaults: input.defaultEnvs });
  const env = mergeCliEnvWithDefault({ env: input.storedEnv, defaultEnv: def?.env });
  let result: Maybe<ResolvedEnvWithDefault>;

  if (env) {
    result = { env, defaultName: def?.names[0] };
  }

  return result;
}

/**
 * Factory for the built-in `env` command tree.
 *
 * Wires `list`, `use`, `add`, `show`, and `remove` subcommands that operate on the persisted env
 * registry. Token-cache entries are removed when an env is deleted.
 *
 * @param input - Factory configuration.
 * @param input.cliName - The CLI's binary name.
 * @param input.defaultEnvs - Built-in env presets merged underneath the user's stored env when names match.
 * @returns A yargs `CommandModule` exposing the full `env` subcommand surface.
 */
export function createEnvCommand(input: CreateEnvCommandInput): CommandModule {
  const paths = buildCliPaths({ cliName: input.cliName });
  const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
  const defaultEnvs = input.defaultEnvs;

  const listCommand: CommandModule = {
    command: 'list',
    describe: 'List configured envs',
    builder: (yargs: Argv) => yargs,
    handler: async () => {
      try {
        const config = (await loadCliConfig({ configFilePath: paths.configFilePath })) ?? {};
        const envs = config.envs ?? {};

        outputResult({
          activeEnv: config.activeEnv,
          envs: Object.entries(envs).map(([name, env]) => {
            const resolved = resolveEnvWithDefault({ name, storedEnv: env, defaultEnvs });
            return { name, active: name === config.activeEnv, ...(resolved?.defaultName ? { default: resolved.defaultName } : {}), ...maskEnv(resolved?.env ?? env) };
          }),
          defaults: defaultEnvs?.map((d) => ({ names: d.names, ...maskEnv({ apiBaseUrl: '', oidcIssuer: '', ...d.env }) }))
        });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  const useCommand: CommandModule = {
    command: 'use <name>',
    describe: 'Set the active env',
    builder: (yargs: Argv) => yargs.positional('name', { type: 'string', demandOption: true }),
    handler: async (argv: any) => {
      try {
        const config = (await loadCliConfig({ configFilePath: paths.configFilePath })) ?? {};

        if (!config.envs?.[argv.name]) {
          throw new CliError({ message: `Env "${argv.name}" is not configured.`, code: 'ENV_NOT_FOUND' });
        }

        const merged = await mergeCliConfig({
          configFilePath: paths.configFilePath,
          configDir: paths.configDir,
          updates: { activeEnv: argv.name }
        });

        outputResult({ activeEnv: merged.activeEnv });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  const addCommand: CommandModule = {
    command: 'add <name>',
    describe: 'Create a new env (defaults are merged in if a matching default is registered; then run `auth setup --env <name>`)',
    builder: (yargs: Argv) => yargs.positional('name', { type: 'string', demandOption: true }).option('api-base-url', { type: 'string' }).option('oidc-issuer', { type: 'string' }).option('app-client-url', { type: 'string' }).option('redirect-uri', { type: 'string' }).option('set-active', { type: 'boolean', default: false }),
    handler: async (argv: any) => {
      try {
        const stored: CliEnvConfig = {
          apiBaseUrl: argv.apiBaseUrl ?? '',
          oidcIssuer: argv.oidcIssuer ?? '',
          appClientUrl: argv.appClientUrl,
          redirectUri: argv.redirectUri
        };

        const merged = await mergeCliConfig({
          configFilePath: paths.configFilePath,
          configDir: paths.configDir,
          updates: {
            envs: { [argv.name]: stored },
            ...(argv.setActive ? { activeEnv: argv.name } : {})
          }
        });

        const resolved = resolveEnvWithDefault({ name: argv.name, storedEnv: stored, defaultEnvs });

        outputResult({
          added: argv.name,
          activeEnv: merged.activeEnv,
          ...(resolved?.defaultName ? { default: resolved.defaultName } : {}),
          env: maskEnv(resolved?.env ?? stored)
        });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  const showCommand: CommandModule = {
    command: 'show [name]',
    describe: 'Show env config (defaults to active env)',
    builder: (yargs: Argv) => yargs.positional('name', { type: 'string' }),
    handler: async (argv: any) => {
      try {
        const config = (await loadCliConfig({ configFilePath: paths.configFilePath })) ?? {};
        const name = (argv.name as string | undefined) ?? config.activeEnv;

        if (!name) {
          throw new CliError({ message: 'No active env. Pass <name> or run `env use <name>`.', code: 'NO_ACTIVE_ENV' });
        }

        const stored = config.envs?.[name];
        const resolved = resolveEnvWithDefault({ name, storedEnv: stored, defaultEnvs });

        if (!resolved) {
          throw new CliError({ message: `Env "${name}" is not configured.`, code: 'ENV_NOT_FOUND' });
        }

        outputResult({
          name,
          active: name === config.activeEnv,
          ...(resolved.defaultName ? { default: resolved.defaultName } : {}),
          ...maskEnv(resolved.env)
        });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  const removeCommand: CommandModule = {
    command: 'remove <name>',
    describe: 'Delete an env and its cached tokens',
    builder: (yargs: Argv) => yargs.positional('name', { type: 'string', demandOption: true }),
    handler: async (argv: any) => {
      try {
        const config = (await loadCliConfig({ configFilePath: paths.configFilePath })) ?? {};

        if (!config.envs?.[argv.name]) {
          throw new CliError({ message: `Env "${argv.name}" is not configured.`, code: 'ENV_NOT_FOUND' });
        }

        const nextEnvs = { ...config.envs };
        delete nextEnvs[argv.name];
        const nextActive = config.activeEnv === argv.name ? undefined : config.activeEnv;
        const next: CliConfig = { ...config, envs: nextEnvs, activeEnv: nextActive };

        await saveCliConfig({ configFilePath: paths.configFilePath, configDir: paths.configDir, config: next });

        // Token deletion is best-effort: the env was already removed from the config so a
        // failure here would otherwise leave the command non-retryable (next run sees no env).
        // Surface the failure in the JSON envelope rather than logging to stderr, so it stays
        // in-band with the structured output the rest of the CLI emits.
        let tokenRemovalWarning: string | undefined;

        try {
          await tokens.remove(argv.name);
        } catch (e) {
          tokenRemovalWarning = `Failed to delete cached tokens for "${argv.name}": ${e instanceof Error ? e.message : String(e)}`;
        }

        outputResult({ removed: argv.name, activeEnv: nextActive, ...(tokenRemovalWarning ? { tokenRemovalWarning } : {}) });
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };

  return {
    command: 'env',
    describe: 'Manage CLI envs (named API + OIDC targets)',
    builder: (yargs: Argv) => yargs.command(listCommand).command(useCommand).command(addCommand).command(showCommand).command(removeCommand).demandCommand(1, 'Specify an env subcommand.'),
    handler: noop
  };
}
