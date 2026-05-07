import { type Argv, type CommandModule } from 'yargs';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { requireCliContext } from '../context/cli.context';
import { CliError, outputError, outputResult } from '../util/output';
import { type CliApiManifest, type CliApiManifestEntry } from './types';

const SKIPPED_VERBS: ReadonlySet<string> = new Set(['standalone']);

/**
 * Builds yargs `CommandModule[]` from a generated {@link CliApiManifest}.
 *
 * Groups entries by `model`, emitting one parent command per model and one child action per entry
 * (named `<verb>` or `<verb>-<specifier>`). Each child accepts `--data <json>`, validates the
 * payload against the entry's bound arktype validator (when present), and dispatches via the
 * authenticated CLI context's `callModel` helper. Standalone entries are skipped because they
 * are not dispatched through the `/model/call` endpoint.
 *
 * @param manifest - The generated manifest array.
 * @returns The yargs `CommandModule[]` ready to be passed to `runCli({ apiCommands })`.
 */
export function buildManifestCommands(manifest: CliApiManifest): CommandModule[] {
  const callable = manifest.filter((e) => !SKIPPED_VERBS.has(e.verb));
  const byModel = new Map<string, CliApiManifestEntry[]>();

  for (const entry of callable) {
    const list = byModel.get(entry.model);

    if (list) {
      list.push(entry);
    } else {
      byModel.set(entry.model, [entry]);
    }
  }

  const commands: CommandModule[] = [];

  for (const [model, entries] of [...byModel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    commands.push(buildModelCommand(model, entries));
  }

  return commands;
}

function buildModelCommand(model: string, entries: readonly CliApiManifestEntry[]): CommandModule {
  return {
    command: `${model} <action>`,
    describe: `Calls for model '${model}' (${entries.length} action${entries.length === 1 ? '' : 's'})`,
    builder: (yargs: Argv) => {
      for (const entry of entries) {
        yargs.command(buildEntryCommand(entry));
      }

      return yargs.demandCommand(1, 'Please specify an action.');
    },
    handler: () => undefined
  };
}

function buildEntryCommand(entry: CliApiManifestEntry): CommandModule {
  const action = entry.specifier && entry.specifier !== '_' ? `${entry.verb}-${entry.specifier}` : entry.verb;
  const specPart = entry.specifier && entry.specifier !== '_' ? ' ' + entry.specifier : '';
  const describe = entry.description ?? `${entry.verb}${specPart} on ${entry.model}`;

  return {
    command: action,
    describe,
    builder: (yargs: Argv) =>
      yargs.option('data', {
        type: 'string',
        describe: 'JSON-encoded payload (defaults to {} when omitted)'
      }),
    handler: async (argv: any) => {
      try {
        await callEntry(entry, typeof argv.data === 'string' ? argv.data : undefined);
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
  };
}

async function callEntry(entry: CliApiManifestEntry, rawData: string | undefined): Promise<void> {
  const ctx = requireCliContext();
  const data = parseAndValidate(entry, rawData);

  const params: OnCallTypedModelParams = {
    modelType: entry.model,
    call: entry.verb,
    ...(entry.specifier ? { specifier: entry.specifier } : {}),
    data
  };

  const result = await ctx.callModel(params);
  outputResult(result);
}

function parseAndValidate(entry: CliApiManifestEntry, rawData: string | undefined): unknown {
  const parsed = parseJsonData(rawData);

  if (!entry.paramsValidator) {
    return parsed;
  }

  const validated = entry.paramsValidator(parsed);

  if (validated instanceof Error) {
    const action = entry.specifier && entry.specifier !== '_' ? `${entry.verb}-${entry.specifier}` : entry.verb;
    throw new CliError({
      message: `Invalid --data for ${entry.model} ${action}: ${validated.message}`,
      code: 'VALIDATION_ERROR'
    });
  }

  return validated;
}

function parseJsonData(rawData: string | undefined): unknown {
  if (typeof rawData !== 'string' || rawData.length === 0) {
    return {};
  }

  try {
    return JSON.parse(rawData);
  } catch (e) {
    throw new CliError({
      message: `--data must be valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      code: 'INVALID_DATA_JSON'
    });
  }
}
