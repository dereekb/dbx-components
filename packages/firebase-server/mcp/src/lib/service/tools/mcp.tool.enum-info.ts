import { type Maybe } from '@dereekb/util';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { type McpToolCatalogExamples } from '../mcp.examples';
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

/**
 * Hint returned when a requested enum name matched no registered enum.
 */
export const ENUM_INFO_NOT_FOUND_HINT = 'Call enum-info with no arguments to list the registered enum names.';

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
  /**
   * Examples shown in the tool text. Omit for generic wording.
   */
  readonly examples?: Maybe<Pick<McpToolCatalogExamples, 'enumName'>>;
}

/**
 * Shape of the `enum-info` tool input.
 */
export interface EnumInfoToolInput {
  /**
   * One enum name (string) or several (string array), each matched exactly by declaration name. Omit to list the
   * registered enum names.
   */
  readonly enum?: Maybe<string | ReadonlyArray<string>>;
}

/**
 * Lookup output of the `enum-info` tool: the resolved value tables, with any unmatched names in `notFound`.
 */
export interface EnumInfoToolLookupOutput {
  readonly enums: ReadonlyArray<McpManifestEnum>;
  readonly notFound?: ReadonlyArray<string>;
  /**
   * How to find the right name. Present when {@link notFound} is non-empty.
   */
  readonly hint?: string;
}

/**
 * List output of the `enum-info` tool, returned when no `enum` is passed.
 */
export interface EnumInfoToolListOutput {
  /**
   * The registered enum declaration names, sorted.
   */
  readonly names: readonly string[];
  readonly total: number;
}

/**
 * Output payload for the `enum-info` tool.
 */
export type EnumInfoToolOutput = EnumInfoToolLookupOutput | EnumInfoToolListOutput;

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
  const enumName = deps.examples?.enumName;
  const description = `Look up enum value→label tables by name (${count} enum${count === 1 ? '' : 's'} registered). Call with no arguments to list the registered enum names. Pass \`enum\` (one declaration name or an array${enumName ? `, e.g. "${enumName}"` : ''}) to decode the raw persisted integer/string values a model field stores. Misses are reported in \`notFound\`.`;

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: buildEnumInfoInputSchema(enumName),
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
    const output: EnumInfoToolOutput = names == null ? resolveEnumInfoListOutput(deps.enums) : resolveEnumInfoOutput(names, deps.enums);

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
export function resolveEnumInfoOutput(names: readonly string[], enums: CreateEnumInfoToolDeps['enums']): EnumInfoToolLookupOutput {
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

  return notFound.length > 0 ? { enums: found, notFound, hint: ENUM_INFO_NOT_FOUND_HINT } : { enums: found };
}

/**
 * Lists the registered enum names, sorted.
 *
 * @param enums - The registered enum value tables keyed by name.
 * @returns The sorted names and their count.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveEnumInfoListOutput(enums: CreateEnumInfoToolDeps['enums']): EnumInfoToolListOutput {
  const names = Object.keys(enums).sort((a, b) => a.localeCompare(b));
  return { names, total: names.length };
}

// MARK: Input parsing
function parseEnumInfoInput(args: Record<string, unknown>): Maybe<readonly string[]> {
  const raw = args['enum'];
  let result: Maybe<readonly string[]>;

  if (raw == null) {
    result = undefined;
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
function buildEnumInfoInputSchema(enumName: Maybe<string>) {
  return {
    type: 'object',
    properties: {
      enum: {
        description: `One enum name (string) or many (string array), each matched exactly by declaration name${enumName ? `, e.g. "${enumName}"` : ''}. Omit to list the registered enum names.`,
        oneOf: [
          { type: 'string', minLength: 1 },
          { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }
        ]
      }
    },
    additionalProperties: false
  };
}

const ENUM_INFO_OUTPUT_SCHEMA = {
  type: 'object',
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
    },
    hint: {
      type: 'string',
      description: 'How to find the right enum name. Present when `notFound` is non-empty.'
    },
    names: {
      type: 'array',
      description: 'The registered enum names, sorted. Returned when no `enum` is passed.',
      items: { type: 'string' }
    },
    total: {
      type: 'integer',
      description: 'The number of registered enum names.'
    }
  },
  anyOf: [{ required: ['enums'] }, { required: ['names'] }]
} as const;
