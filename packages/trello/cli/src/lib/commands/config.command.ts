import { CliError } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';
import type { Argv } from 'yargs';
import { type TrelloCliConfigFile, trelloCliConfigStore, trelloCliPaths } from '../config/cli.config';
import { type TrelloCliCommand } from '../context/cli.command';
import { parseTrelloCliBoardArg } from '../util/option';

/**
 * The settings `trello-cli config set` / `unset` accept.
 */
export const TRELLO_CLI_CONFIG_KEYS = ['default-board'] as const;

/**
 * A `trello-cli config` setting name.
 */
export type TrelloCliConfigKey = (typeof TRELLO_CLI_CONFIG_KEYS)[number];

/**
 * The saved settings as `config get` prints them. Token sources are listed by `auth token-source show`, plugins by
 * `extensions`; neither is repeated here.
 *
 * @param file - The config file.
 * @returns The settings.
 */
export function trelloCliConfigSettings(file: Maybe<TrelloCliConfigFile>): Record<string, unknown> {
  return { 'default-board': file?.defaultBoard ?? null, extensions: file?.extensions ?? [] };
}

/**
 * The config update a `config set <key> <value>` makes.
 *
 * @param key - The setting.
 * @param value - The value as typed.
 * @returns The update.
 * @throws {CliError} `INVALID_ARGUMENT` for an invalid value.
 */
export function trelloCliConfigSetUpdate(key: TrelloCliConfigKey, value: string): Partial<TrelloCliConfigFile> {
  const board = parseTrelloCliBoardArg(value);

  if (key !== 'default-board' || board == null) {
    throw new CliError({ message: `Invalid value for ${key}: "${value}".`, code: 'INVALID_ARGUMENT' });
  }

  return { defaultBoard: board };
}

const getCommand: TrelloCliCommand = {
  command: 'get',
  describe: 'Print the saved settings',
  requires: 'none',
  handler: async (_argv, ctx) => ctx.output.result({ ...trelloCliConfigSettings(await trelloCliConfigStore(trelloCliPaths()).loadConfigFile()), configDir: ctx.configDir })
};

const setCommand: TrelloCliCommand = {
  command: 'set <key> <value>',
  describe: 'Save a setting',
  requires: 'none',
  builder: (yargs: Argv) =>
    yargs
      .positional('key', { type: 'string', choices: TRELLO_CLI_CONFIG_KEYS, demandOption: true, describe: 'The setting' })
      .positional('value', { type: 'string', demandOption: true, describe: 'The value' })
      .example([['$0 config set default-board https://trello.com/b/AbCd1234/my-board', 'Use this board when --board is not passed']]),
  handler: async (argv, ctx) => {
    const saved = await trelloCliConfigStore(trelloCliPaths()).updateConfigFile(trelloCliConfigSetUpdate(argv['key'] as TrelloCliConfigKey, String(argv['value'])));
    ctx.output.result(trelloCliConfigSettings(saved));
  }
};

const unsetCommand: TrelloCliCommand = {
  command: 'unset <key>',
  describe: 'Remove a setting',
  requires: 'none',
  builder: (yargs: Argv) => yargs.positional('key', { type: 'string', choices: TRELLO_CLI_CONFIG_KEYS, demandOption: true, describe: 'The setting' }),
  handler: async (_argv, ctx) => ctx.output.result(trelloCliConfigSettings(await trelloCliConfigStore(trelloCliPaths()).updateConfigFile({ defaultBoard: undefined })))
};

/**
 * The `config` command: `get`, `set default-board <board>`, `unset default-board`.
 */
export const TRELLO_CLI_CONFIG_COMMAND: TrelloCliCommand = {
  command: 'config',
  describe: 'Saved settings: default-board',
  requires: 'none',
  subcommands: [getCommand, setCommand, unsetCommand]
};
