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
 * Shape of the `model-info` tool input. Omit `model` to list every model in the manifest.
 */
export interface ModelInfoToolInput {
  readonly model?: string;
}

/**
 * Summary row returned in list mode.
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
}

/**
 * Output payload for the `model-info` tool. `mode === 'list'` carries `models[]`;
 * `mode === 'single'` carries the full `model` entry.
 */
export type ModelInfoToolOutput = { readonly mode: 'list'; readonly models: ReadonlyArray<ModelInfoSummaryRow> } | { readonly mode: 'single'; readonly model: McpManifestModelEntry };

// MARK: Factory
/**
 * Builds the built-in `model-info` MCP tool definition.
 *
 * Mirrors dbx-cli's `model-info [model]` command:
 * - Without a `model` arg: returns a summary list (modelType, modelName, prefix, group, identity, field count).
 * - With a `model` arg: matches by `modelType`, `identityConst`, or `collectionPrefix` and returns the full entry.
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
  const description = `Browse the Firestore model catalog (${deps.manifest.length} model${deps.manifest.length === 1 ? '' : 's'}). Without \`model\`, returns a summary list of every model. With \`model\` (matched by modelType, identityConst, or collectionPrefix), returns the full entry with persisted fields.`;

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
    const output = input.model == null ? buildListOutput(deps.manifest) : buildSingleOutput(input.model, deps.manifest);

    result = {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output as unknown as Record<string, unknown>
    };
  } catch (error) {
    result = formatMcpToolErrorResponse(error) as CallToolResult;
  }

  return result;
}

function parseModelInfoInput(args: Record<string, unknown>): ModelInfoToolInput {
  const raw = args['model'];
  let model: string | undefined;

  if (raw == null) {
    model = undefined;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new Error('model-info: "model" must be a non-empty string when provided.');
    }
    model = trimmed;
  } else {
    throw new TypeError('model-info: "model" must be a string when provided.');
  }

  return { model };
}

function buildListOutput(manifest: ReadonlyArray<McpManifestModelEntry>): ModelInfoToolOutput {
  const models = manifest.map<ModelInfoSummaryRow>((entry) => {
    const row: ModelInfoSummaryRow = {
      modelType: entry.modelType,
      modelName: entry.modelName,
      identityConst: entry.identityConst,
      collectionPrefix: entry.collectionPrefix,
      sourcePackage: entry.sourcePackage,
      fieldCount: entry.fields.length,
      ...(entry.modelGroup == null ? {} : { modelGroup: entry.modelGroup }),
      ...(entry.parentIdentityConst == null ? {} : { parentIdentityConst: entry.parentIdentityConst }),
      ...(entry.description == null ? {} : { description: entry.description })
    };
    return row;
  });
  return { mode: 'list', models };
}

function buildSingleOutput(query: string, manifest: ReadonlyArray<McpManifestModelEntry>): ModelInfoToolOutput {
  const entry = findModelEntry(query, manifest);

  if (entry == null) {
    throw new Error(`model-info: no model matches "${query}". Call \`model-info\` without arguments to list available models.`);
  }

  return { mode: 'single', model: entry };
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
      type: 'string',
      minLength: 1,
      description: 'Model to inspect (modelType, identityConst, or collectionPrefix). Omit to list every model.'
    }
  },
  additionalProperties: false
} as const;

// MCP's `tools/list` validator requires `outputSchema.type === 'object'` at the root
// (see @modelcontextprotocol/sdk Zod schema), so the list/single union is expressed via a
// top-level object whose nested `oneOf` discriminates by the `mode` literal.
const MODEL_INFO_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['mode'],
  description: 'Either lists every model in the manifest (when `model` is omitted) or returns a full entry for the requested model (when `model` is provided). The `mode` field discriminates the variant.',
  properties: {
    mode: { type: 'string', enum: ['list', 'single'] },
    models: {
      type: 'array',
      description: 'Present when `mode` is `"list"`. One summary entry per registered model.',
      items: {
        type: 'object',
        required: ['modelType', 'modelName', 'identityConst', 'collectionPrefix', 'sourcePackage', 'fieldCount'],
        properties: {
          modelType: { type: 'string' },
          modelName: { type: 'string' },
          modelGroup: { type: 'string' },
          identityConst: { type: 'string' },
          collectionPrefix: { type: 'string' },
          parentIdentityConst: { type: 'string' },
          sourcePackage: { type: 'string' },
          fieldCount: { type: 'integer' },
          description: { type: 'string' }
        }
      }
    },
    model: {
      type: 'object',
      description: 'Present when `mode` is `"single"`. The full manifest entry for the requested model.',
      required: ['modelType', 'modelName', 'identityConst', 'collectionPrefix', 'sourcePackage', 'sourceFile', 'fields'],
      properties: {
        modelType: { type: 'string' },
        modelName: { type: 'string' },
        modelGroup: { type: 'string' },
        identityConst: { type: 'string' },
        collectionPrefix: { type: 'string' },
        parentIdentityConst: { type: 'string' },
        description: { type: 'string' },
        sourcePackage: { type: 'string' },
        sourceFile: { type: 'string' },
        fields: {
          type: 'array',
          items: { type: 'object' }
        }
      }
    }
  },
  oneOf: [
    { required: ['models'], properties: { mode: { const: 'list' } } },
    { required: ['model'], properties: { mode: { const: 'single' } } }
  ]
} as const;
