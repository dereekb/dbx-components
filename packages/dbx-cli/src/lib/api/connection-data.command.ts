import { readFile } from 'node:fs/promises';
import type { Argv, CommandModule } from 'yargs';
import {
  type ReadUserExternalConnectionDataParams,
  type ReadUserExternalConnectionDataResult,
  type UpdateUserExternalConnectionDataParams,
  type UpdateUserExternalConnectionDataResult,
  type UserExternalConnectionDataSetOperation,
  type UserExternalConnectionDataTypeConfig,
  type UserExternalConnectionDataTypeConfigLookup,
  type UserExternalConnectionDataValue,
  type UserExternalConnectionProviderData,
  type UserExternalConnectionProviderType,
  normalizeUserExternalConnectionDataItemKey,
  userExternalConnectionDataTypeConfigLookup
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { wrapCommandHandler } from '../util/handler';
import { CliError, outputResult } from '../util/output';
import { isStdinSentinel, readAllStdin } from '../util/stdin';
import { type CliExternalConnectionDataAdapter, type CliExternalConnectionDataConfig, type CliExternalConnectionSettings } from './external-connection-data';

/**
 * Default command name for the connection-data command group.
 */
export const DEFAULT_CONNECTION_DATA_COMMAND_NAME = 'connection-data';

/**
 * The model the connection-data commands call (`read` / `update` with the `data` specifier).
 */
export const CONNECTION_DATA_MODEL_TYPE = 'userExternalConnection';

/**
 * The model API specifier of the connection-data calls.
 */
export const CONNECTION_DATA_MODEL_SPECIFIER = 'data';

/**
 * The hint `set` / `import` / `unset` end with: stored data reaches a consuming CLI only when it mints its next token.
 */
export const CONNECTION_DATA_REFRESH_HINT = 'Connection defaults are read when a token is minted; run `<consumer-cli> auth token-source refresh` (e.g. `msgraph-cli auth token-source refresh`) to apply them now.';

/**
 * Input to {@link buildConnectionDataCommand}.
 */
export interface BuildConnectionDataCommandInput {
  /**
   * The CLI's binary name, used in help text.
   */
  readonly cliName?: Maybe<string>;
  /**
   * The app's connection-data config: its data type registry and per-provider adapters.
   */
  readonly config?: Maybe<CliExternalConnectionDataConfig>;
  readonly commandName?: Maybe<string>;
}

/**
 * Builds the `connection-data` command group: `list`, `get`, `set`, `unset` and `import` over the signed-in
 * user's stored connection data (`UserExternalConnectionData`), through the `userExternalConnection` model's
 * `read` / `update` `data` specifier.
 *
 * The calls need a login with `model.read` / `model.update` (the everyday env), not an external-token env. Only
 * `get` prints values.
 *
 * @param input - The CLI's name and connection-data config.
 * @returns A yargs `CommandModule` for the API command list.
 *
 * @example
 * ```typescript
 * builtInApiCommands.push(buildConnectionDataCommand({ cliName: 'demo-cli', config: input.externalConnectionData }));
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildConnectionDataCommand(input?: Maybe<BuildConnectionDataCommandInput>): CommandModule {
  const commandName = input?.commandName ?? DEFAULT_CONNECTION_DATA_COMMAND_NAME;
  const cli = input?.cliName ?? '<cli>';
  const config = input?.config;
  const lookup = userExternalConnectionDataTypeConfigLookup(config?.dataTypes);
  const loginNote = 'Needs a login with model.read / model.update (your everyday env, not an external-token env).';

  const listCommand: CommandModule = {
    command: 'list [providerType]',
    describe: 'List your stored items (keys and sizes, never values) and the data types you may store',
    builder: (yargs: Argv) => yargs.positional('providerType', { type: 'string', describe: 'Only this provider, e.g. "microsoft"' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const providerType = optionalString(argv.providerType);
      const result = await readConnectionData(requireCliContext(), { ...(providerType ? { providerType } : {}), keysOnly: true });
      outputResult({ items: result.items, dataTypes: result.dataTypes });
    })
  };

  const getCommand: CommandModule = {
    command: 'get <providerType> [dataType] [itemKey]',
    describe: 'Print your stored values for a provider, optionally one data type or item',
    builder: (yargs: Argv) =>
      yargs
        .positional('providerType', { type: 'string', demandOption: true, describe: 'The provider, e.g. "microsoft"' })
        .positional('dataType', { type: 'string', describe: 'Only this data type, e.g. "mail_signature"' })
        .positional('itemKey', { type: 'string', describe: 'Only this item, e.g. "me" or an email address' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const providerType = String(argv.providerType);
      const dataType = optionalString(argv.dataType);
      const rawItemKey = optionalString(argv.itemKey);
      const itemKey = rawItemKey != null && dataType != null ? normalizeItemKey({ lookup, providerType, dataType, itemKey: rawItemKey }) : rawItemKey;
      const result = await readConnectionData(requireCliContext(), { providerType, ...(dataType ? { dataType } : {}), ...(itemKey ? { itemKey } : {}) });
      outputResult({ data: result.data?.[providerType] ?? {}, items: result.items });
    })
  };

  const setCommand: CommandModule = {
    command: 'set <providerType> <dataType> <itemKey>',
    describe: 'Save one item, from --file (packed by the data type) or --json',
    builder: (yargs: Argv) =>
      yargs
        .positional('providerType', { type: 'string', demandOption: true, describe: 'The provider, e.g. "microsoft"' })
        .positional('dataType', { type: 'string', demandOption: true, describe: 'The data type, e.g. "mail_signature"' })
        .positional('itemKey', { type: 'string', demandOption: true, describe: 'The item key, e.g. "me" or an email address' })
        .option('file', { type: 'string', describe: 'Read the value from a file (or - for stdin), converted by the data type (e.g. an .html signature)' })
        .option('json', { type: 'string', describe: 'The value as a JSON object (or - to read it from stdin)' })
        .nargs('file', 1)
        .nargs('json', 1)
        .example([[`$0 ${commandName} set microsoft mail_signature me --file signature.html`, 'Save your own mail signature']]),
    handler: wrapCommandHandler(async (argv: any) => {
      const providerType = String(argv.providerType);
      const dataType = String(argv.dataType);
      const itemKey = normalizeItemKey({ lookup, providerType, dataType, itemKey: String(argv.itemKey) });
      const value = await readSetValue({ lookup, providerType, dataType, file: optionalString(argv.file), json: optionalString(argv.json) });
      const result = await updateConnectionData(requireCliContext(), { providerType, set: [{ dataType, itemKey, value }] });
      outputResult({ items: result.items, next: CONNECTION_DATA_REFRESH_HINT });
    })
  };

  const unsetCommand: CommandModule = {
    command: 'unset <providerType> <dataType> [itemKey]',
    describe: 'Remove one item, or a whole data type when no item key is given',
    builder: (yargs: Argv) =>
      yargs
        .positional('providerType', { type: 'string', demandOption: true, describe: 'The provider, e.g. "microsoft"' })
        .positional('dataType', { type: 'string', demandOption: true, describe: 'The data type, e.g. "mail_signature"' })
        .positional('itemKey', { type: 'string', describe: 'The item key. Omit to remove every item of the data type.' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const providerType = String(argv.providerType);
      const dataType = String(argv.dataType);
      const rawItemKey = optionalString(argv.itemKey);
      const itemKey = rawItemKey == null ? undefined : normalizeItemKey({ lookup, providerType, dataType, itemKey: rawItemKey });
      const result = await updateConnectionData(requireCliContext(), { providerType, unset: [{ dataType, ...(itemKey ? { itemKey } : {}) }] });
      outputResult({ items: result.items, next: CONNECTION_DATA_REFRESH_HINT });
    })
  };

  const importCommand: CommandModule = {
    command: 'import <providerType>',
    describe: "Save a consuming CLI's exported settings (e.g. `msgraph-cli config export`) as stored data",
    builder: (yargs: Argv) =>
      yargs
        .positional('providerType', { type: 'string', demandOption: true, describe: 'The provider, e.g. "microsoft"' })
        .option('file', { type: 'string', demandOption: true, describe: 'The settings JSON file, or - for stdin. A `{ ok, data }` CLI envelope is accepted.' })
        .option('replace', { type: 'boolean', default: false, describe: "Drop the provider's other stored data first" })
        .nargs('file', 1)
        .example([[`msgraph-cli config export | $0 ${commandName} import microsoft --file -`, 'Store your local msgraph-cli signatures for every machine']]),
    handler: wrapCommandHandler(async (argv: any) => {
      const providerType = String(argv.providerType);
      const adapter = adapterFor(config, providerType);

      if (!adapter?.pack) {
        throw new CliError({ message: `${commandName} import is not available for "${providerType}": ${cli} has no settings adapter for it.`, code: 'INVALID_ARGUMENT', suggestion: `Use \`${cli} ${commandName} set ${providerType} <dataType> <itemKey> --json …\` instead.` });
      }

      const settings = readImportSettings(await readTextInput(String(argv.file), '--file'));
      const set = connectionDataSetOperations({ lookup, providerType, data: adapter.pack({ providerType, settings }) });

      if (set.length === 0 && argv.replace !== true) {
        throw new CliError({ message: `${commandName} import found nothing to store for "${providerType}".`, code: 'INVALID_ARGUMENT' });
      }

      const result = await updateConnectionData(requireCliContext(), { providerType, set, ...(argv.replace === true ? { clear: true } : {}) });
      outputResult({ imported: set.length, items: result.items, next: CONNECTION_DATA_REFRESH_HINT });
    })
  };

  return {
    command: commandName,
    describe: `Manage your stored connection data (per-provider defaults such as mail signatures, encrypted on the server). ${loginNote}`,
    builder: (yargs: Argv) => yargs.command(listCommand).command(getCommand).command(setCommand).command(unsetCommand).command(importCommand).demandCommand(1, `Please specify a ${commandName} subcommand.`),
    handler: () => undefined
  };
}

/**
 * Input to {@link connectionDataSetOperations}.
 */
export interface ConnectionDataSetOperationsInput {
  readonly lookup?: Maybe<UserExternalConnectionDataTypeConfigLookup>;
  readonly providerType: UserExternalConnectionProviderType;
  readonly data: UserExternalConnectionProviderData;
}

/**
 * Builds one `set` operation per stored item of provider data, normalizing item keys with the registry when the
 * data type is registered.
 *
 * @param input - The registry, the provider, and the data.
 * @returns The set operations.
 * @throws {CliError} An `INVALID_ARGUMENT` error when an item key is invalid or a value is not an object.
 */
export function connectionDataSetOperations(input: ConnectionDataSetOperationsInput): UserExternalConnectionDataSetOperation[] {
  const { lookup, providerType, data } = input;
  const result: UserExternalConnectionDataSetOperation[] = [];

  for (const [dataType, items] of Object.entries(data)) {
    for (const [rawItemKey, value] of Object.entries(items ?? {})) {
      if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        throw new CliError({ message: `The "${dataType}" item "${rawItemKey}" is not an object.`, code: 'INVALID_ARGUMENT' });
      }

      const itemKey = normalizeItemKey({ lookup, providerType, dataType, itemKey: rawItemKey });
      result.push({ dataType, itemKey, value: value as UserExternalConnectionDataValue });
    }
  }

  return result;
}

