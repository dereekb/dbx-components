import { type Maybe, makeValuesGroupMap } from '@dereekb/util';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type McpManifestModelEntry } from '../mcp.manifest';
import { formatMcpToolErrorResponse } from '../mcp.response-formatter';
import { buildStaticWireEntry, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';

// MARK: Constants
/**
 * Reserved tool name for the built-in `model-info` static tool.
 */
export const MODEL_INFO_TOOL_NAME = 'model-info';

/**
 * Synthetic call type used in the tool's dispatch identity. Aligns with the dbx-cli `model-info`
 * command.
 */
export const MODEL_INFO_DISPATCH_CALL = 'info';

/**
 * Synthetic model type used in the tool's dispatch identity. Mirrors {@link MODEL_GET_DISPATCH_MODEL_TYPE};
 * apps avoiding collisions should not register a real model literally named "model".
 */
export const MODEL_INFO_DISPATCH_MODEL_TYPE = 'model';

/**
 * Group label applied to manifest entries that declare no `modelGroup`. Keeps the `groups` mode
 * total reconcilable with the catalog size (sum of group counts always equals `totalModels`).
 */
export const MODEL_INFO_UNGROUPED_LABEL = '(ungrouped)';

/**
 * Hint string surfaced alongside the default `groups` response so callers know how to drill in.
 */
export const MODEL_INFO_GROUPS_HINT = 'Pass `model` for one/many models, `modelGroup` for a group, or `all:true` for the full catalog.';

// MARK: Types
/**
 * Constructor dependencies for {@link createModelInfoTool}.
 */
export interface CreateModelInfoToolDeps {
  /**
   * Frozen catalog of Firestore models exposed by the host app, sourced from the build-time
   * manifest JSON.
   */
  readonly manifest: readonly McpManifestModelEntry[];
}

/**
 * Public shape of the `model-info` tool input. Every field is optional; the combination selects
 * the response mode (see {@link createModelInfoTool}).
 */
export interface ModelInfoToolInput {
  /**
   * One model (string) or many (string array), each matched by `modelType`, `identityConst`, or
   * `collectionPrefix`. A string yields `mode: 'single'`; an array yields `mode: 'multiple'`.
   */
  readonly model?: string | ReadonlyArray<string>;
  /**
   * Returns the summary list of models in this group (`mode: 'list'`). Matched case-insensitively.
   */
  readonly modelGroup?: string;
  /**
   * Opt in to the full catalog summary (every model). Never the default.
   */
  readonly all?: boolean;
  /**
   * Forces (`true`) or suppresses (`false`) full persisted-field detail in `list` / `multiple`
   * modes. Defaults to summary rows for `list`, full entries for `single` / `multiple`.
   */
  readonly fields?: boolean;
}

/**
 * Normalized form of {@link ModelInfoToolInput} produced by {@link parseModelInfoInput}. The
 * `model` arg is collapsed to a query array plus a flag recording whether it arrived as an array
 * (which drives `single` vs `multiple` mode).
 */
export interface ParsedModelInfoInput {
  readonly modelQueries?: ReadonlyArray<string>;
  readonly modelIsArray: boolean;
  readonly modelGroup?: string;
  readonly all: boolean;
  readonly fields?: boolean;
}

/**
 * Summary row returned in list/group modes and (when `fields: false`) in single/multiple modes.
 */
export interface ModelInfoSummaryRow {
  readonly modelType: string;
  readonly modelName: string;
  readonly modelGroup?: string;
  readonly identityConst: string;
  readonly collectionPrefix: string;
  readonly parentIdentityConst?: string;
  readonly sourcePackage: string;
  readonly fieldCount: number;
  readonly description?: string;
  readonly read?: 'system' | 'owner' | 'admin-only' | 'permissions';
  readonly serviceFactoryExport?: string;
}

/**
 * One row in a model-bearing response: either a compact {@link ModelInfoSummaryRow} or the full
 * {@link McpManifestModelEntry} (including persisted `fields`). The `fields` toggle and the active
 * mode decide which form is emitted.
 */
export type ModelInfoModelRow = ModelInfoSummaryRow | McpManifestModelEntry;

/**
 * One model group and the number of models it contains. Returned in the default `groups` mode.
 */
export interface ModelInfoGroupCount {
  readonly modelGroup: string;
  readonly modelCount: number;
}

/**
 * A model query that matched nothing. Mirrors `model-get`'s per-key `{ key, message }` error shape
 * with `query` standing in for `key`.
 */
export interface ModelInfoNotFound {
  readonly query: string;
  readonly message: string;
}

/**
 * Output payload for the `model-info` tool. The `mode` field discriminates the variant:
 * - `groups`: model groups + counts (the default, no-arg response).
 * - `list`: a summary (or, with `fields: true`, full) list — used by `modelGroup` and `all`.
 * - `single`: full detail for one `model` string.
 * - `multiple`: full detail per match for a `model` array, with misses in `notFound`.
 */
export type ModelInfoToolOutput = { readonly mode: 'groups'; readonly groups: ReadonlyArray<ModelInfoGroupCount>; readonly totalModels: number; readonly hint: string } | { readonly mode: 'list'; readonly models: ReadonlyArray<ModelInfoModelRow>; readonly modelGroup?: string } | { readonly mode: 'single'; readonly model: ModelInfoModelRow } | { readonly mode: 'multiple'; readonly models: ReadonlyArray<ModelInfoModelRow>; readonly notFound?: ReadonlyArray<ModelInfoNotFound> };

// MARK: Factory
/**
 * Builds the built-in `model-info` MCP tool definition.
 *
 * Modes (selected by input):
 * - No args: returns model groups + counts (`mode: 'groups'`) — the cheap default for browsing.
 * - `model` (string): returns the full entry for one model (`mode: 'single'`).
 * - `model` (string array): returns full detail per match (`mode: 'multiple'`); misses land in `notFound`.
 * - `modelGroup`: returns the summary list of that group's models (`mode: 'list'`).
 * - `all: true`: returns the full catalog summary (`mode: 'list'`).
 * - `fields`: forces (`true`) or suppresses (`false`) full persisted-field detail in list/multiple modes.
 *
 * Each `model` query matches by `modelType`, `identityConst`, or `collectionPrefix`. When several
 * params are supplied, precedence is `model` > `modelGroup` > `all` > the default `groups` view.
 *
 * Output is delivered as both stringified JSON in `content[0].text` and `structuredContent`
 * so MCP clients can consume either form.
 *
 * @param deps - The frozen model manifest loaded at boot from the MCP manifest JSON.
 * @returns A statically-registered {@link McpToolDefinition} ready to be appended to the MCP
 *   server factory's tool registry.
 */
export function createModelInfoTool(deps: CreateModelInfoToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (args, ctx) => Promise.resolve(modelInfoToolHandler(args, ctx, deps));
  const name = MODEL_INFO_TOOL_NAME;
  const count = deps.manifest.length;
  const description =
    `Browse the Firestore model catalog (${count} model${count === 1 ? '' : 's'}). No args returns model groups + counts (start here). ` + '`model` (a modelType/identityConst/collectionPrefix string, or an array of them) returns full detail per match — misses are reported in `notFound`. ' + '`modelGroup` returns the summary list for that group. `all:true` returns the full catalog summary. ' + '`fields` (boolean) forces or suppresses persisted-field detail in list/multiple modes.';

  return {
    name,
    description,
    inputSchema: MODEL_INFO_INPUT_SCHEMA,
    outputSchema: MODEL_INFO_OUTPUT_SCHEMA,
    dispatch: {
      call: MODEL_INFO_DISPATCH_CALL,
      modelType: MODEL_INFO_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    filterMetadata: {
      visibilityKind: 'declarative',
      rule: { requireAuthenticated: true },
      effectiveReadOnly: true
    },
    staticWireEntry: buildStaticWireEntry({ name, description, inputSchema: MODEL_INFO_INPUT_SCHEMA, outputSchema: MODEL_INFO_OUTPUT_SCHEMA })
  };
}

// MARK: Handler
function modelInfoToolHandler(args: Record<string, unknown>, _ctx: McpStaticToolHandlerContext, deps: CreateModelInfoToolDeps): CallToolResult {
  let result: CallToolResult;

  try {
    const input = parseModelInfoInput(args);
    const output = resolveModelInfoOutput(input, deps.manifest);

    result = {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output as unknown as Record<string, unknown>
    };
  } catch (error) {
    result = formatMcpToolErrorResponse(error) as CallToolResult;
  }

  return result;
}

function resolveModelInfoOutput(input: ParsedModelInfoInput, manifest: ReadonlyArray<McpManifestModelEntry>): ModelInfoToolOutput {
  let output: ModelInfoToolOutput;

  if (input.modelQueries != null) {
    output = buildModelLookupOutput({ queries: input.modelQueries, isArray: input.modelIsArray, manifest, fields: input.fields });
  } else if (input.modelGroup != null) {
    output = buildGroupFilterOutput({ group: input.modelGroup, manifest, fields: input.fields });
  } else if (input.all) {
    output = buildAllOutput(manifest, input.fields);
  } else {
    output = buildGroupsOutput(manifest);
  }

  return output;
}

// MARK: Input parsing
function parseModelInfoInput(args: Record<string, unknown>): ParsedModelInfoInput {
  const modelQueries = parseModelArg(args['model']);
  const modelGroup = parseModelGroupArg(args['modelGroup']);
  const all = parseBooleanArg(args['all'], 'all');
  const fields = parseBooleanArg(args['fields'], 'fields');

  return {
    ...(modelQueries == null ? {} : { modelQueries }),
    modelIsArray: Array.isArray(args['model']),
    ...(modelGroup == null ? {} : { modelGroup }),
    all: all ?? false,
    ...(fields == null ? {} : { fields })
  };
}

function parseModelArg(raw: unknown): Maybe<ReadonlyArray<string>> {
  let result: Maybe<ReadonlyArray<string>>;

  if (raw == null) {
    result = undefined;
  } else if (typeof raw === 'string') {
    result = [requireNonEmptyString(raw, 'model')];
  } else if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error('model-info: "model" array must contain at least one entry.');
    }
    result = raw.map((value, index) => requireNonEmptyString(value, `model[${index}]`));
  } else {
    throw new TypeError('model-info: "model" must be a string or an array of strings when provided.');
  }

  return result;
}

