import { type CliPlugin, type CliPluginReportEntry, type CliPluginSource } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type TrelloCliDoctorCheckFunction } from '../commands/doctor.command';
import { type TrelloCliCommand, trelloCliCommandName } from '../context/cli.command';
import { isTrelloServerErrorLike } from '../util/output';

/**
 * The plugin api version this trello-cli implements. A plugin declaring another `apiVersion` is skipped.
 */
export const TRELLO_CLI_PLUGIN_API_VERSION = 1;

/**
 * What a plugin's `setup` receives. Everything a plugin needs is injected — it never imports the host's copy of
 * `@dereekb/trello/cli` — so one plugin runs unchanged in the stock binary and in a host-built CLI.
 */
export interface TrelloCliPluginApi {
  readonly apiVersion: typeof TRELLO_CLI_PLUGIN_API_VERSION;
  /**
   * The host CLI's version, e.g. `14.25.1`, or undefined when it could not be read.
   */
  readonly hostVersion: Maybe<string>;
  readonly cliName: string;
  /**
   * The plugin's own name: its commands mount under `<cliName> <pluginName> …`.
   */
  readonly pluginName: string;
  /**
   * The `options` of the plugin's config entry (`extensions: [{ path, options }]`); empty for other sources.
   */
  readonly options: Readonly<Record<string, unknown>>;
  /**
   * Where the plugin was loaded from.
   */
  readonly source: CliPluginSource;
  /**
   * The resolved module path, for an external plugin.
   */
  readonly path?: Maybe<string>;
  /**
   * Writes one line to stderr.
   */
  log(line: string): void;
  /**
   * Whether a thrown value is a `@dereekb/trello` server error from ANY copy of the library. Use it instead of
   * `instanceof`, which fails across copies.
   */
  isTrelloServerError(error: unknown): boolean;
}

/**
 * What a plugin's `setup` returns.
 */
export interface TrelloCliPluginContribution {
  /**
   * Commands mounted under `<cliName> <pluginName> …`.
   */
  readonly commands?: Maybe<readonly TrelloCliCommand[]>;
  /**
   * Checks `doctor` runs, reported as `<pluginName>:<check name>`.
   */
  readonly doctorChecks?: Maybe<readonly TrelloCliDoctorCheckFunction[]>;
}

/**
 * A trello-cli plugin: the default (or `plugin`) export of a module loaded with `--extension`, `TRELLO_CLI_EXTENSIONS`
 * or the config's `extensions`, or passed to `runTrelloCli({ plugins })`.
 */
export interface TrelloCliPlugin extends CliPlugin<TrelloCliPluginApi, TrelloCliPluginContribution> {
  readonly apiVersion: typeof TRELLO_CLI_PLUGIN_API_VERSION;
  /**
   * One line for `--help` on the plugin's command group.
   */
  readonly describe?: Maybe<string>;
}

/**
 * Types a plugin definition. An identity function: it only exists so a plugin module gets type-checked against the
 * contract.
 *
 * @param plugin - The plugin.
 * @returns The same plugin.
 *
 * @example
 * ```ts
 * export default defineTrelloCliPlugin({
 *   apiVersion: 1,
 *   name: 'standup',
 *   setup: () => ({ commands: [{ command: 'today', describe: 'My cards', handler: async (_argv, ctx) => ctx.output.result(await ctx.me()) }] })
 * });
 * ```
 */
export function defineTrelloCliPlugin(plugin: TrelloCliPlugin): TrelloCliPlugin {
  return plugin;
}

/**
 * A loaded plugin as `doctor` / `extensions` report it.
 */
export interface TrelloCliPluginReport extends CliPluginReportEntry {
  /**
   * The plugin's command names, for a loaded plugin.
   */
  readonly commands?: Maybe<readonly string[]>;
}

/**
 * Checks a plugin's contribution before it is mounted.
 *
 * @param contribution - What `setup` returned.
 * @returns An error message, or undefined when it is valid.
 */