/**
 * Reads the settings `import` stores: a bare settings object, or a dbx-cli `{ ok: true, data }` envelope.
 *
 * @param text - The JSON text.
 * @returns The settings.
 * @throws {CliError} An `INVALID_ARGUMENT` error when the text is not a JSON object. The text is never echoed.
 */
export function readImportSettings(text: string): CliExternalConnectionSettings {
  const parsed = parseJsonObject(text, 'The settings');
  const envelopeData = parsed['ok'] === true ? parsed['data'] : undefined;
  let result: CliExternalConnectionSettings = parsed;

  if (envelopeData !== undefined) {
    if (envelopeData == null || typeof envelopeData !== 'object' || Array.isArray(envelopeData)) {
      throw new CliError({ message: "The settings envelope's `data` is not a JSON object.", code: 'INVALID_ARGUMENT' });
    }

    result = envelopeData as CliExternalConnectionSettings;
  }

  return result;
}

// MARK: Internal
async function readConnectionData(context: CliContext, data: ReadUserExternalConnectionDataParams): Promise<ReadUserExternalConnectionDataResult> {
  return context.callModel<ReadUserExternalConnectionDataParams, ReadUserExternalConnectionDataResult>({ modelType: CONNECTION_DATA_MODEL_TYPE, call: 'read', specifier: CONNECTION_DATA_MODEL_SPECIFIER, data });
}

