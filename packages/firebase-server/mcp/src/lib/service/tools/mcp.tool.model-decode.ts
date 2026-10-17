import { type Maybe } from '@dereekb/util';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { decodeModelManifestKey, decodeModelManifestKeySegments, ModelManifestKeyDecodeError, type DecodedKeySegments, type DecodedModelManifestKey } from '@dereekb/firebase/manifest';
import { type McpManifestModelEntry } from '../mcp.manifest';
import { type McpToolCatalogExamples } from '../mcp.examples';
import { formatMcpToolErrorResponse } from '../mcp.response-formatter';
import { buildStaticToolDefinition, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';

// MARK: Constants
/**
 * Reserved tool name for the built-in `model-decode` static tool.
 */
export const MODEL_DECODE_TOOL_NAME = 'model-decode';

/**
 * Synthetic call type used in the tool's dispatch identity. Aligns with the dbx-cli `model-decode`
 * command.
 */
export const MODEL_DECODE_DISPATCH_CALL = 'decode';

/**
 * Synthetic model type used in the tool's dispatch identity. Mirrors the other built-in static
 * tools (`model-get`, `model-info`); apps avoiding collisions should not register a real model
 * literally named "model".
 */
export const MODEL_DECODE_DISPATCH_MODEL_TYPE = 'model';

// MARK: Types
/**
 * Constructor dependencies for {@link createModelDecodeTool}.
 */
export interface CreateModelDecodeToolDeps {
  /**
   * Frozen catalog of Firestore models used to resolve segment prefixes.
   */
  readonly manifest: readonly McpManifestModelEntry[];
  /**
   * Examples shown in the tool text. Omit for generic wording.
   */
  readonly examples?: Maybe<Pick<McpToolCatalogExamples, 'modelKey'>>;
}

/**
 * Shape of the `model-decode` tool input.
 */
export interface ModelDecodeToolInput {
  readonly key: string;
}

// The decoded-key shapes are shared with the dbx-cli `model-decode` command.
export type { DecodedKeyIssue, DecodedKeyIssueCode, DecodedKeySegment, DecodedKeySegments, DerivedCompositeKey } from '@dereekb/firebase/manifest';

/**
 * Output payload for the `model-decode` tool. Alias of the shared `@dereekb/firebase/manifest`
 * {@link DecodedModelManifestKey}.
 */
export type ModelDecodeToolOutput = DecodedModelManifestKey;

// MARK: Factory
/**
 * Builds the built-in `model-decode` MCP tool definition.
 *
 * Mirrors dbx-cli's `model-decode <key>` command:
 * - Splits the supplied Firestore key on `/`, walks `[prefix, id]` pairs, and resolves each prefix
 *   against the manifest.
 * - Supports subcollection paths (`parentPrefix/parentId/childPrefix/childId`).
 *
 * Output is delivered as both stringified JSON in `content[0].text` and `structuredContent` so
 * MCP clients can consume either form.
 *
 * @param deps - The frozen model manifest loaded at boot from the MCP manifest JSON.
 * @returns A statically-registered {@link McpToolDefinition} ready to be appended to the MCP
 *   server factory's tool registry.
 */
export function createModelDecodeTool(deps: CreateModelDecodeToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (args, ctx) => Promise.resolve(modelDecodeToolHandler(args, ctx, deps));
  const name = MODEL_DECODE_TOOL_NAME;
  const modelKey = deps.examples?.modelKey;
  const description = `Decode a Firestore model key ("prefix/id"${modelKey ? `, e.g. "${modelKey}"` : ''}, or a subcollection path "parentPrefix/parentId/childPrefix/childId") into { valid, leaf, ancestors, unresolvedPrefixes, issues, derivedKeys, compositeSource? } using the registered manifest (${deps.manifest.length} model${deps.manifest.length === 1 ? '' : 's'}). \`valid\` is false when a prefix is unknown or a collection sits under the wrong parent; \`derivedKeys\` (composite-key models whose document id is a flattened form of this key, each with its ready-to-use key) and \`compositeSource\` are only computed for a valid key.`;

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: buildModelDecodeInputSchema(modelKey),
    outputSchema: MODEL_DECODE_OUTPUT_SCHEMA,
    dispatch: {
      call: MODEL_DECODE_DISPATCH_CALL,
      modelType: MODEL_DECODE_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    effectiveReadOnly: true,
    rule: { requireAuthenticated: true }
  });
}

// MARK: Handler
function modelDecodeToolHandler(args: Record<string, unknown>, _ctx: McpStaticToolHandlerContext, deps: CreateModelDecodeToolDeps): CallToolResult {
  let result: CallToolResult;

  try {
    const input = parseModelDecodeInput(args);
    const output = decodeFirestoreModelKey(input.key, deps.manifest);

    result = {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output as unknown as Record<string, unknown>
    };
  } catch (error) {
    result = formatMcpToolErrorResponse(error) as CallToolResult;
  }

  return result;
}

function parseModelDecodeInput(args: Record<string, unknown>): ModelDecodeToolInput {
  const raw = args['key'];

  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('model-decode: "key" is required and must be a non-empty string.');
  }

  return { key: raw };
}

