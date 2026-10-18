import { MAX_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT, MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES, MODEL_MANIFEST_CATALOG_HIT_KINDS, resolveModelManifestInfoOutput, type ModelManifestCatalog, type ModelManifestInfoHints, type ModelManifestInfoInput, type ModelManifestInfoOutput } from '@dereekb/firebase/manifest';
import { type Maybe } from '@dereekb/util';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { type McpToolCatalogExamples } from '../mcp.examples';
import { formatMcpToolErrorResponse } from '../mcp.response-formatter';
import { buildStaticToolDefinition, type McpStaticToolHandler, type McpToolDefinition } from '../mcp.tool-generator';
import { ENUM_TABLE_SCHEMA, MODEL_INFO_ROW_SCHEMA } from './mcp.tool.model-info';

// MARK: Constants
/**
 * Synthetic call type of the compact `info` tool's dispatch identity.
 */
export const MCP_COMPACT_INFO_DISPATCH_CALL = 'info';

/**
 * Synthetic model type of the compact `info` tool's dispatch identity. Distinct from `model-info`'s `model` and
 * `enum-info`'s `enum`.
 */
export const MCP_COMPACT_INFO_DISPATCH_MODEL_TYPE = 'catalog';

// MARK: Types
/**
 * Input for {@link createMcpCompactInfoTool}.
 */
export interface CreateMcpCompactInfoToolInput {
  /**
   * The resolved wire name, usually `<prefix>_api_info`.
   */
  readonly name: string;
  /**
   * The app label shown in the description, usually the tool-name prefix.
   */
  readonly app: string;
  /**
   * The catalog built once at boot from the manifest's models and enums.
   */
  readonly catalog: ModelManifestCatalog;
  /**
   * Examples shown in the tool text. Omit for generic wording.
   */
  readonly examples?: Maybe<Pick<McpToolCatalogExamples, 'modelTypes' | 'enumName'>>;
}

// MARK: Factory
/**
 * Builds the compact `<prefix>_api_info` tool: the front door to the static data-model catalog (models, stored fields,
 * enum value tables) loaded from `mcp.manifest.json`.
 *
 * Returns catalog details only: no value decoding and no computed answers. The output is the shared
 * `@dereekb/firebase/manifest` {@link resolveModelManifestInfoOutput} result, the same `data` the dbx-cli `info`
 * command prints with `--json`.
 *
 * @param input - The wire name, app label, catalog, and optional examples.
 * @returns The read-only static tool definition.
 */
export function createMcpCompactInfoTool(input: CreateMcpCompactInfoToolInput): McpToolDefinition {
  const { name, app, catalog, examples } = input;
  const hints = buildMcpCompactInfoHints(name);
  const modelCount = catalog.models.length;
  const enumCount = catalog.enumNames.length;
  const queryExample = examples?.modelTypes[0];
  const enumExample = examples?.enumName;
  const queryExampleText = queryExample ? `, e.g. "${queryExample}"` : '';
  const enumExampleText = enumExample ? `, e.g. "${enumExample}"` : '';
  const description = `Look up the ${app} data model (${modelCount} model${modelCount === 1 ? '' : 's'}, ${enumCount} enum${enumCount === 1 ? '' : 's'}): models, stored fields and enum value tables. No arguments: an overview of model types by group and enum names. \`query\` (one to three keywords${queryExampleText}): one-line model, field and enum hits; narrow with \`kind\`, page with \`offset\` / \`nextOffset\`. \`model\` (modelType, identity const or collection prefix, or an array): full entries plus the enum tables their fields use. \`enum\` (a name${enumExampleText}, or an array): value tables with the fields that use them (\`usedBy\`). Pass at most one of query, model, enum.`;

  const handler: McpStaticToolHandler = (args) => {
    let result: CallToolResult;

    try {
      const output: ModelManifestInfoOutput = resolveModelManifestInfoOutput({ catalog, input: args as ModelManifestInfoInput, hints });

      result = {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output as unknown as Record<string, unknown>
      };
    } catch (error) {
      result = formatMcpToolErrorResponse(error) as CallToolResult;
    }

    return Promise.resolve(result);
  };

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: buildMcpCompactInfoInputSchema(examples),
    outputSchema: MCP_COMPACT_INFO_OUTPUT_SCHEMA,
    dispatch: {
      call: MCP_COMPACT_INFO_DISPATCH_CALL,
      modelType: MCP_COMPACT_INFO_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    effectiveReadOnly: true,
    omitReasonParameter: true,
    rule: { requireAuthenticated: true }
  });
}

/**
 * Builds the hint texts the compact `info` tool attaches to its output, naming its own parameters.
 *
 * @param name - The tool's wire name.
 * @returns The hints.
 */
export function buildMcpCompactInfoHints(name: string): ModelManifestInfoHints {
  return {
    overview: 'Pass `query` (one to three keywords) to find models, fields and enums, or `model` / `enum` to look entries up by name.',
    partial: 'No hit matched every query word; these hits match some of them.',
    noMatch: `Nothing matched. Try fewer or different keywords, or call ${name} with no arguments for the overview.`,
    modelNotFound: `Match a model by modelType, identity const or collection prefix. Call ${name} with no arguments to list the model types.`,
    enumNotFound: `Match an enum by its exact declaration name. Call ${name} with no arguments to list the enum names.`
  };
}