async function updateConnectionData(context: CliContext, data: UpdateUserExternalConnectionDataParams): Promise<UpdateUserExternalConnectionDataResult> {
  return context.callModel<UpdateUserExternalConnectionDataParams, UpdateUserExternalConnectionDataResult>({ modelType: CONNECTION_DATA_MODEL_TYPE, call: 'update', specifier: CONNECTION_DATA_MODEL_SPECIFIER, data });
}

function adapterFor(config: Maybe<CliExternalConnectionDataConfig>, providerType: string): Maybe<CliExternalConnectionDataAdapter> {
  const adapters = config?.adapters;
  return adapters != null && Object.hasOwn(adapters, providerType) ? adapters[providerType] : undefined;
}

interface NormalizeItemKeyInput {
  readonly lookup?: Maybe<UserExternalConnectionDataTypeConfigLookup>;
  readonly providerType: string;
  readonly dataType: string;
  readonly itemKey: string;
}

function normalizeItemKey(input: NormalizeItemKeyInput): string {
  const { providerType, dataType, itemKey } = input;
  const config: Pick<UserExternalConnectionDataTypeConfig, 'normalizeItemKey'> = input.lookup?.configFor(providerType, dataType) ?? {};
  const normalized = normalizeUserExternalConnectionDataItemKey(config, itemKey);

  if (!normalized) {
    const description = input.lookup?.configFor(providerType, dataType)?.itemKeyDescription;
    throw new CliError({ message: `Invalid item key "${itemKey}" for "${dataType}".`, code: 'INVALID_ARGUMENT', ...(description ? { suggestion: `Use ${description}.` } : {}) });
  }

  return normalized;
}