export function trelloCliPluginContributionError(contribution: unknown): Maybe<string> {
  const value = contribution as Maybe<TrelloCliPluginContribution>;
  let result: Maybe<string>;

  if (value != null && typeof value !== 'object') {
    result = 'setup must return an object ({ commands?, doctorChecks? })';
  } else if (value?.commands != null && !Array.isArray(value.commands)) {
    result = '`commands` must be an array';
  } else if (value?.doctorChecks != null && (!Array.isArray(value.doctorChecks) || value.doctorChecks.some((x) => typeof x !== 'function'))) {
    result = '`doctorChecks` must be an array of functions';
  } else {
    const invalid = (value?.commands ?? []).find((command) => command == null || typeof command.command !== 'string' || command.command.trim().length === 0 || typeof command.describe !== 'string');
    const names = (value?.commands ?? []).filter((x) => x != null && typeof x.command === 'string').map(trelloCliCommandName);
    const duplicate = names.find((name, i) => names.indexOf(name) !== i);

    if (invalid != null) {
      result = 'every command needs a `command` string and a `describe` string';
    } else if (duplicate != null) {
      result = `two commands are named "${duplicate}"`;
    }
  }

  return result;
}

/**
 * Input for {@link createTrelloCliPluginApi}.
 */
export interface CreateTrelloCliPluginApiInput {
  readonly plugin: Pick<TrelloCliPlugin, 'name'>;
  readonly source: CliPluginSource;
  readonly path?: Maybe<string>;
  readonly options: Readonly<Record<string, unknown>>;
  readonly cliName: string;
  readonly hostVersion: Maybe<string>;
  /**
   * Overrides the stderr writer. Used by specs.
   */
  readonly log?: Maybe<(line: string) => void>;
}

/**
 * Builds the {@link TrelloCliPluginApi} for one plugin.
 *
 * @param input - The plugin, its load context, the host's name and version, and the stderr writer.
 * @returns The api.
 */
export function createTrelloCliPluginApi(input: CreateTrelloCliPluginApiInput): TrelloCliPluginApi {
  const pluginName = input.plugin.name;
  const write = input.log ?? ((line: string) => process.stderr.write(`${line}\n`));

  return {
    apiVersion: TRELLO_CLI_PLUGIN_API_VERSION,
    hostVersion: input.hostVersion,
    cliName: input.cliName,
    pluginName,
    options: input.options,
    source: input.source,
    path: input.path,
    log: (line) => write(`[${pluginName}] ${line}`),
    isTrelloServerError: isTrelloServerErrorLike
  };
}

/**
 * Where trello-cli's own package.json sits relative to this module: beside the built library
 * (`dist/packages/trello/cli`), beside the binary (`dist/packages/trello/bin`), or three directories up in source.
 */
const TRELLO_CLI_PACKAGE_JSON_CANDIDATES: readonly string[] = ['./package.json', '../package.json', '../../../package.json'];

/**
 * Reads the CLI's version from its package.json, for `minHostVersion` checks.
 *
 * @param moduleUrl - The url to resolve against. Defaults to this module's.
 * @returns The version, or undefined when no `@dereekb/trello` package.json is found.
 */
export function readTrelloCliVersion(moduleUrl: string = import.meta.url): Maybe<string> {
  let result: Maybe<string>;

  for (const candidate of TRELLO_CLI_PACKAGE_JSON_CANDIDATES) {
    if (result == null) {
      try {
        const json = JSON.parse(readFileSync(fileURLToPath(new URL(candidate, moduleUrl)), 'utf8')) as { readonly name?: unknown; readonly version?: unknown };

        if (typeof json.name === 'string' && json.name.startsWith('@dereekb/trello') && typeof json.version === 'string') {
          result = json.version;
        }
      } catch {
        result = undefined;
      }
    }
  }

  return result;
}
