import { type Argv, type CommandModule } from 'yargs';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { requireCliContext } from '../context/cli.context';
import { STANDARD_GLOBAL_OPTION_NAMES } from '../runner/run';
import { CliError, outputError, outputResult } from '../util/output';
import { type CliApiManifest, type CliApiManifestEntry } from './types';

const SKIPPED_VERBS: ReadonlySet<string> = new Set(['standalone']);

const ALL_HELP_FLAG = '--all-help';

const HELP_MODE_FLAG = '--help-mode';

/**
 * Controls which sections of an action's `--help` epilogue are rendered.
 *
 *  - `action` (just the action explainer): only the action description JSDoc.
 *    Useful when you already know the params shape and want to remember what
 *    the command does.
 *  - `params` (just the params explainer): only the params interface
 *    description, per-field descriptions, schema, result, and source. Useful
 *    when you already know what the command does and need to remember the
 *    input shape.
 *  - `both` (default): both sections together.
 */
export type ManifestHelpMode = 'action' | 'params' | 'both';

/**
 * Default help mode when no override is supplied.
 */
export const DEFAULT_MANIFEST_HELP_MODE: ManifestHelpMode = 'both';

const MANIFEST_HELP_MODES: ReadonlySet<ManifestHelpMode> = new Set<ManifestHelpMode>(['action', 'params', 'both']);

/**
 * Format used for the `Params Schema` section of a manifest command's `--help`
 * epilogue.
 *
 *  - `jsonschema` (default): emits a draft-2020-12 JSON Schema, the canonical
 *    shape `--data <json>` must match.
 *  - `arktype`: emits the arktype `expression` string — a compact, copy-pastable
 *    declaration that round-trips through `type(...)` to an equivalent validator.
 *  - `both`: emits the JSON Schema followed by the arktype expression.
 */
export type ManifestHelpDataFormat = 'jsonschema' | 'arktype' | 'both';

/**
 * Default schema format when no override is supplied.
 */
export const DEFAULT_MANIFEST_HELP_DATA_FORMAT: ManifestHelpDataFormat = 'jsonschema';

const MANIFEST_HELP_DATA_FORMATS: ReadonlySet<ManifestHelpDataFormat> = new Set<ManifestHelpDataFormat>(['jsonschema', 'arktype', 'both']);

const DATA_HELP_FLAG = '--data-help';

/**
 * Options accepted by {@link buildManifestCommands}.
 */
export interface BuildManifestCommandsOptions {
  /**
   * argv used to detect `--data-help`, `--all-help`, and similar flags.
   * Defaults to `process.argv`. Tests pass an explicit value so detection
   * does not leak from the surrounding process.
   */
  readonly argv?: readonly string[];
  /**
   * Format used for the `Params Schema` section of `--help`.
   *
   * When omitted, the configured argv is scanned for `--data-help=<format>`
   * (or `--data-help <format>`). Falls back to
   * {@link DEFAULT_MANIFEST_HELP_DATA_FORMAT}.
   */
  readonly dataHelpFormat?: ManifestHelpDataFormat;
  /**
   * Which sections of the help epilogue to render.
   *
   * When omitted, the configured argv is scanned for `--help-mode=<mode>` (or
   * `--help-mode <mode>`). Falls back to {@link DEFAULT_MANIFEST_HELP_MODE}
   * (`both`).
   */
  readonly helpMode?: ManifestHelpMode;
  /**
   * Whether to hide unrelated global options (like `--verbose`, `--dump-dir`,
   * `--pick`, …) from `--help` when the user passed `--data-help`. Defaults
   * to `true` so the help output stays focused on the schema sections.
   *
   * Even when this is `true`, the user can pass `--all-help` to opt back in
   * to the full options table.
   */
  readonly focusHelpOnDataHelp?: boolean;
  /**
   * Names of global options to hide when focus mode is in effect. Defaults
   * to {@link STANDARD_GLOBAL_OPTION_NAMES} (the options registered by
   * {@link createCli}).
   */
  readonly hiddenWhenFocused?: readonly string[];
  /**
   * Name of the parent command that groups all per-model dispatch subcommands.
   * Defaults to {@link DEFAULT_MANIFEST_MODEL_COMMAND_NAME} (`model`), so the
   * full invocation reads `<cli> model <model> <action>`.
   */
  readonly modelCommandName?: string;
}

