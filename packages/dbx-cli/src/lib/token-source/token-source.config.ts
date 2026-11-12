import { type Maybe } from '@dereekb/util';
import { getCliEnvVarName } from '../config/env.resolve';
import { CliError } from '../util/output';

/**
 * Error code when a token source name selects no saved token source (from `--token-source`, the
 * `<CLI>_TOKEN_SOURCE` env var, the saved selection, or `auth token-source use`).
 */
export const CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE = 'TOKEN_SOURCE_UNKNOWN';

// MARK: Config
/**
 * A saved token source: a command that prints a short-lived access token bundle when run as a dbx-cli
 * credential process (e.g. `demo-cli external-token zoho_admin`).
 *
 * Holds no secret itself. The bundle it prints is captured in-process and never echoed. A consuming CLI
 * may extend it with its own fields (e.g. zoho-cli's `apiMode`).
 */
export interface CliTokenSourceConfig {
  /**
   * Shell command to run, e.g. `demo-cli external-token zoho_admin`.
   */
  readonly command: string;
}

/**
 * Name of a saved token source, e.g. `dev` or `prod`.
 */
export type CliTokenSourceName = string;

/**
 * The name of the unnamed `tokenSource` block, the source used when nothing selects another one.
 */
export const DEFAULT_CLI_TOKEN_SOURCE_NAME: CliTokenSourceName = 'default';

/**
 * The token-source keys of a CLI's config file.
 *
 * `tokenSource` is the unnamed source ({@link DEFAULT_CLI_TOKEN_SOURCE_NAME}), `tokenSources` holds more
 * sources by name (e.g. one per app env), and `activeTokenSource` names the one used when a run does
 * not select one.
 */
export interface CliTokenSourceConfigFile<T extends CliTokenSourceConfig = CliTokenSourceConfig> {
  readonly tokenSource?: T;
  readonly tokenSources?: Readonly<Record<CliTokenSourceName, T>>;
  readonly activeTokenSource?: CliTokenSourceName;
}

/**
 * Where the active token source was selected: the `--token-source` flag, an env var, or the config file.
 */
export type CliTokenSourceOrigin = 'flag' | 'env' | 'config';

/**
 * The token source in effect for a run, and where it came from.
 */
export type CliActiveTokenSource<T extends CliTokenSourceConfig = CliTokenSourceConfig> = T & {
  readonly origin: CliTokenSourceOrigin;
  /**
   * The saved source's name. Unset for a `<CLI>_TOKEN_COMMAND` command, which is not a saved source.
   */
  readonly name?: Maybe<CliTokenSourceName>;
};

/**
 * Per-run token source selection that does not come from the environment.
 */
export interface CliTokenSourceSelection {
  /**
   * The name passed with `--token-source`. Wins over every other selection.
   */
  readonly tokenSourceName?: Maybe<CliTokenSourceName>;
}

/**
 * Reads the `--token-source` flag off parsed yargs arguments.
 *
 * @param argv - The parsed arguments.
 * @returns The selection, with the trimmed name when the flag is set and not blank.
 */
export function cliTokenSourceSelectionFromArgv(argv: Maybe<{ readonly tokenSource?: unknown }>): CliTokenSourceSelection {
  const name = typeof argv?.tokenSource === 'string' ? argv.tokenSource.trim() : '';
  return name ? { tokenSourceName: name } : {};
}

const CLI_TOKEN_SOURCE_NAME_REGEX = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Checks a token source name before it is saved: letters, digits, `_` and `-`, starting with a letter or digit.
 *
 * @param name - The name to check.
 * @returns The trimmed name.
 * @throws {Error} When the name is blank or holds other characters.
 */
export function assertCliTokenSourceName(name: string): CliTokenSourceName {
  const trimmed = name.trim();

  if (!CLI_TOKEN_SOURCE_NAME_REGEX.test(trimmed)) {
    throw new Error(`Invalid token source name "${trimmed}": use letters, digits, "_" and "-", starting with a letter or digit.`);
  }

  return trimmed;
}

// MARK: Env
/**
 * The env vars that select a CLI's token source for one run.
 */
export interface CliTokenSourceEnvVarNames {
  /**
   * Sets the token source command for one run, e.g. `ZOHO_CLI_TOKEN_COMMAND`. Not a saved source.
   */
  readonly tokenCommand: string;
  /**
   * Selects a saved token source by name, e.g. `ZOHO_CLI_TOKEN_SOURCE`, like dbx-cli's `<CLI>_ENV`.
   */
  readonly tokenSource: string;
}

/**
 * Derives the token-source env var names of a CLI from its name, the same way {@link getCliEnvVarName} derives `<CLI>_ENV`.
 *
 * @param cliName - The CLI's binary name, e.g. `zoho-cli`.
 * @returns E.g. `{ tokenCommand: 'ZOHO_CLI_TOKEN_COMMAND', tokenSource: 'ZOHO_CLI_TOKEN_SOURCE' }`.
 * @__NO_SIDE_EFFECTS__
 */
