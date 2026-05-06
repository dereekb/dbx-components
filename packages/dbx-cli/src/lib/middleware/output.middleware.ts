import { type Maybe } from '@dereekb/util';
import type { MiddlewareFunction } from 'yargs';
import { type CliCommandOutputConfig, type CliOutputConfig, loadCliConfig, mergeCliConfig, resolveOutputConfig } from '../config/cli.config';
import { buildCliPaths } from '../config/paths';
import { configureOutputOptions } from '../util/output';

/**
 * Returns the output config slice from wherever the consumer stores it.
 *
 * Default implementation reads from `<configDir>/config.json` at the dbx-cli location, but
 * apps with their own on-disk config shape (e.g. zoho-cli) plug in their own loader.
 */
export type LoadOutputConfigFn = () => Promise<Maybe<CliOutputConfig>>;

/**
 * Persists a per-command output override (called only when `--set-pick` / `--set-dump-dir` is used).
 *
 * Apps with their own config-file shape pass an implementation that merges into their store.
 */
export type SaveCommandOutputConfigFn = (commandKey: string, config: CliCommandOutputConfig) => Promise<void>;

export interface CreateOutputMiddlewareInput {
  readonly cliName: string;
  /**
   * Top-level command names whose output should never be filtered by saved pick/dump-dir
   * (typically the same set passed to {@link createAuthMiddleware}).
   */
  readonly skipCommands: ReadonlySet<string>;
  /**
   * Optional override for how the output config is read.
   *
   * When omitted, defaults to reading from `~/.config/<cliName>/config.json` via
   * {@link loadCliConfig} + {@link buildCliPaths}.
   */
  readonly loadOutputConfig?: LoadOutputConfigFn;
  /**
   * Optional override for how a per-command output config is persisted.
   *
   * When omitted, defaults to {@link mergeCliConfig} writing into `~/.config/<cliName>/config.json`.
   */
  readonly saveCommandOutputConfig?: SaveCommandOutputConfigFn;
}

/**
 * Yargs middleware that resolves output options (`--pick`, `--dump-dir`) by combining CLI flags,
 * `--set-pick` / `--set-dump-dir` saves, per-command config, and global config — then writes them
 * into the module-level output options slot.
 *
 * Consumers with a non-default config-file shape (e.g. zoho-cli's per-product layout) inject
 * {@link CreateOutputMiddlewareInput.loadOutputConfig} and {@link CreateOutputMiddlewareInput.saveCommandOutputConfig}
 * so the middleware orchestrates resolve/save without owning the storage format.
 */
export function createOutputMiddleware(input: CreateOutputMiddlewareInput): MiddlewareFunction {
  const paths = buildCliPaths({ cliName: input.cliName });

  const loadOutputConfig: LoadOutputConfigFn =
    input.loadOutputConfig ??
    (async () => {
      const config = await loadCliConfig({ configFilePath: paths.configFilePath });
      return config?.output;
    });

  const saveCommandOutputConfig: SaveCommandOutputConfigFn =
    input.saveCommandOutputConfig ??
    (async (commandKey, commandConfig) => {
      await mergeCliConfig({
        configFilePath: paths.configFilePath,
        configDir: paths.configDir,
        updates: { output: { commands: { [commandKey]: commandConfig } } }
      });
    });

  return async (argv: any) => {
    const commandPath: string[] = argv._ ? (argv._ as string[]).map(String) : [];
    const topCommand = commandPath[0];

    const setDumpDir: string | undefined = argv.setDumpDir;
    const setPick: string | undefined = argv.setPick;
    const hasSetFlags = setDumpDir !== undefined || setPick !== undefined;

    if (hasSetFlags && topCommand && !input.skipCommands.has(topCommand)) {
      const commandKey = commandPath.join('.');
      const commandConfig: CliCommandOutputConfig = {
        ...(setDumpDir === undefined ? {} : { dumpDir: setDumpDir }),
        ...(setPick === undefined ? {} : { pick: setPick })
      };

      await saveCommandOutputConfig(commandKey, commandConfig);
    }

    const isApiCommand = topCommand && !input.skipCommands.has(topCommand);
    const outputConfig = isApiCommand ? await loadOutputConfig() : undefined;
    const resolved = isApiCommand
      ? resolveOutputConfig({
          outputConfig,
          commandPath,
          cliFlags: { dumpDir: argv.dumpDir ?? setDumpDir, pick: argv.pick ?? setPick }
        })
      : { dumpDir: undefined, pick: undefined };

    configureOutputOptions({
      dumpDir: resolved.dumpDir,
      pick: argv.pickAll ? undefined : resolved.pick,
      commandPath
    });
  };
}
