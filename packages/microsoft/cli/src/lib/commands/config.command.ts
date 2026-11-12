import { CliError, outputResult, wrapCommandHandler } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Argv, CommandModule } from 'yargs';
import { type MsGraphCliConfigFile, type MsGraphCliConfigStore, msGraphCliConfigStore } from '../config/cli.config';
import { parseMsGraphCliAddressesOption } from '../util/mail.write';

/**
 * The settings `msgraph-cli config` reads and writes.
 */
export const MSGRAPH_CLI_CONFIG_KEYS = ['signature-file', 'mailboxes'] as const;

export type MsGraphCliConfigKey = (typeof MSGRAPH_CLI_CONFIG_KEYS)[number];

/**
 * The saved settings `msgraph-cli config get` prints.
 */
export interface MsGraphCliConfigSettings {
  readonly 'signature-file'?: Maybe<string>;
  readonly mailboxes?: Maybe<string[]>;
}

/**
 * Picks the `msgraph-cli config` settings out of the config file.
 *
 * @param file - The config file.
 * @returns The settings.
 */
export function msGraphCliConfigSettings(file: Maybe<MsGraphCliConfigFile>): MsGraphCliConfigSettings {
  return { 'signature-file': file?.signatureFile ?? undefined, mailboxes: file?.mailboxes ?? undefined };
}

/**
 * Builds the config-file update that sets one setting.
 *
 * - `signature-file`: resolved to an absolute path, and the file must exist.
 * - `mailboxes`: comma- or semicolon-separated addresses, deduplicated.
 *
 * @param key - The setting.
 * @param value - The raw value.
 * @returns The update.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not valid for the setting.
 */
export async function msGraphCliConfigSetUpdate(key: MsGraphCliConfigKey, value: string): Promise<Partial<MsGraphCliConfigFile>> {
  let result: Partial<MsGraphCliConfigFile>;

  if (key === 'signature-file') {
    const path = resolve(value);
    await access(path).catch(() => {
      throw new CliError({ message: `Signature file "${path}" does not exist.`, code: 'INVALID_ARGUMENT', suggestion: 'Export your signature from Outlook on the web to an .html (or .txt) file once, then point signature-file at it.' });
    });
    result = { signatureFile: path };
  } else {
    result = { mailboxes: Array.from(new Set(parseMsGraphCliAddressesOption('mailboxes', value) ?? [])) };
  }

  return result;
}

function configStoreFor(store: Maybe<MsGraphCliConfigStore>): MsGraphCliConfigStore {
  return store ?? msGraphCliConfigStore();
}

/**
 * Builds the `config` command over a config store.
 *
 * @param storeOverride - The config store. Defaults to the one at `~/.msgraph-cli` (specs pass their own).
 * @returns The command.
 */
export function msGraphCliConfigCommand(storeOverride?: Maybe<MsGraphCliConfigStore>): CommandModule {
  const setCommand: CommandModule = {
    command: 'set <key> <value>',
    describe: 'Save a setting',
    builder: (yargs: Argv) =>
      yargs
        .positional('key', { type: 'string', choices: MSGRAPH_CLI_CONFIG_KEYS, demandOption: true, describe: 'The setting' })
        .positional('value', { type: 'string', demandOption: true, describe: 'The value' })
        .example([
          ['$0 config set signature-file ~/signature.html', 'Append this signature to new messages, replies and forwards'],
          ['$0 config set mailboxes support@example.com,billing@example.com', 'Record shared mailboxes for mail mailboxes check']
        ]),
    handler: wrapCommandHandler(async (argv: any) => {
      const store = configStoreFor(storeOverride);
      const saved = await store.updateConfigFile(await msGraphCliConfigSetUpdate(argv.key, String(argv.value)));
      outputResult(msGraphCliConfigSettings(saved));
    })
  };

  const unsetCommand: CommandModule = {
    command: 'unset <key>',
    describe: 'Remove a setting',
    builder: (yargs: Argv) => yargs.positional('key', { type: 'string', choices: MSGRAPH_CLI_CONFIG_KEYS, demandOption: true, describe: 'The setting' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const store = configStoreFor(storeOverride);
      const update: Partial<MsGraphCliConfigFile> = argv.key === 'signature-file' ? { signatureFile: undefined } : { mailboxes: undefined };
      outputResult(msGraphCliConfigSettings(await store.updateConfigFile(update)));
    })
  };

  const getCommand: CommandModule = {
    command: 'get',
    describe: 'Print the saved settings',
    handler: wrapCommandHandler(async () => {
      outputResult(msGraphCliConfigSettings(await configStoreFor(storeOverride).loadConfigFile()));
    })
  };

  return {
    command: 'config',
    describe: 'Saved mail defaults: signature-file, mailboxes',
    builder: (yargs: Argv) => yargs.command(getCommand).command(setCommand).command(unsetCommand).demandCommand(1, 'Please specify a config subcommand.'),
    handler: () => undefined
  };
}

/**
 * The `config` command: `get`, `set <key> <value>` and `unset <key>`.
 */
export const CONFIG_COMMAND: CommandModule = msGraphCliConfigCommand();