/**
 * Default name of the parent command that groups all per-model manifest commands.
 * Surfaces as `<cli> model <model> <action>` so the top-level `--help` stays focused
 * on first-class commands instead of dumping every model.
 */
export const DEFAULT_MANIFEST_MODEL_COMMAND_NAME = 'model';

/**
 * Builds yargs `CommandModule[]` from a generated {@link CliApiManifest}.
 *
 * Returns a single parent command (default name `model`) whose subcommands are the per-model
 * dispatch commands. Each per-model subcommand has one child action per entry
 * (named `<verb>` or `<verb>-<specifier>`). Each leaf accepts `--data <json>`, validates the
 * payload against the entry's bound arktype validator (when present), and dispatches via the
 * authenticated CLI context's `callModel` helper. Standalone entries are skipped because they
 * are not dispatched through the `/model/call` endpoint.
 *
 * Wrapping under `model` keeps the top-level `--help` short — users invoke
 * `<cli> model --help` to see the full list of available models.
 *
 * @param manifest - The generated manifest array.
 * @param options - Optional overrides; see {@link BuildManifestCommandsOptions}.
 * @returns The yargs `CommandModule[]` ready to be passed to `runCli({ apiCommands })`. Empty
 *   when the manifest has no callable entries.
 * @__NO_SIDE_EFFECTS__
 */
export function buildManifestCommands(manifest: CliApiManifest, options?: BuildManifestCommandsOptions): CommandModule[] {
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

  if (byModel.size === 0) {
    return [];
  }

  const argv = options?.argv ?? process.argv;
  const dataHelpFormat = options?.dataHelpFormat ?? detectDataHelpFormat(argv);
  const helpMode = options?.helpMode ?? detectHelpMode(argv);
  const focusHelp = (options?.focusHelpOnDataHelp ?? true) && hasDataHelpFlag(argv) && !hasAllHelpFlag(argv);
  const hideOnFocus = focusHelp ? (options?.hiddenWhenFocused ?? STANDARD_GLOBAL_OPTION_NAMES) : [];
  const modelCommandName = options?.modelCommandName ?? DEFAULT_MANIFEST_MODEL_COMMAND_NAME;
  const sortedModels = [...byModel.entries()].sort(([a], [b]) => a.localeCompare(b));
  const context: BuilderContext = { dataHelpFormat, helpMode, hideOnFocus };

  return [
    {
      command: `${modelCommandName} <model>`,
      describe: `Call typed model APIs (${byModel.size} model${byModel.size === 1 ? '' : 's'}). Use \`${modelCommandName} --help\` to list them.`,
      builder: (yargs: Argv) => {
        for (const [model, entries] of sortedModels) {
          yargs.command(buildModelCommand(model, entries, context));
        }

        hideGlobalOptions(yargs, hideOnFocus);

        return yargs.demandCommand(1, 'Please specify a model.');
      },
      handler: () => undefined
    }
  ];
}

interface BuilderContext {
  readonly dataHelpFormat: ManifestHelpDataFormat;
  readonly helpMode: ManifestHelpMode;
  readonly hideOnFocus: readonly string[];
}

/**
 * Returns true if `--data-help` (with or without a value) appears anywhere in
 * the supplied argv. Used to opt into focused help mode.
 *
 * @param argv - argv to scan (defaults to `process.argv`).
 * @returns Whether the user passed `--data-help`.
 */
function hasDataHelpFlag(argv: readonly string[] = process.argv): boolean {
  return argv.some((arg) => arg === DATA_HELP_FLAG || arg.startsWith(`${DATA_HELP_FLAG}=`));
}

/**
 * Returns true if `--all-help` appears anywhere in the supplied argv. Used
 * as an explicit opt-out of focused help mode — `--data-help --all-help`
 * shows the schema sections AND the full options table.
 *
 * @param argv - argv to scan (defaults to `process.argv`).
 * @returns Whether the user passed `--all-help`.
 */
function hasAllHelpFlag(argv: readonly string[] = process.argv): boolean {
  return argv.some((arg) => arg === ALL_HELP_FLAG || arg.startsWith(`${ALL_HELP_FLAG}=`));
}

