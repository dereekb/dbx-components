import { CliError, outputResult, wrapCommandHandler } from '@dereekb/dbx-cli';
import { type MicrosoftMailSignatureUserExternalConnectionData, USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Argv, CommandModule } from 'yargs';
import { type MsGraphCliConfigFile, type MsGraphCliConfigStore, msGraphCliConfigStore } from '../config/cli.config';
import { type MsGraphCliConnectionSettings } from '../util/connection.settings';
import { isMsGraphCliHtmlFile, msGraphCliSignatureLocalImageSources, parseMsGraphCliAddressesOption } from '../util/mail.write';

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
  /**
   * The signature file of each address other than your own, keyed by the lowercased address.
   */
  readonly 'mailbox-signature-files'?: Maybe<Record<string, string>>;
  readonly mailboxes?: Maybe<string[]>;
}

/**
 * Picks the `msgraph-cli config` settings out of the config file.
 *
 * @param file - The config file.
 * @returns The settings.
 */
export function msGraphCliConfigSettings(file: Maybe<MsGraphCliConfigFile>): MsGraphCliConfigSettings {
  return { 'signature-file': file?.signatureFile ?? undefined, 'mailbox-signature-files': file?.mailboxSignatureFiles ?? undefined, mailboxes: file?.mailboxes ?? undefined };
}

/**
 * The context a `config set` / `config unset` runs in.
 */
export interface MsGraphCliConfigUpdateContext {
  /**
   * With `signature-file`: the address the signature is for (a shared mailbox, or a `--send-as` address).
   * Absent means your own mailbox.
   */
  readonly mailbox?: Maybe<string>;
  /**
   * The config file as saved, so a per-mailbox change keeps the other mailboxes' signatures.
   */
  readonly current?: Maybe<MsGraphCliConfigFile>;
}

/**
 * Returns the key a mailbox's signature is saved under: the address, validated and lowercased.
 *
 * @param key - The setting the mailbox was passed with.
 * @param mailbox - The `--mailbox` value.
 * @returns The lowercased address.
 * @throws {CliError} `INVALID_ARGUMENT` when the setting is not `signature-file`, or the value is not one address.
 */
export function msGraphCliSignatureMailboxKey(key: MsGraphCliConfigKey, mailbox: string): string {
  if (key !== 'signature-file') {
    throw new CliError({ message: `--mailbox only applies to signature-file, not ${key}.`, code: 'INVALID_ARGUMENT' });
  }

  const addresses = parseMsGraphCliAddressesOption('mailbox', mailbox) ?? [];

  if (addresses.length !== 1) {
    throw new CliError({ message: `--mailbox takes one address, not "${mailbox}".`, code: 'INVALID_ARGUMENT' });
  }

  return addresses[0].toLowerCase();
}

/**
 * Builds the config-file update that sets one setting.
 *
 * - `signature-file`: resolved to an absolute path, and the file must exist. With a `mailbox`, saved as
 *   that address's signature next to the others; without one, as your own mailbox's.
 * - `mailboxes`: comma- or semicolon-separated addresses, deduplicated.
 *
 * @param key - The setting.
 * @param value - The raw value.
 * @param context - The mailbox the signature is for, and the config as saved.
 * @returns The update.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not valid for the setting.
 */
export async function msGraphCliConfigSetUpdate(key: MsGraphCliConfigKey, value: string, context?: Maybe<MsGraphCliConfigUpdateContext>): Promise<Partial<MsGraphCliConfigFile>> {
  const mailboxKey = context?.mailbox ? msGraphCliSignatureMailboxKey(key, context.mailbox) : undefined;
  let result: Partial<MsGraphCliConfigFile>;

  if (key === 'signature-file') {
    const path = resolve(value);
    await access(path).catch(() => {
      throw new CliError({ message: `Signature file "${path}" does not exist.`, code: 'INVALID_ARGUMENT', suggestion: 'Export your signature from Outlook on the web to an .html (or .txt) file once, then point signature-file at it.' });
    });
    result = mailboxKey ? { mailboxSignatureFiles: { ...context?.current?.mailboxSignatureFiles, [mailboxKey]: path } } : { signatureFile: path };
  } else {
    result = { mailboxes: Array.from(new Set(parseMsGraphCliAddressesOption('mailboxes', value) ?? [])) };
  }

  return result;
}

/**
 * Builds the config-file update that removes one setting.
 *
 * @param key - The setting.
 * @param context - With `signature-file`, the mailbox whose signature to remove (absent: your own), and the config as saved.
 * @returns The update.
 * @throws {CliError} `INVALID_ARGUMENT` when a mailbox is passed with a setting other than `signature-file`.
 */
export function msGraphCliConfigUnsetUpdate(key: MsGraphCliConfigKey, context?: Maybe<MsGraphCliConfigUpdateContext>): Partial<MsGraphCliConfigFile> {
  const mailboxKey = context?.mailbox ? msGraphCliSignatureMailboxKey(key, context.mailbox) : undefined;
  let result: Partial<MsGraphCliConfigFile>;

  if (mailboxKey) {
    const remaining = Object.fromEntries(Object.entries(context?.current?.mailboxSignatureFiles ?? {}).filter(([address]) => address !== mailboxKey));
    result = { mailboxSignatureFiles: Object.keys(remaining).length > 0 ? remaining : undefined };
  } else if (key === 'signature-file') {
    result = { signatureFile: undefined };
  } else {
    result = { mailboxes: undefined };
  }

  return result;
}

/**
 * Reads one saved signature file as a connection-data value: raw content, trimmed, `.html` / `.htm` as `{ html }`,
 * anything else as `{ text }`. Local images are not embedded.
 *
 * @param input - The item key the signature is saved under (`me` or an address) and its file.
 * @param input.itemKey - `me` or the address.
 * @param input.path - The signature file.
 * @returns The value.
 * @throws {CliError} `INVALID_ARGUMENT` when the file cannot be read, or the HTML shows a local image.
 */
