import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type McpManifestEnum } from '../mcp.manifest';
import { formatMcpToolErrorResponse } from '../mcp.response-formatter';
import { buildStaticToolDefinition, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { ENUM_TABLE_SCHEMA } from './mcp.tool.model-info';

// MARK: Constants
/**
 * Reserved tool name for the built-in `enum-info` static tool.
 */
export const ENUM_INFO_TOOL_NAME = 'enum-info';

/**
 * Synthetic call type used in the tool's dispatch identity. Mirrors the `info` call shared with
 * `model-info`.
 */
export const ENUM_INFO_DISPATCH_CALL = 'info';

/**
 * Synthetic model type used in the tool's dispatch identity. Apps avoiding collisions should not
 * register a real model literally named "enum".
 */
export const ENUM_INFO_DISPATCH_MODEL_TYPE = 'enum';

// MARK: Types
/**
 * Constructor dependencies for {@link createEnumInfoTool}.
 */
export interface CreateEnumInfoToolDeps {
  /**
   * Frozen enum value tables keyed by enum name, sourced from the build-time manifest's `enums`
   * block.
   */
  readonly enums: { readonly [name: string]: McpManifestEnum };
}

/**
 * Shape of the `enum-info` tool input.
 */
export interface EnumInfoToolInput {
  /**
   * One enum name (string) or several (string array), each matched exactly by declaration name.
   */
  readonly enum: string | ReadonlyArray<string>;
}

/**
 * Output payload for the `enum-info` tool: the resolved value tables, with any unmatched names in
 * `notFound`.
 */
export interface EnumInfoToolOutput {
  readonly enums: ReadonlyArray<McpManifestEnum>;
  readonly notFound?: ReadonlyArray<string>;
}

// MARK: Factory
/**
 * Builds the built-in `enum-info` MCP tool definition — the symmetric counterpart to `model-info`
 * for raw enum decoding.
 *
 * Resolves each requested enum name against the manifest's `enums` block and returns the matching
 * value→label tables; misses land in `notFound`. A bare string is treated as a one-element array.
 *
 * Output is delivered as both stringified JSON in `content[0].text` and `structuredContent` so MCP
 * clients can consume either form.
 *
 * @param deps - The frozen enum value tables loaded at boot from the MCP manifest JSON.
 * @returns A statically-registered {@link McpToolDefinition} ready to be appended to the MCP server
 *   factory's tool registry.
 */
export function createEnumInfoTool(deps: CreateEnumInfoToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (args, ctx) => Promise.resolve(enumInfoToolHandler(args, ctx, deps));
  const name = ENUM_INFO_TOOL_NAME;
  const count = Object.keys(deps.enums).length;
  const description = `Look up enum value→label tables by name (${count} enum${count === 1 ? '' : 's'} registered). Pass \`enum\` (a string or array of enum declaration names, e.g. "JobWorkerTimesheetState") to decode the raw persisted integer/string values a model field stores. Misses are reported in \`notFound\`.`;

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: ENUM_INFO_INPUT_SCHEMA,
    outputSchema: ENUM_INFO_OUTPUT_SCHEMA,
    dispatch: {
      call: ENUM_INFO_DISPATCH_CALL,
      modelType: ENUM_INFO_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    effectiveReadOnly: true,
    rule: { requireAuthenticated: true }
  });
}

// MARK: Handler
function enumInfoToolHandler(args: Record<string, unknown>, _ctx: McpStaticToolHandlerContext, deps: CreateEnumInfoToolDeps): CallToolResult {
  let result: CallToolResult;

  try {
    const names = parseEnumInfoInput(args);
    const output = resolveEnumInfoOutput(names, deps.enums);

    result = {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output as unknown as Record<string, unknown>
    };
  } catch (error) {
    result = formatMcpToolErrorResponse(error) as CallToolResult;
  }

  return result;
}

/**
 * Resolves each requested enum name against the registered value tables.
 *
 * @param names - The requested enum declaration names.
 * @param enums - The registered enum value tables keyed by name.
 * @returns The matched tables, with any unmatched names in `notFound`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveEnumInfoOutput(names: readonly string[], enums: CreateEnumInfoToolDeps['enums']): EnumInfoToolOutput {
  const found: McpManifestEnum[] = [];
  const notFound: string[] = [];

  for (const name of names) {
    const table = enums[name];
    if (table == null) {
      notFound.push(name);
    } else {
      found.push(table);
    }
  }

  return notFound.length > 0 ? { enums: found, notFound } : { enums: found };
}

// MARK: Input parsing
function parseEnumInfoInput(args: Record<string, unknown>): readonly string[] {
  const raw = args['enum'];
  let result: readonly string[];

  if (raw == null) {
    throw new Error('enum-info: "enum" is required and must be a string or an array of strings.');
  } else if (typeof raw === 'string') {
    result = [requireNonEmptyString(raw, 'enum')];
  } else if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error('enum-info: "enum" array must contain at least one entry.');
    }
    result = raw.map((value, index) => requireNonEmptyString(value, `enum[${index}]`));
  } else {
    throw new TypeError('enum-info: "enum" must be a string or an array of strings.');
  }

  return result;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`enum-info: "${label}" must be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`enum-info: "${label}" must be a non-empty string.`);
  }

  return trimmed;
}

// MARK: Schemas
const ENUM_INFO_INPUT_SCHEMA = {
  type: 'object',
  required: ['enum'],
  properties: {
    enum: {
      description: 'One enum name (string) or many (string array), each matched exactly by declaration name (e.g. "JobWorkerTimesheetState"). Misses are reported in `notFound`.',
      oneOf: [
        { type: 'string', minLength: 1 },
        { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }
      ]
    }
  },
  additionalProperties: false
} as const;

const ENUM_INFO_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['enums'],
  properties: {
    enums: {
      type: 'array',
      description: 'The resolved enum value→label tables, in request order.',
      items: ENUM_TABLE_SCHEMA
    },
    notFound: {
      type: 'array',
      description: 'Requested enum names that matched no registered enum.',
      items: { type: 'string' }
    }
  }
} as const;