interface ReadSetValueInput {
  readonly lookup: UserExternalConnectionDataTypeConfigLookup;
  readonly providerType: string;
  readonly dataType: string;
  readonly file?: Maybe<string>;
  readonly json?: Maybe<string>;
}

async function readSetValue(input: ReadSetValueInput): Promise<UserExternalConnectionDataValue> {
  const { lookup, providerType, dataType, file, json } = input;
  let result: UserExternalConnectionDataValue;

  if ((file == null) === (json == null)) {
    throw new CliError({ message: 'Give the value with exactly one of --file or --json.', code: 'INVALID_ARGUMENT' });
  }

  if (file != null) {
    const packFile = lookup.configFor(providerType, dataType)?.packFile;

    if (!packFile) {
      throw new CliError({ message: `"${dataType}" values cannot be read from a file for "${providerType}".`, code: 'INVALID_ARGUMENT', suggestion: 'Give the value as a JSON object with --json.' });
    }

    const content = await readTextInput(file, '--file');

    try {
      result = packFile({ fileName: isStdinSentinel(file) ? '' : file, content }) as UserExternalConnectionDataValue;
    } catch {
      // the file's content never reaches the error
      throw new CliError({ message: `The file could not be converted to a "${dataType}" value.`, code: 'INVALID_ARGUMENT' });
    }
  } else {
    result = parseJsonObject(await readTextInput(json as string, '--json', true), '--json');
  }

  return result;
}

async function readTextInput(value: string, flag: string, inline = false): Promise<string> {
  let result: string;

  if (isStdinSentinel(value)) {
    result = await readAllStdin();
  } else if (inline) {
    result = value;
  } else {
    try {
      result = await readFile(value, 'utf8');
    } catch (e) {
      const code = (e as { readonly code?: unknown })?.code;
      throw new CliError({ message: `${flag}: could not read "${value}"${typeof code === 'string' ? ` (${code})` : ''}.`, code: 'INVALID_ARGUMENT' });
    }
  }

  return result;
}

function parseJsonObject(text: string, label: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    // JSON.parse messages can quote the input; never echo it
    parsed = undefined;
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CliError({ message: `${label} must be a JSON object.`, code: 'INVALID_ARGUMENT' });
  }

  return parsed as Record<string, unknown>;
}

function optionalString(value: unknown): Maybe<string> {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
