import { type Maybe } from '@dereekb/util';
import { readJsonFile, writeJsonFile } from '@dereekb/nestjs';
import { type CliEnvConfig } from './env';

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
 */
export function loadCliConfig(input: LoadCliConfigInput): Promise<Maybe<CliConfig>> {
  return readJsonFile<CliConfig>(input.configFilePath);
}

export interface SaveCliConfigInput extends LoadCliConfigInput {
  readonly configDir: string;
  readonly config: CliConfig;
}

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
 */
export function mergeOutputConfig(existing: Maybe<CliOutputConfig>, updates: CliOutputConfig): CliOutputConfig {
  return {
    dumpDir: 'dumpDir' in updates ? updates.dumpDir : existing?.dumpDir,
    pick: 'pick' in updates ? updates.pick : existing?.pick,
    commands: mergeOutputCommandsConfig(existing?.commands, updates)
  };
}

function mergeOutputCommandsConfig(existing: CliOutputConfig['commands'], updates: CliOutputConfig): CliOutputConfig['commands'] {
  if (!('commands' in updates)) {
    return existing;
  }

  if (!updates.commands) {
    return undefined;
  }

  const merged: Record<string, CliCommandOutputConfig> = { ...existing };
  for (const key of Object.keys(updates.commands)) {
    merged[key] = { ...existing?.[key], ...updates.commands[key] };
  }
  return merged;
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
 */
export function maskSecret(value: Maybe<string>): Maybe<string> {
  if (value == null) {
    return value;
  }

  if (value.length <= 4) {
    return '***';
  }

  return value.substring(0, 4) + '***';
}
