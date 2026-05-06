import type { Argv, CommandModule } from 'yargs';
import { type CliConfig, loadCliConfig, mergeCliConfig, maskSecret, saveCliConfig } from '../config/cli.config';
import { type CliEnvConfig } from '../config/env';
import { buildCliPaths } from '../config/paths';
import { createCliTokenCacheStore } from '../config/token.cache';
import { CliError, outputError, outputResult } from '../util/output';
import { noop } from '../util/noop';

export interface CreateEnvCommandInput {
  readonly cliName: string;
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

export function createEnvCommand(input: CreateEnvCommandInput): CommandModule {
  const paths = buildCliPaths({ cliName: input.cliName });
  const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });

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
          envs: Object.entries(envs).map(([name, env]) => ({ name, active: name === config.activeEnv, ...maskEnv(env) }))
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
    describe: 'Create a new empty env (then run `auth setup --env <name>`)',
    builder: (yargs: Argv) => yargs.positional('name', { type: 'string', demandOption: true }).option('api-base-url', { type: 'string' }).option('oidc-issuer', { type: 'string' }).option('redirect-uri', { type: 'string' }).option('set-active', { type: 'boolean', default: false }),
    handler: async (argv: any) => {
      try {
        const env: CliEnvConfig = {
          apiBaseUrl: argv.apiBaseUrl ?? '',
          oidcIssuer: argv.oidcIssuer ?? '',
          redirectUri: argv.redirectUri
        };

        const merged = await mergeCliConfig({
          configFilePath: paths.configFilePath,
          configDir: paths.configDir,
          updates: {
            envs: { [argv.name]: env },
            ...(argv.setActive ? { activeEnv: argv.name } : {})
          }
        });

        outputResult({ added: argv.name, activeEnv: merged.activeEnv, env: maskEnv(env) });
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

        const env = config.envs?.[name];

        if (!env) {
          throw new CliError({ message: `Env "${name}" is not configured.`, code: 'ENV_NOT_FOUND' });
        }

        outputResult({ name, active: name === config.activeEnv, ...maskEnv(env) });
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
        await tokens.remove(argv.name);

        outputResult({ removed: argv.name, activeEnv: nextActive });
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