function parseModelGroupArg(raw: unknown): Maybe<string> {
  let result: Maybe<string>;

  if (raw == null) {
    result = undefined;
  } else if (typeof raw === 'string') {
    result = requireNonEmptyString(raw, 'modelGroup');
  } else {
    throw new TypeError('model-info: "modelGroup" must be a string when provided.');
  }

  return result;
}

function parseBooleanArg(raw: unknown, label: string): Maybe<boolean> {
  let result: Maybe<boolean>;

  if (raw == null) {
    result = undefined;
  } else if (typeof raw === 'boolean') {
    result = raw;
  } else {
    throw new TypeError(`model-info: "${label}" must be a boolean when provided.`);
  }

  return result;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`model-info: "${label}" must be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`model-info: "${label}" must be a non-empty string.`);
  }

  return trimmed;
}

// MARK: Output builders
function buildGroupsOutput(manifest: ReadonlyArray<McpManifestModelEntry>): ModelInfoToolOutput {
  return { mode: 'groups', groups: computeGroupCounts(manifest), totalModels: manifest.length, hint: MODEL_INFO_GROUPS_HINT };
}

interface GroupFilterConfig {
  readonly group: string;
  readonly manifest: ReadonlyArray<McpManifestModelEntry>;
  readonly fields?: boolean;
}

function buildGroupFilterOutput(config: GroupFilterConfig): ModelInfoToolOutput {
  const { group, manifest, fields } = config;
  const detailed = fields ?? false;
  const lower = group.toLowerCase();
  const matches = manifest.filter((entry) => entry.modelGroup?.toLowerCase() === lower);

  let result: ModelInfoToolOutput;

  if (matches.length === 0) {
    throw new Error(buildUnknownGroupMessage(group, manifest));
  } else {
    const canonical = matches[0].modelGroup as string;
    result = { mode: 'list', modelGroup: canonical, models: matches.map((entry) => toModelRow(entry, detailed)) };
  }

  return result;
}

function buildAllOutput(manifest: ReadonlyArray<McpManifestModelEntry>, fields: boolean = false): ModelInfoToolOutput {
  return { mode: 'list', models: manifest.map((entry) => toModelRow(entry, fields)) };
}

interface ModelLookupConfig {
  readonly queries: ReadonlyArray<string>;
  readonly isArray: boolean;
  readonly manifest: ReadonlyArray<McpManifestModelEntry>;
  readonly fields?: boolean;
}

function buildModelLookupOutput(config: ModelLookupConfig): ModelInfoToolOutput {
  const { queries, isArray, manifest, fields } = config;
  const detailed = fields ?? true;
  const matched: ModelInfoModelRow[] = [];
  const notFound: ModelInfoNotFound[] = [];

  for (const query of queries) {
    const entry = findModelEntry(query, manifest);
    if (entry == null) {
      notFound.push({ query, message: buildModelNotFoundMessage(query, manifest) });
    } else {
      matched.push(toModelRow(entry, detailed));
    }
  }

  let result: ModelInfoToolOutput;

  if (isArray) {
    result = notFound.length > 0 ? { mode: 'multiple', models: matched, notFound } : { mode: 'multiple', models: matched };
  } else if (matched.length > 0) {
    result = { mode: 'single', model: matched[0] };
  } else {
    throw new Error(notFound[0].message);
  }

  return result;
}

// MARK: Row + group helpers
function toModelRow(entry: McpManifestModelEntry, detailed: boolean): ModelInfoModelRow {
  return detailed ? entry : toSummaryRow(entry);
}

function toSummaryRow(entry: McpManifestModelEntry): ModelInfoSummaryRow {
  return {
    modelType: entry.modelType,
    modelName: entry.modelName,
    identityConst: entry.identityConst,
    collectionPrefix: entry.collectionPrefix,
    sourcePackage: entry.sourcePackage,
    fieldCount: entry.fields.length,
    ...(entry.modelGroup == null ? {} : { modelGroup: entry.modelGroup }),
    ...(entry.parentIdentityConst == null ? {} : { parentIdentityConst: entry.parentIdentityConst }),
    ...(entry.description == null ? {} : { description: entry.description }),
    ...(entry.read == null ? {} : { read: entry.read }),
    ...(entry.serviceFactory == null ? {} : { serviceFactoryExport: entry.serviceFactory.exportName })
  };
}

/**
 * Counts models per `modelGroup`, bucketing entries without a group under
 * {@link MODEL_INFO_UNGROUPED_LABEL}. Sorted by count descending, then group name ascending.
 *
 * @param manifest - Model manifest to summarize.
 * @returns One {@link ModelInfoGroupCount} per group, ordered most-populous-first.
 *
 * @__NO_SIDE_EFFECTS__
 */
function computeGroupCounts(manifest: ReadonlyArray<McpManifestModelEntry>): ModelInfoGroupCount[] {
  const grouped = makeValuesGroupMap([...manifest], (entry) => entry.modelGroup ?? MODEL_INFO_UNGROUPED_LABEL);
  const counts: ModelInfoGroupCount[] = [];

  grouped.forEach((entries, group) => {
    counts.push({ modelGroup: group as string, modelCount: entries.length });
  });

  counts.sort((a, b) => b.modelCount - a.modelCount || a.modelGroup.localeCompare(b.modelGroup));
  return counts;
}

function findGroupCount(query: string, manifest: ReadonlyArray<McpManifestModelEntry>): Maybe<ModelInfoGroupCount> {
  const lower = query.toLowerCase();
  let result: Maybe<ModelInfoGroupCount>;

  for (const count of computeGroupCounts(manifest)) {
    if (count.modelGroup.toLowerCase() === lower) {
      result = count;
      break;
    }
  }

  return result;
}

function buildModelNotFoundMessage(query: string, manifest: ReadonlyArray<McpManifestModelEntry>): string {
  const groupMatch = findGroupCount(query, manifest);
  let message: string;

  if (groupMatch == null) {
    message = `model-info: no exact match for "${query}". Call \`model-info\` with no arguments to list groups, or pass all:true for the full catalog.`;
  } else {
    const plural = groupMatch.modelCount === 1 ? '' : 's';
    message = `model-info: no exact match for "${query}" — did you mean group:"${groupMatch.modelGroup}" (${groupMatch.modelCount} model${plural})? Use modelGroup:"${groupMatch.modelGroup}", or all:true for everything.`;
  }

  return message;
}