export function cliTokenSourceEnvVarNames(cliName: string): CliTokenSourceEnvVarNames {
  const prefix = getCliEnvVarName(cliName).replace(/_ENV$/, '');
  return { tokenCommand: `${prefix}_TOKEN_COMMAND`, tokenSource: `${prefix}_TOKEN_SOURCE` };
}

// MARK: Resolver
/**
 * Validates and reads a saved block's own fields (everything but `command`) for one CLI.
 *
 * Throws on an invalid value rather than quietly dropping it (e.g. a mistyped zoho-cli `apiMode` must
 * not send a dev source's calls to live data).
 */
export type CliTokenSourceExtraReader<T extends CliTokenSourceConfig> = (block: Readonly<Partial<T>>, name: CliTokenSourceName) => Omit<T, 'command'>;

/**
 * Config for {@link cliTokenSourceResolver}.
 */
export interface CliTokenSourceResolverConfig<T extends CliTokenSourceConfig = CliTokenSourceConfig> {
  /**
   * The CLI's binary name, e.g. `zoho-cli`. Derives the env var names and appears in hints.
   */
  readonly cliName: string;
  /**
   * Reads the saved block's own fields. Omit when the CLI's source has only a `command`.
   */
  readonly readExtra?: Maybe<CliTokenSourceExtraReader<T>>;
  /**
   * The environment to read the env vars from. Defaults to `process.env` (read on each call).
   */
  readonly env?: Maybe<NodeJS.ProcessEnv>;
}

/**
 * The token-source selection rules of one CLI, from {@link cliTokenSourceResolver}.
 */
export interface CliTokenSourceResolver<T extends CliTokenSourceConfig = CliTokenSourceConfig> {
  readonly cliName: string;
  readonly envVarNames: CliTokenSourceEnvVarNames;
  /**
   * The trimmed `<CLI>_TOKEN_COMMAND` command, or undefined when unset or blank.
   */
  tokenCommandFromEnv(): Maybe<string>;
  /**
   * The trimmed `<CLI>_TOKEN_SOURCE` name, or undefined when unset or blank.
   */
  tokenSourceNameFromEnv(): Maybe<CliTokenSourceName>;
  /**
   * The block a name is stored in, as stored (unvalidated): {@link DEFAULT_CLI_TOKEN_SOURCE_NAME} is the
   * `tokenSource` block, any other name an entry of `tokenSources`.
   */
  savedTokenSourceBlock(fileConfig: Maybe<CliTokenSourceConfigFile<T>>, name: CliTokenSourceName): Maybe<T>;
  /**
   * The saved source by name with its command trimmed and its own fields read, or undefined when none is
   * saved under the name (or its command is blank). Throws when its own fields are invalid.
   */
  savedTokenSource(fileConfig: Maybe<CliTokenSourceConfigFile<T>>, name: CliTokenSourceName): Maybe<T>;
  /**
   * The names of the saved sources: {@link DEFAULT_CLI_TOKEN_SOURCE_NAME} first when the `tokenSource`
   * block is saved, then the named ones in file order.
   */
  savedTokenSourceNames(fileConfig: Maybe<CliTokenSourceConfigFile<T>>): CliTokenSourceName[];
  /**
   * Describes where a source was selected, for messages: `--token-source`, an env var name, or `config file`.
   */
  originLabel(active: Pick<CliActiveTokenSource, 'origin' | 'name'>): string;
  /**
   * Resolves the active token source. The first that applies wins:
   *
   * 1. `--token-source <name>`,
   * 2. a `<CLI>_TOKEN_SOURCE` name,
   * 3. a `<CLI>_TOKEN_COMMAND` command,
   * 4. the saved `activeTokenSource` name,
   * 5. the saved `tokenSource` block ({@link DEFAULT_CLI_TOKEN_SOURCE_NAME}).
   *
   * A name that selects no saved source throws instead of falling through, so a mistyped `prod` never
   * quietly runs against another environment.
   *
   * @throws {CliError} A {@link CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE} error, with the save hint as its suggestion, when a name selects no saved source.
   */
  resolveActiveTokenSource(fileConfig: Maybe<CliTokenSourceConfigFile<T>>, selection?: Maybe<CliTokenSourceSelection>): Maybe<CliActiveTokenSource<T>>;
  /**
   * The `set` hint used in the messages, e.g. `zoho-cli auth token-source set "<command>" --name prod`.
   */
  setHint(name: CliTokenSourceName): string;
}