/**
 * Inspects an argv array for `--data-help=<format>` or `--data-help <format>`
 * and returns the requested {@link ManifestHelpDataFormat}.
 *
 * Implemented as a raw argv scan (rather than going through yargs) because the
 * value is needed when each command's builder runs — which is before yargs
 * parses argv. Unrecognized values fall back to the default.
 *
 * @param argv - argv to inspect (defaults to `process.argv`).
 * @returns The detected format, or {@link DEFAULT_MANIFEST_HELP_DATA_FORMAT}.
 */
export function detectDataHelpFormat(argv: readonly string[] = process.argv): ManifestHelpDataFormat {
  let result: ManifestHelpDataFormat = DEFAULT_MANIFEST_HELP_DATA_FORMAT;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith(`${DATA_HELP_FLAG}=`)) {
      result = parseDataHelpFormat(arg.slice(DATA_HELP_FLAG.length + 1)) ?? result;
      break;
    }

    if (arg === DATA_HELP_FLAG && i + 1 < argv.length) {
      result = parseDataHelpFormat(argv[i + 1]) ?? result;
      break;
    }
  }

  return result;
}

function parseDataHelpFormat(value: string): ManifestHelpDataFormat | undefined {
  return MANIFEST_HELP_DATA_FORMATS.has(value as ManifestHelpDataFormat) ? (value as ManifestHelpDataFormat) : undefined;
}

/**
 * Inspects an argv array for `--help-mode=<mode>` or `--help-mode <mode>` and
 * returns the requested {@link ManifestHelpMode}. Unrecognized values fall
 * back to {@link DEFAULT_MANIFEST_HELP_MODE}.
 *
 * Implemented as a raw argv scan (rather than going through yargs) because the
 * value is needed when each command's builder runs — which is before yargs
 * parses argv.
 *
 * @param argv - argv to inspect (defaults to `process.argv`).
 * @returns The detected mode, or {@link DEFAULT_MANIFEST_HELP_MODE}.
 */
export function detectHelpMode(argv: readonly string[] = process.argv): ManifestHelpMode {
  let result: ManifestHelpMode = DEFAULT_MANIFEST_HELP_MODE;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith(`${HELP_MODE_FLAG}=`)) {
      result = parseHelpMode(arg.slice(HELP_MODE_FLAG.length + 1)) ?? result;
      break;
    }

    if (arg === HELP_MODE_FLAG && i + 1 < argv.length) {
      result = parseHelpMode(argv[i + 1]) ?? result;
      break;
    }
  }

  return result;
}

function parseHelpMode(value: string): ManifestHelpMode | undefined {
  return MANIFEST_HELP_MODES.has(value as ManifestHelpMode) ? (value as ManifestHelpMode) : undefined;
}

function buildModelCommand(model: string, entries: readonly CliApiManifestEntry[], context: BuilderContext): CommandModule {
  return {
    command: `${model} <action>`,
    describe: `Calls for model '${model}' (${entries.length} action${entries.length === 1 ? '' : 's'})`,
    builder: (yargs: Argv) => {
      for (const entry of entries) {
        yargs.command(buildEntryCommand(entry, context));
      }

      hideGlobalOptions(yargs, context.hideOnFocus);

      return yargs.demandCommand(1, 'Please specify an action.');
    },
    handler: () => undefined
  };
}