function buildUnknownGroupMessage(group: string, manifest: ReadonlyArray<McpManifestModelEntry>): string {
  const available = computeGroupCounts(manifest)
    .map((count) => `${count.modelGroup} (${count.modelCount})`)
    .join(', ');
  return `model-info: no model group matches "${group}". Available groups: ${available || '(none)'}. Call \`model-info\` with no arguments to list groups.`;
}

/**
 * Resolves a manifest entry by `modelType`, `identityConst`, or `collectionPrefix`.
 *
 * @param query - Identifier to look up.
 * @param manifest - Model manifest to search.
 * @returns The matching entry or `undefined`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findModelEntry(query: string, manifest: ReadonlyArray<McpManifestModelEntry>): McpManifestModelEntry | undefined {
  let result: McpManifestModelEntry | undefined;
  for (const entry of manifest) {
    if (entry.modelType === query || entry.identityConst === query || entry.collectionPrefix === query) {
      result = entry;
      break;
    }
  }
  return result;
}

// MARK: Schemas
const MODEL_INFO_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    model: {
      description: 'One model (string) or many (string array), each matched by modelType, identityConst, or collectionPrefix. A string → `mode:"single"`; an array → `mode:"multiple"`. Misses are reported in `notFound`.',
      oneOf: [
        { type: 'string', minLength: 1 },
        { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }
      ]
    },
    modelGroup: {
      type: 'string',
      minLength: 1,
      description: 'Return the summary list of models in this group (`mode:"list"`). Matched case-insensitively.'
    },
    all: {
      type: 'boolean',
      description: 'Opt in to the full catalog summary (every model). Never the default — omit to get groups instead.'
    },
    fields: {
      type: 'boolean',
      description: 'Force (true) or suppress (false) full persisted-field detail. Defaults to summary rows for list mode and full entries for single/multiple modes.'
    }
  },
  additionalProperties: false
} as const;

// Shared item schema for model-bearing rows. Required props cover the summary form; full entries
// add `fields`, `sourceFile`, and `serviceFactory` (allowed as additional properties).
const MODEL_ROW_SCHEMA = {
  type: 'object',
  required: ['modelType', 'modelName', 'identityConst', 'collectionPrefix', 'sourcePackage'],
  properties: {
    modelType: { type: 'string' },
    modelName: { type: 'string' },
    modelGroup: { type: 'string' },
    identityConst: { type: 'string' },
    collectionPrefix: { type: 'string' },
    parentIdentityConst: { type: 'string' },
    sourcePackage: { type: 'string' },
    sourceFile: { type: 'string' },
    fieldCount: { type: 'integer' },
    description: { type: 'string' },
    read: { type: 'string', enum: ['system', 'owner', 'admin-only', 'permissions'] },
    serviceFactoryExport: { type: 'string' },
    fields: { type: 'array', items: { type: 'object' } },
    serviceFactory: {
      type: 'object',
      required: ['exportName', 'sourceFile'],
      properties: {
        exportName: { type: 'string' },
        sourceFile: { type: 'string' }
      }
    }
  }
} as const;

// MCP's `tools/list` validator requires `outputSchema.type === 'object'` at the root
// (see @modelcontextprotocol/sdk Zod schema), so the variants are expressed via a top-level
// object whose nested `oneOf` discriminates by the `mode` literal.
const MODEL_INFO_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['mode'],
  description: 'Discriminated by `mode`: `groups` (default model groups + counts), `list` (summary/full list for `modelGroup` or `all`), `single` (one `model`), or `multiple` (a `model` array, with misses in `notFound`).',
  properties: {
    mode: { type: 'string', enum: ['groups', 'list', 'single', 'multiple'] },
    groups: {
      type: 'array',
      description: 'Present when `mode` is `"groups"`. One entry per model group.',
      items: {
        type: 'object',
        required: ['modelGroup', 'modelCount'],
        properties: {
          modelGroup: { type: 'string' },
          modelCount: { type: 'integer' }
        }
      }
    },
    totalModels: { type: 'integer', description: 'Present when `mode` is `"groups"`. Total models across all groups.' },
    hint: { type: 'string', description: 'Present when `mode` is `"groups"`. Guidance on how to drill into the catalog.' },
    models: {
      type: 'array',
      description: 'Present when `mode` is `"list"` or `"multiple"`. Summary rows by default; full entries when `fields` requests detail.',
      items: MODEL_ROW_SCHEMA
    },
    modelGroup: { type: 'string', description: 'Present when `mode` is `"list"` from a `modelGroup` filter. The canonical group name.' },
    model: { ...MODEL_ROW_SCHEMA, description: 'Present when `mode` is `"single"`. The matched model entry (full detail unless `fields:false`).' },
    notFound: {
      type: 'array',
      description: 'Present when `mode` is `"multiple"` and one or more queries matched nothing.',
      items: {
        type: 'object',
        required: ['query', 'message'],
        properties: {
          query: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  },
  oneOf: [
    { required: ['groups', 'totalModels'], properties: { mode: { const: 'groups' } } },
    { required: ['models'], properties: { mode: { const: 'list' } } },
    { required: ['model'], properties: { mode: { const: 'single' } } },
    { required: ['models'], properties: { mode: { const: 'multiple' } } }
  ]
} as const;