// MARK: Schemas
/**
 * Builds the compact `info` tool's input schema, with examples drawn from the catalog.
 *
 * @param examples - The catalog examples. Omit for generic wording.
 * @returns The input schema.
 */
export function buildMcpCompactInfoInputSchema(examples?: Maybe<Pick<McpToolCatalogExamples, 'modelTypes' | 'enumName'>>) {
  const queryExample = examples?.modelTypes[0];
  const enumExample = examples?.enumName;
  const queryExampleText = queryExample ? `, e.g. '${queryExample}'` : '';
  const enumExampleText = enumExample ? `, e.g. "${enumExample}"` : '';
  const namesSchema = (label: string) => ({
    oneOf: [
      { type: 'string', minLength: 1 },
      { type: 'array', minItems: 1, maxItems: MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES, items: { type: 'string', minLength: 1 } }
    ],
    description: `One ${label} (string) or up to ${MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES} (string array).`
  });

  return {
    type: 'object',
    properties: {
      query: { type: 'string', description: `One to three keywords, not a sentence${queryExampleText}. Returns one-line model, field and enum hits.` },
      kind: { type: 'string', enum: [...MODEL_MANIFEST_CATALOG_HIT_KINDS], description: 'Restricts `query` hits to one kind. Without a query, lists every entry of that kind.' },
      model: { ...namesSchema('model'), description: 'One model (string) or several (string array), each matched by modelType, identity const or collection prefix. Returns the full entries plus the enum tables their fields use.' },
      enum: { ...namesSchema('enum'), description: `One enum declaration name (string) or several (string array)${enumExampleText}. Returns the value tables with the fields that use them.` },
      limit: { type: 'integer', minimum: 1, maximum: MAX_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT, description: `Maximum search hits (default 10, max ${MAX_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT}).` },
      offset: { type: 'integer', minimum: 0, description: "Number of search hits to skip, for paging: pass the previous result's `nextOffset`. Defaults to 0." }
    },
    additionalProperties: false
  };
}

const NAME_LIST_SCHEMA = { type: 'array', items: { type: 'string' } } as const;

const MCP_COMPACT_INFO_HIT_SCHEMA = {
  type: 'object',
  required: ['kind'],
  properties: {
    kind: { type: 'string', enum: [...MODEL_MANIFEST_CATALOG_HIT_KINDS] },
    modelType: { type: 'string' },
    modelName: { type: 'string' },
    collectionPrefix: { type: 'string' },
    modelGroup: { type: 'string' },
    field: { type: 'string', description: 'The stored (short) field path, e.g. `e.h.o`.' },
    longName: { type: 'string', description: 'The long field path.' },
    tsType: { type: 'string' },
    enumRef: { type: 'string' },
    enum: { type: 'string' },
    valueCount: { type: 'integer' },
    summary: { type: 'string' }
  }
} as const;

const MCP_COMPACT_INFO_USAGE_SCHEMA = {
  type: 'object',
  required: ['modelType', 'field', 'longName'],
  properties: {
    modelType: { type: 'string' },
    field: { type: 'string' },
    longName: { type: 'string' }
  }
} as const;

/**
 * Output schema of the compact `info` tool: an object root keyed on `mode`.
 */
export const MCP_COMPACT_INFO_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['mode'],
  properties: {
    mode: { type: 'string', enum: ['overview', 'search', 'model', 'enum'] }
  },
  oneOf: [
    {
      required: ['mode', 'totalModels', 'totalEnums', 'groups', 'enumNames', 'hint'],
      properties: {
        mode: { const: 'overview' },
        totalModels: { type: 'integer' },
        totalEnums: { type: 'integer' },
        groups: {
          type: 'array',
          items: { type: 'object', required: ['modelGroup', 'modelTypes'], properties: { modelGroup: { type: 'string' }, modelTypes: NAME_LIST_SCHEMA } }
        },
        enumNames: NAME_LIST_SCHEMA,
        hint: { type: 'string' }
      }
    },
    {
      required: ['mode', 'total', 'hits'],
      properties: {
        mode: { const: 'search' },
        total: { type: 'integer' },
        nextOffset: { type: 'integer', description: 'The `offset` of the next page. Present when more hits remain.' },
        partial: { type: 'boolean' },
        hint: { type: 'string' },
        hits: { type: 'array', items: MCP_COMPACT_INFO_HIT_SCHEMA }
      }
    },
    {
      required: ['mode', 'models'],
      properties: {
        mode: { const: 'model' },
        models: { type: 'array', items: MODEL_INFO_ROW_SCHEMA },
        enums: { type: 'array', items: ENUM_TABLE_SCHEMA },
        notFound: NAME_LIST_SCHEMA,
        hint: { type: 'string' }
      }
    },
    {
      required: ['mode', 'enums'],
      properties: {
        mode: { const: 'enum' },
        enums: {
          type: 'array',
          items: { ...ENUM_TABLE_SCHEMA, required: [...ENUM_TABLE_SCHEMA.required, 'usedBy'], properties: { ...ENUM_TABLE_SCHEMA.properties, usedBy: { type: 'array', items: MCP_COMPACT_INFO_USAGE_SCHEMA } } }
        },
        notFound: NAME_LIST_SCHEMA,
        hint: { type: 'string' }
      }
    }
  ]
} as const;
