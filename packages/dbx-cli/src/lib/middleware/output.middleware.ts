import type { MiddlewareFunction } from 'yargs';
import { loadCliConfig, mergeCliConfig, resolveOutputConfig } from '../config/cli.config';
import { buildCliPaths } from '../config/paths';
import { configureOutputOptions } from '../util/output';

export interface CreateOutputMiddlewareInput {
  readonly cliName: string;
  /**
   * Top-level command names whose output should never be filtered by saved pick/dump-dir
   * (typically the same set passed to {@link createAuthMiddleware}).
   */
  readonly skipCommands: ReadonlySet<string>;
}

/**
 * Yargs middleware that resolves output options (`--pick`, `--dump-dir`) by combining CLI flags,
 * `--set-pick` / `--set-dump-dir` saves, per-command config, and global config — then writes them
 * into the module-level output options slot.
 */
export function createOutputMiddleware(input: CreateOutputMiddlewareInput): MiddlewareFunction {
  const paths = buildCliPaths({ cliName: input.cliName });

  return async (argv: any) => {
    const commandPath: string[] = argv._ ? (argv._ as string[]).map(String) : [];
    const topCommand = commandPath[0];

    const setDumpDir: string | undefined = argv.setDumpDir;
    const setPick: string | undefined = argv.setPick;
    const hasSetFlags = setDumpDir !== undefined || setPick !== undefined;

    if (hasSetFlags && topCommand && !input.skipCommands.has(topCommand)) {
      const commandKey = commandPath.join('.');
      const commandConfig = {
        ...(setDumpDir !== undefined ? { dumpDir: setDumpDir } : {}),
        ...(setPick !== undefined ? { pick: setPick } : {})
      };

      await mergeCliConfig({
        configFilePath: paths.configFilePath,
        configDir: paths.configDir,
        updates: { output: { commands: { [commandKey]: commandConfig } } }
      });
    }

    const isApiCommand = topCommand && !input.skipCommands.has(topCommand);
    const config = await loadCliConfig({ configFilePath: paths.configFilePath });
    const resolved = isApiCommand
      ? resolveOutputConfig({
          outputConfig: config?.output,
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