function buildEntryCommand(entry: CliApiManifestEntry, context: BuilderContext): CommandModule {
  const action = entry.specifier && entry.specifier !== '_' ? `${entry.verb}-${entry.specifier}` : entry.verb;
  const specPart = entry.specifier && entry.specifier !== '_' ? ' ' + entry.specifier : '';
  const fallbackDescribe = `${entry.verb}${specPart} on ${entry.model}`;
  const describeOneLine = oneLineDescription(entry.description) ?? fallbackDescribe;
  const epilogue = buildEntryEpilogue(entry, context);

  return {
    command: action,
    describe: describeOneLine,
    builder: (yargs: Argv) => {
      const y = yargs.option('data', {
        type: 'string',
        describe: 'JSON-encoded payload (defaults to {} when omitted)'
      });

      hideGlobalOptions(y, context.hideOnFocus);

      return epilogue ? y.epilogue(epilogue) : y;
    },
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

function oneLineDescription(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const firstLine = description.split('\n', 1)[0]?.trim();
  return firstLine && firstLine.length > 0 ? firstLine : undefined;
}

function hideGlobalOptions(yargs: Argv, names: readonly string[]): void {
  for (const name of names) {
    yargs.hide(name);
  }
}

/**
 * Builds the help epilogue for a manifest-driven command. Surfaces the action
 * description JSDoc, the params interface description and per-field
 * descriptions, the params arktype validator (as JSON Schema and/or arktype
 * expression — see {@link ManifestHelpDataFormat}), and the source `.api.ts`
 * path for traceability. Designed to give both humans and LLM agents enough
 * information from `--help` alone to understand a command and construct a
 * valid `--data` payload.
 *
 * @param entry - Manifest entry whose metadata becomes the help epilogue.
 * @param context - Builder context controlling schema format and which sections
 *   to render (see {@link ManifestHelpMode}).
 * @returns Multi-section epilogue string, or `undefined` when the entry has no
 *   metadata worth surfacing.
 */
function buildEntryEpilogue(entry: CliApiManifestEntry, context: BuilderContext): string | undefined {
  const { dataHelpFormat, helpMode } = context;
  const showAction = helpMode === 'action' || helpMode === 'both';
  const showParams = helpMode === 'params' || helpMode === 'both';
  const sections: string[] = [];

  if (showAction) {
    const actionSection = buildActionSection(entry);
    if (actionSection) sections.push(actionSection);
  }

  let schemaSections: string[] = [];

  if (showParams) {
    const paramsSection = buildParamsSection(entry);
    if (paramsSection) sections.push(paramsSection);

    schemaSections = renderParamsSchemaSections(entry, dataHelpFormat);
    sections.push(...schemaSections);

    const resultSection = buildResultSection(entry);
    if (resultSection) {
      sections.push(resultSection);
    } else if (entry.resultTypeName) {
      sections.push(`Result: ${entry.resultTypeName}`);
    }
  }

  if (entry.sourceFile) {
    sections.push(`Source: ${entry.sourceFile}`);
  }

  if (showParams && schemaSections.length > 0 && dataHelpFormat !== 'both') {
    const other = dataHelpFormat === 'jsonschema' ? 'arktype' : 'jsonschema';
    sections.push(`(Pass --data-help=${other} or --data-help=both to switch the schema format above.)`);
  }

  if (helpMode === 'both' && (entry.description || entry.paramsTypeDescription || (entry.paramsFields && entry.paramsFields.length > 0))) {
    sections.push(`(Pass --help-mode=action or --help-mode=params to focus this help on a single section.)`);
  }

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

function buildActionSection(entry: CliApiManifestEntry): string | undefined {
  if (!entry.description) return undefined;
  return `About:\n${indentLines(entry.description, '  ')}`;
}

function buildParamsSection(entry: CliApiManifestEntry): string | undefined {
  if (!entry.paramsTypeName && !entry.paramsTypeDescription && !(entry.paramsFields && entry.paramsFields.length > 0)) {
    return undefined;
  }

  const lines: string[] = [];
  if (entry.paramsTypeName) {
    lines.push(`Params: ${entry.paramsTypeName}`);
  }
  if (entry.paramsTypeDescription) {
    lines.push(indentLines(entry.paramsTypeDescription, '  '));
  }

  if (entry.paramsFields && entry.paramsFields.length > 0) {
    lines.push('');
    lines.push('Fields:');
    for (const field of entry.paramsFields) {
      const header = `  - ${field.name}: ${field.typeText}`;
      lines.push(header);
      if (field.description) {
        lines.push(indentLines(field.description, '      '));
      }
    }
  }

  return lines.join('\n');
}

function buildResultSection(entry: CliApiManifestEntry): string | undefined {
  if (!entry.resultTypeDescription && !(entry.resultFields && entry.resultFields.length > 0)) {
    return undefined;
  }

  const lines: string[] = [];
  if (entry.resultTypeName) {
    lines.push(`Result: ${entry.resultTypeName}`);
  }
  if (entry.resultTypeDescription) {
    lines.push(indentLines(entry.resultTypeDescription, '  '));
  }

  if (entry.resultFields && entry.resultFields.length > 0) {
    lines.push('');
    lines.push('Fields:');
    for (const field of entry.resultFields) {
      const header = `  - ${field.name}: ${field.typeText}`;
      lines.push(header);
      if (field.description) {
        lines.push(indentLines(field.description, '      '));
      }
    }
  }

  return lines.join('\n');
}

function indentLines(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
}

function renderParamsSchemaSections(entry: CliApiManifestEntry, dataHelpFormat: ManifestHelpDataFormat): string[] {
  const sections: string[] = [];

  if (!entry.paramsValidator) {
    return sections;
  }

  if (dataHelpFormat === 'jsonschema' || dataHelpFormat === 'both') {
    const jsonSchemaSection = renderJsonSchemaSection(entry);

    if (jsonSchemaSection) {
      sections.push(jsonSchemaSection);
    }
  }

  if (dataHelpFormat === 'arktype' || dataHelpFormat === 'both') {
    const arktypeSection = renderArktypeExpressionSection(entry);

    if (arktypeSection) {
      sections.push(arktypeSection);
    }
  }

  if (sections.length === 0) {
    // Last-ditch fallback when the requested format produced nothing usable
    // (e.g. arktype was requested but the bound validator has no expression).
    const expression = readArktypeExpression(entry);

    if (expression) {
      sections.push(`Params Schema (arktype): ${expression}`);
    }
  }

  return sections;
}

function renderJsonSchemaSection(entry: CliApiManifestEntry): string | undefined {
  if (!entry.paramsValidator) {
    return undefined;
  }

  let result: string | undefined;

  try {
    // arktype's default `toJsonSchema` throws on any sub-schema that has no
    // JSON Schema equivalent (custom predicates, morphs, `undefined`/symbol/
    // bigint units or domains, etc.). Provide targeted fallbacks so help
    // output stays useful:
    //   - `predicate` / `morph`: drop the lossy part, keep the JSON-shaped
    //     base — e.g. `string > 0 & narrow(isFirestoreModelKey)` becomes
    //     `{ type: 'string', minLength: 1 }`.
    //   - everything else (e.g. the `undefined` unit in `clearable(T)`):
    //     return `false` (matches nothing). It's a no-op inside `anyOf`, and
    //     we strip it below so `T | null | undefined` reads as `T | null`.
    const raw = entry.paramsValidator.toJsonSchema({
      fallback: {
        predicate: (ctx) => ctx.base,
        morph: (ctx) => ctx.base,
        // `false` is a valid JSON Schema value ("matches nothing"), but
        // arktype's TS types reject `false` for the fallback return — cast
        // through `unknown` to keep the runtime behavior we want.
        default: (() => false) as unknown as (ctx: unknown) => never
      }
    });
    // arktype's fallback returns boxed schema nodes (objects with a `toJSON()`
    // method that emits the bare JSON Schema value, e.g. `false`). Round-trip
    // through JSON to invoke those `toJSON()` callbacks before pruning;
    // `structuredClone` would not call them.
    const normalized = JSON.parse(JSON.stringify(raw));
    const pruned = pruneFalseUnionBranches(normalized);
    result = `Params Schema (JSON Schema):\n${JSON.stringify(pruned, null, 2)}`;
  } catch {
    const expression = readArktypeExpression(entry);
    if (expression) {
      result = `Params Schema (arktype): ${expression}`;
    }
  }

  return result;
}

function renderArktypeExpressionSection(entry: CliApiManifestEntry): string | undefined {
  const expression = readArktypeExpression(entry);
  return expression ? `Params Schema (arktype):\n${expression}` : undefined;
}

function readArktypeExpression(entry: CliApiManifestEntry): string | undefined {
  return (entry.paramsValidator as { readonly expression?: string } | undefined)?.expression;
}

/**
 * Walks a JSON Schema and removes `false` entries from `anyOf` / `oneOf`
 * arrays. `false` schemas match nothing, so dropping them does not change
 * what the schema accepts — it just keeps the rendered output clean when
 * `toJsonSchema` was given a `() => false` fallback for unjsonifiable types
 * like `undefined`.
 *
 * @param value - JSON Schema fragment to clean.
 * @returns A structurally equivalent fragment with `false` branches dropped
 *   from any `anyOf` / `oneOf` arrays.
 */
function pruneFalseUnionBranches(value: unknown): unknown {
  let result: unknown = value;

  if (Array.isArray(value)) {
    result = value.map(pruneFalseUnionBranches);
  } else if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if ((key === 'anyOf' || key === 'oneOf') && Array.isArray(raw)) {
        const filtered = raw.filter((v) => v !== false).map(pruneFalseUnionBranches);

        if (filtered.length > 0) {
          out[key] = filtered;
        }
      } else {
        out[key] = pruneFalseUnionBranches(raw);
      }
    }

    result = out;
  }

  return result;
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