/**
 * Creates the token-source selection rules for one CLI: its env var names, saved sources, and the
 * "one selected source wins" order dbx-cli applies to envs.
 *
 * @param config - The CLI name, the saved block's own-field reader, and the env.
 * @returns The resolver.
 *
 * @example
 * ```typescript
 * const resolver = cliTokenSourceResolver({ cliName: 'msgraph-cli' });
 * const active = resolver.resolveActiveTokenSource(await loadConfigFile(), { tokenSourceName: argv.tokenSource });
 * ```
 */
export function cliTokenSourceResolver<T extends CliTokenSourceConfig = CliTokenSourceConfig>(config: CliTokenSourceResolverConfig<T>): CliTokenSourceResolver<T> {
  const { cliName, readExtra } = config;
  const envVarNames = cliTokenSourceEnvVarNames(cliName);
  const env = () => config.env ?? process.env;

  const tokenCommandFromEnv = () => env()[envVarNames.tokenCommand]?.trim() || undefined;
  const tokenSourceNameFromEnv = () => env()[envVarNames.tokenSource]?.trim() || undefined;
  const setHint = (name: CliTokenSourceName) => `${cliName} auth token-source set "<command>" --name ${name}`;

  function savedTokenSourceBlock(fileConfig: Maybe<CliTokenSourceConfigFile<T>>, name: CliTokenSourceName): Maybe<T> {
    let result: Maybe<T>;

    if (name === DEFAULT_CLI_TOKEN_SOURCE_NAME) {
      result = fileConfig?.tokenSource;
    } else if (fileConfig?.tokenSources != null && Object.hasOwn(fileConfig.tokenSources, name)) {
      result = fileConfig.tokenSources[name];
    }

    return result;
  }

  function savedTokenSource(fileConfig: Maybe<CliTokenSourceConfigFile<T>>, name: CliTokenSourceName): Maybe<T> {
    const block = savedTokenSourceBlock(fileConfig, name);
    const command = block?.command?.trim();
    let result: Maybe<T>;

    if (block != null && command) {
      const extra = readExtra ? readExtra(block, name) : {};
      result = { command, ...extra } as T;
    }

    return result;
  }

  function savedTokenSourceNames(fileConfig: Maybe<CliTokenSourceConfigFile<T>>): CliTokenSourceName[] {
    const named = Object.entries(fileConfig?.tokenSources ?? {})
      .filter(([name, block]) => name !== DEFAULT_CLI_TOKEN_SOURCE_NAME && Boolean(block?.command?.trim()))
      .map(([name]) => name);

    return fileConfig?.tokenSource?.command?.trim() ? [DEFAULT_CLI_TOKEN_SOURCE_NAME, ...named] : named;
  }

  function originLabel(active: Pick<CliActiveTokenSource, 'origin' | 'name'>): string {
    let result: string;

    switch (active.origin) {
      case 'flag':
        result = '--token-source';
        break;
      case 'env':
        result = active.name == null ? envVarNames.tokenCommand : envVarNames.tokenSource;
        break;
      default:
        result = 'config file';
        break;
    }

    return result;
  }

  function resolveActiveTokenSource(fileConfig: Maybe<CliTokenSourceConfigFile<T>>, selection?: Maybe<CliTokenSourceSelection>): Maybe<CliActiveTokenSource<T>> {
    const flagName = selection?.tokenSourceName?.trim() || undefined;
    const envName = tokenSourceNameFromEnv();
    const envCommand = tokenCommandFromEnv();
    const savedName = fileConfig?.activeTokenSource?.trim() || undefined;
    let selected: Maybe<{ readonly origin: CliTokenSourceOrigin; readonly name: CliTokenSourceName }>;
    let result: Maybe<CliActiveTokenSource<T>>;

    if (flagName) {
      selected = { origin: 'flag', name: flagName };
    } else if (envName) {
      selected = { origin: 'env', name: envName };
    } else if (envCommand) {
      result = { command: envCommand, origin: 'env' } as CliActiveTokenSource<T>;
    } else if (savedName) {
      selected = { origin: 'config', name: savedName };
    } else if (fileConfig?.tokenSource?.command?.trim()) {
      selected = { origin: 'config', name: DEFAULT_CLI_TOKEN_SOURCE_NAME };
    }

    if (selected) {
      const { origin, name } = selected;
      const saved = savedTokenSource(fileConfig, name);

      if (!saved) {
        const names = savedTokenSourceNames(fileConfig);
        throw new CliError({
          message: `Unknown token source "${name}" (from ${originLabel(selected)}). Saved token sources: ${names.length > 0 ? names.join(', ') : 'none'}.`,
          code: CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE,
          suggestion: `Save it with: ${setHint(name)}`
        });
      }

      result = { ...saved, origin, name };
    }

    return result;
  }

  return { cliName, envVarNames, tokenCommandFromEnv, tokenSourceNameFromEnv, savedTokenSourceBlock, savedTokenSource, savedTokenSourceNames, originLabel, resolveActiveTokenSource, setHint };
}
