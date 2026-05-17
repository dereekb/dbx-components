import { type Maybe } from '@dereekb/util';
import { readJsonFile, writeJsonFile } from '@dereekb/nestjs';
import { type CliEnvConfig } from './env';

/**
 * Returns a copy of the env config with the OAuth client id and secret masked via
 * {@link maskSecret}. The remaining URLs/scopes pass through untouched.
 *
 * Used by every command that surfaces an env to the user (`auth status`, `auth show`,
 * `env list`, `env show`, …) so secrets never end up in the JSON envelope.
 *
 * @param env - The env config to mask.
 * @returns A plain object suitable for the structured stdout envelope.
 * @__NO_SIDE_EFFECTS__
 */
export function maskEnv(env: CliEnvConfig): Record<string, unknown> {
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
 * Output settings that can be applied per-command.
 */
export interface CliCommandOutputConfig {
  readonly dumpDir?: string;
  readonly pick?: string;
}

/**
 * Output configuration with global defaults and optional per-command overrides.
 *
 * Command keys use dot-separated paths matching the yargs command hierarchy
 * (e.g. `call.profile.read`).
 */
export interface CliOutputConfig extends CliCommandOutputConfig {
  readonly commands?: Record<string, CliCommandOutputConfig>;
}

/**
 * The persisted shape of `<configDir>/config.json`.
 */
export interface CliConfig {
  readonly activeEnv?: string;
  readonly envs?: Record<string, CliEnvConfig>;
  readonly output?: CliOutputConfig;
}

export interface LoadCliConfigInput {
  readonly configFilePath: string;
}

/**
 * Loads the persisted CLI config from disk. Returns `undefined` when the file is missing.
 *
 * @param input - The load inputs.
 * @param input.configFilePath - Absolute path to the JSON config file.
 * @returns The parsed {@link CliConfig}, or `undefined` when the file does not exist.
 */
export function loadCliConfig(input: LoadCliConfigInput): Promise<Maybe<CliConfig>> {
  return readJsonFile<CliConfig>(input.configFilePath);
}

export interface SaveCliConfigInput extends LoadCliConfigInput {
  readonly configDir: string;
  readonly config: CliConfig;
}

/**
 * Writes the full {@link CliConfig} to disk, creating the parent directory if needed.
 *
 * @param input - The save inputs.
 * @param input.configFilePath - Absolute path to the JSON config file.
 * @param input.configDir - Absolute path to the config directory (created if missing).
 * @param input.config - The full config object to persist.
 * @returns Resolves once the file has been written.
 */
export function saveCliConfig(input: SaveCliConfigInput): Promise<void> {
  return writeJsonFile({ filePath: input.configFilePath, dirPath: input.configDir, data: input.config });
}

export interface MergeCliConfigInput extends Omit<SaveCliConfigInput, 'config'> {
  readonly updates: Partial<CliConfig>;
}

/**
 * Merges updates into the existing config and saves to disk.
 *
 * `envs` is shallow-merged so a partial env update preserves existing keys for other envs.
 * `output` is merged via {@link mergeOutputConfig}.
 *
 * @param input - The merge inputs.
 * @param input.configFilePath - Absolute path to the JSON config file.
 * @param input.configDir - Absolute path to the config directory (created if missing).
 * @param input.updates - The partial {@link CliConfig} to merge on top of the existing on-disk config.
 * @returns The merged {@link CliConfig} that was just written.
 */
export async function mergeCliConfig(input: MergeCliConfigInput): Promise<CliConfig> {
  const existing = (await loadCliConfig({ configFilePath: input.configFilePath })) ?? {};

  const merged: CliConfig = {
    activeEnv: input.updates.activeEnv ?? existing.activeEnv,
    envs: input.updates.envs ? { ...existing.envs, ...input.updates.envs } : existing.envs,
    output: input.updates.output === undefined ? existing.output : mergeOutputConfig(existing.output, input.updates.output)
  };

  await saveCliConfig({ configFilePath: input.configFilePath, configDir: input.configDir, config: merged });
  return merged;
}

/**
 * Merges a partial {@link CliOutputConfig} update on top of an existing config slice.
 *
 * Exported so downstream CLIs that nest the output config under a different config tree (e.g.
 * zoho-cli's `shared/recruit/crm/desk/output` shape) can reuse the same merge semantics for the
 * output sub-tree without forking the implementation.
 *
 * @param existing - The existing output config slice (or `null`/`undefined` if none was stored).
 * @param updates - The partial output config to merge on top.
 * @returns The merged {@link CliOutputConfig}.
 */
export function mergeOutputConfig(existing: Maybe<CliOutputConfig>, updates: CliOutputConfig): CliOutputConfig {
  return {
    dumpDir: 'dumpDir' in updates ? updates.dumpDir : existing?.dumpDir,
    pick: 'pick' in updates ? updates.pick : existing?.pick,
    commands: mergeOutputCommandsConfig(existing?.commands, updates)
  };
}

function mergeOutputCommandsConfig(existing: CliOutputConfig['commands'], updates: CliOutputConfig): CliOutputConfig['commands'] {
  let result: CliOutputConfig['commands'];
  if (!('commands' in updates)) {
    result = existing;
  } else if (!updates.commands) {
    result = undefined;
  } else {
    const merged: Record<string, CliCommandOutputConfig> = { ...existing };
    for (const key of Object.keys(updates.commands)) {
      merged[key] = { ...existing?.[key], ...updates.commands[key] };
    }
    result = merged;
  }
  return result;
}

export interface ResolveOutputConfigInput {
  readonly outputConfig: Maybe<CliOutputConfig>;
  readonly commandPath: string[];
  readonly cliFlags: { dumpDir?: string; pick?: string };
}

/**
 * Resolves output settings for a given command path.
 *
 * Resolution order (highest priority first):
 *   1. CLI flags (dumpDir, pick from argv)
 *   2. Per-command config (output.commands["call.profile.read"])
 *   3. Global output config (output.dumpDir, output.pick)
 *
 * @param input - The resolution inputs.
 * @param input.outputConfig - The persisted {@link CliOutputConfig} (or `null`/`undefined`).
 * @param input.commandPath - The yargs command-path segments (joined with `.` to look up per-command overrides).
 * @param input.cliFlags - Per-invocation overrides parsed from argv.
 * @returns The resolved `dumpDir` / `pick` pair to apply for this command.
 */
export function resolveOutputConfig(input: ResolveOutputConfigInput): { dumpDir?: string; pick?: string } {
  const commandKey = input.commandPath.join('.');
  const commandConfig = commandKey ? input.outputConfig?.commands?.[commandKey] : undefined;

  return {
    dumpDir: input.cliFlags.dumpDir ?? commandConfig?.dumpDir ?? input.outputConfig?.dumpDir,
    pick: input.cliFlags.pick ?? commandConfig?.pick ?? input.outputConfig?.pick
  };
}

/**
 * Masks a secret string by keeping the first 4 chars and replacing the rest with `***`.
 *
 * @param value - The string to mask. `null`/`undefined` are returned unchanged.
 * @returns The masked string (`***` when the input is 4 chars or shorter), or the input unchanged when nullish.
 */
export function maskSecret(value: Maybe<string>): Maybe<string> {
  let result: Maybe<string>;
  if (value == null) {
    result = value;
  } else if (value.length <= 4) {
    result = '***';
  } else {
    result = value.substring(0, 4) + '***';
  }
  return result;
}