/**
 * Splits `rawKey` on `/`, resolves each `[prefix, id]` pair against the manifest, and
 * returns the leaf segment + ancestor chain and its structural validity, plus — for a valid key —
 * the composite-key relationships declared on the manifest: the keys of models derived from this
 * key (`derivedKeys`) and, for a two-way composite-key leaf, the recovered source key (`compositeSource`).
 *
 * Wraps the shared `@dereekb/firebase/manifest` {@link decodeModelManifestKey}, which the dbx-cli
 * `model-decode` command also uses.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The model manifest.
 * @returns The decoded key with leaf, ancestors, unresolved prefixes, and composite-key relationships.
 * @throws {Error} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKey(rawKey: string, manifest: ReadonlyArray<McpManifestModelEntry>): ModelDecodeToolOutput {
  return rethrowAsModelDecodeError(() => decodeModelManifestKey(rawKey, manifest));
}

/**
 * Splits `rawKey` on `/` and resolves each `[prefix, id]` pair against the manifest — the segment
 * walk behind {@link decodeFirestoreModelKey}.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The model manifest.
 * @returns The decoded key with leaf, ancestors, and any unresolved prefixes.
 * @throws {Error} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKeySegments(rawKey: string, manifest: ReadonlyArray<McpManifestModelEntry>): DecodedKeySegments {
  return rethrowAsModelDecodeError(() => decodeModelManifestKeySegments(rawKey, manifest));
}

function rethrowAsModelDecodeError<T>(decode: () => T): T {
  try {
    return decode();
  } catch (error) {
    if (error instanceof ModelManifestKeyDecodeError) {
      const message =
        error.reason === 'empty'
          ? 'model-decode: key is empty. Provide a Firestore key like `prefix/id`.'
          : `model-decode: invalid Firestore key "${error.key}". Expected an even number of segments (\`prefix/id\` pairs). Got ${error.segmentCount} segment(s). Use the format \`prefix/id\` (or \`parentPrefix/parentId/childPrefix/childId\` for subcollections).`;
      throw new Error(message, { cause: error });
    }

    throw error;
  }
}

// MARK: Schemas
function buildModelDecodeInputSchema(modelKey: Maybe<string>) {
  return {
    type: 'object',
    required: ['key'],
    properties: {
      key: {
        type: 'string',
        minLength: 1,
        description: `Firestore model key — prefix/id${modelKey ? ` (e.g. "${modelKey}")` : ''}, or \`parentPrefix/parentId/childPrefix/childId\` for subcollections.`
      }
    },
    additionalProperties: false
  };
}

const SEGMENT_SCHEMA = {
  type: 'object',
  required: ['prefix', 'id'],
  properties: {
    prefix: { type: 'string' },
    id: { type: 'string' },
    modelType: { type: 'string' },
    modelName: { type: 'string' },
    modelGroup: { type: 'string' },
    identityConst: { type: 'string' },
    parentIdentityConst: { type: 'string' },
    sourcePackage: { type: 'string' },
    sourceFile: { type: 'string' }
  }
} as const;

const ISSUE_SCHEMA = {
  type: 'object',
  required: ['prefix', 'code', 'message'],
  properties: {
    prefix: { type: 'string' },
    code: { type: 'string', enum: ['NESTED_ROOT_COLLECTION', 'MISSING_PARENT', 'WRONG_PARENT'] },
    message: { type: 'string' }
  }
} as const;

const DECODED_SEGMENTS_PROPERTIES = {
  key: { type: 'string', description: 'The trimmed input key.' },
  valid: { type: 'boolean', description: 'True when every prefix resolved and each segment sits under its declared parent.' },
  issues: { type: 'array', description: 'Structural problems: a root collection nested under another, a subcollection without its parent, or under the wrong parent.', items: ISSUE_SCHEMA },
  leaf: SEGMENT_SCHEMA,
  ancestors: { type: 'array', description: 'Parent segments, root-first.', items: SEGMENT_SCHEMA },
  unresolvedPrefixes: { type: 'array', description: 'Prefixes that did not match any model in the manifest.', items: { type: 'string' } }
} as const;

const DERIVED_KEY_SCHEMA = {
  type: 'object',
  required: ['key', 'modelType', 'modelName', 'collectionPrefix', 'encoding'],
  properties: {
    key: { type: 'string', description: 'Ready-to-use key of the derived document (`<collectionPrefix>/<flattened source key>`).' },
    modelType: { type: 'string' },
    modelName: { type: 'string' },
    collectionPrefix: { type: 'string' },
    encoding: { type: 'string', enum: ['one-way', 'two-way'], description: 'Flat-key encoding: `one-way` strips slashes, `two-way` replaces them with underscores.' }
  }
} as const;

const MODEL_DECODE_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['key', 'valid', 'leaf', 'ancestors', 'unresolvedPrefixes', 'issues', 'derivedKeys'],
  properties: {
    ...DECODED_SEGMENTS_PROPERTIES,
    derivedKeys: {
      type: 'array',
      description: 'Composite-key models whose document id is derived from this key (from `@dbxModelCompositeKey`), each with its ready-to-use key. Empty when none apply or the key is not valid.',
      items: DERIVED_KEY_SCHEMA
    },
    compositeSource: {
      type: 'object',
      description: 'When the leaf is a two-way composite-key model, the source key recovered from its id, decoded. Absent otherwise.',
      required: ['key', 'valid', 'leaf', 'ancestors', 'unresolvedPrefixes', 'issues'],
      properties: DECODED_SEGMENTS_PROPERTIES
    }
  }
} as const;