export async function readMsGraphCliExportSignature(input: { readonly itemKey: string; readonly path: string }): Promise<MicrosoftMailSignatureUserExternalConnectionData> {
  const { itemKey, path } = input;
  const label = itemKey === USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY ? 'your own mailbox' : itemKey;
  let content: string;

  try {
    content = (await readFile(path, 'utf8')).trim();
  } catch (e) {
    const code = (e as Maybe<{ readonly code?: string }>)?.code ?? 'READ_FAILED';
    throw new CliError({
      message: `The signature file of ${label} ("${path}") cannot be read (${code}).`,
      code: 'INVALID_ARGUMENT',
      suggestion: `Point it at an existing file (msgraph-cli config set signature-file <file>${itemKey === USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY ? '' : ` --mailbox ${itemKey}`}), or unset it.`
    });
  }

  let result: MicrosoftMailSignatureUserExternalConnectionData;

  if (isMsGraphCliHtmlFile(path)) {
    const local = msGraphCliSignatureLocalImageSources(content);

    if (local.length > 0) {
      throw new CliError({ message: `The signature of ${label} shows ${local.length} local image(s), which cannot work on another machine.`, code: 'INVALID_ARGUMENT', suggestion: 'Host the images on the web and use their https URLs in the signature file, then export again.' });
    }

    result = { html: content };
  } else {
    result = { text: content };
  }

  return result;
}

/**
 * Builds `config export`'s output: the saved local signatures as connection settings (`mail_signature` keyed by
 * `me` and each address), ready for `<app>-cli connection-data import microsoft --file -`.
 *
 * @param file - The config file.
 * @returns The settings. Empty when no signature is saved.
 * @throws {CliError} `INVALID_ARGUMENT` when a signature file cannot be read or shows a local image.
 */
export async function msGraphCliConfigExport(file: Maybe<MsGraphCliConfigFile>): Promise<MsGraphCliConnectionSettings> {
  const entries: [string, string][] = [];

  if (file?.signatureFile) {
    entries.push([USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY, file.signatureFile]);
  }

  Object.entries(file?.mailboxSignatureFiles ?? {}).forEach(([address, path]) => entries.push([address.toLowerCase(), path]));

  const signatures: Record<string, MicrosoftMailSignatureUserExternalConnectionData> = {};

  for (const [itemKey, path] of entries) {
    signatures[itemKey] = await readMsGraphCliExportSignature({ itemKey, path });
  }

  return entries.length > 0 ? { mail_signature: signatures } : {};
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
  const mailboxOption = { type: 'string', describe: 'With signature-file: the address the signature is for (a shared mailbox, or a --send-as address). Default: your own mailbox' } as const;

  const setCommand: CommandModule = {
    command: 'set <key> <value>',
    describe: 'Save a setting',
    builder: (yargs: Argv) =>
      yargs
        .positional('key', { type: 'string', choices: MSGRAPH_CLI_CONFIG_KEYS, demandOption: true, describe: 'The setting' })
        .positional('value', { type: 'string', demandOption: true, describe: 'The value' })
        .option('mailbox', mailboxOption)
        .example([
          ['$0 config set signature-file ~/signature.html', 'Append this signature to new messages, replies and forwards from your own mailbox'],
          ['$0 config set signature-file ~/billing-signature.html --mailbox billing@example.com', 'The signature of mail sent from (or as) billing@example.com'],
          ['$0 config set mailboxes support@example.com,billing@example.com', 'Record shared mailboxes for mail mailboxes check']
        ]),
    handler: wrapCommandHandler(async (argv: any) => {
      const store = configStoreFor(storeOverride);
      const saved = await store.updateConfigFile(await msGraphCliConfigSetUpdate(argv.key, String(argv.value), { mailbox: argv.mailbox, current: await store.loadConfigFile() }));
      outputResult(msGraphCliConfigSettings(saved));
    })
  };

  const unsetCommand: CommandModule = {
    command: 'unset <key>',
    describe: 'Remove a setting',
    builder: (yargs: Argv) => yargs.positional('key', { type: 'string', choices: MSGRAPH_CLI_CONFIG_KEYS, demandOption: true, describe: 'The setting' }).option('mailbox', mailboxOption),
    handler: wrapCommandHandler(async (argv: any) => {
      const store = configStoreFor(storeOverride);
      const update = msGraphCliConfigUnsetUpdate(argv.key, { mailbox: argv.mailbox, current: await store.loadConfigFile() });
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

  const exportCommand: CommandModule = {
    command: 'export',
    describe: "Print the saved signatures as connection settings, to store them in the app (everyone's machines get them as server defaults)",
    builder: (yargs: Argv) => yargs.example([['$0 config export | <app>-cli connection-data import microsoft --file -', 'Save your local signatures to the app, then run msgraph-cli auth token-source refresh']]),
    handler: wrapCommandHandler(async () => {
      outputResult(await msGraphCliConfigExport(await configStoreFor(storeOverride).loadConfigFile()));
    })
  };

  return {
    command: 'config',
    describe: 'Saved mail defaults: signature-file, mailboxes; export them as server defaults',
    builder: (yargs: Argv) => yargs.command(getCommand).command(setCommand).command(unsetCommand).command(exportCommand).demandCommand(1, 'Please specify a config subcommand.'),
    handler: () => undefined
  };
}

/**
 * The `config` command: `get`, `set <key> <value>`, `unset <key>` and `export`.
 */
export const CONFIG_COMMAND: CommandModule = msGraphCliConfigCommand();
