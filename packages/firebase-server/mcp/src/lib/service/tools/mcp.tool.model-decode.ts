import type { CallToolResult } from '@modelcontextprotocol/server';
import { flatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { findCompositeKeyModelsDerivedFrom, type McpManifestModelCompositeKeyEncoding, type McpManifestModelEntry } from '../mcp.manifest';
import { formatMcpToolErrorResponse } from '../mcp.response-formatter';
import { buildStaticToolDefinition, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { findModelEntry } from './mcp.tool.model-info';

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
}

/**
 * Shape of the `model-decode` tool input.
 */
export interface ModelDecodeToolInput {
  readonly key: string;
}

/**
 * One segment of a decoded Firestore key. `model*` fields are absent when the
 * segment's `prefix` isn't in the manifest.
 */
export interface DecodedKeySegment {
  readonly prefix: string;
  readonly id: string;
  readonly modelType?: string;
  readonly modelName?: string;
  readonly modelGroup?: string;
  readonly identityConst?: string;
  readonly parentIdentityConst?: string;
  readonly sourcePackage?: string;
  readonly sourceFile?: string;
}

/**
 * Segments of a decoded Firestore key — the leaf, its ancestor chain, and any prefixes the manifest
 * could not resolve.
 */
export interface DecodedKeySegments {
  readonly key: string;
  readonly leaf: DecodedKeySegment;
  readonly ancestors: ReadonlyArray<DecodedKeySegment>;
  readonly unresolvedPrefixes: ReadonlyArray<string>;
}

/**
 * A composite-key model whose document id is derived from the decoded key, with that document's
 * ready-to-use key. Published so a caller never has to hand-build a flattened id (e.g. decoding a
 * `District` key also yields the `jobDistrict` key `jd/<flattened district key>`).
 */
export interface DerivedCompositeKey {
  /**
   * The derived document's full key (`<collectionPrefix>/<flattened source key>`).
   */
  readonly key: string;
  readonly modelType: string;
  readonly modelName: string;
  readonly collectionPrefix: string;
  readonly encoding: McpManifestModelCompositeKeyEncoding;
}

/**
 * Output payload for the `model-decode` tool.
 */
export interface ModelDecodeToolOutput extends DecodedKeySegments {
  /**
   * Composite-key models derived from this key (see {@link DerivedCompositeKey}). Empty when the leaf
   * prefix is unresolved or no model declares this leaf as a composite-key source.
   */
  readonly derivedKeys: ReadonlyArray<DerivedCompositeKey>;
  /**
   * When the leaf is itself a `two-way` composite-key model, the source key recovered from its id
   * (`inferKeyFromTwoWayFlatFirestoreModelKey`), decoded. Absent for `one-way` models (the source is
   * not recoverable) and when the id does not parse as a flattened key.
   */
  readonly compositeSource?: DecodedKeySegments;
}

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
  const description = `Decode a Firestore model key ("prefix/id", or subcollection path "parentPrefix/parentId/childPrefix/childId") into { leaf, ancestors, unresolvedPrefixes, derivedKeys, compositeSource? } using the registered manifest (${deps.manifest.length} model${deps.manifest.length === 1 ? '' : 's'}). \`derivedKeys\` lists composite-key models whose document id is a flattened form of this key, each with its ready-to-use key.`;

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: MODEL_DECODE_INPUT_SCHEMA,
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
 * returns the leaf segment + ancestor chain, plus the composite-key relationships declared
 * on the manifest: the keys of models derived from this key (`derivedKeys`) and, for a
 * two-way composite-key leaf, the recovered source key (`compositeSource`).
 *
 * Mirrors the dbx-cli `decodeFirestoreModelKey` helper structurally; both implementations
 * must stay in lockstep on segment count, resolution order, and composite-key output.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The model manifest.
 * @returns The decoded key with leaf, ancestors, unresolved prefixes, and composite-key relationships.
 * @throws {Error} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKey(rawKey: string, manifest: ReadonlyArray<McpManifestModelEntry>): ModelDecodeToolOutput {
  const segments = decodeFirestoreModelKeySegments(rawKey, manifest);
  const leafEntry = segments.leaf.modelType == null ? undefined : findModelEntry(segments.leaf.prefix, manifest);
  const derivedKeys = leafEntry == null ? [] : findCompositeKeyModelsDerivedFrom(leafEntry, manifest).map((entry) => toDerivedCompositeKey(segments.key, entry));
  const compositeSource = leafEntry?.compositeKey?.encoding === 'two-way' ? decodeTwoWayCompositeSource(segments.leaf.id, manifest) : undefined;

  return {
    ...segments,
    derivedKeys,
    ...(compositeSource == null ? {} : { compositeSource })
  };
}

function toDerivedCompositeKey(sourceKey: string, entry: McpManifestModelEntry): DerivedCompositeKey {
  const encoding = entry.compositeKey?.encoding ?? 'one-way';
  const flatId = encoding === 'two-way' ? twoWayFlatFirestoreModelKey(sourceKey) : flatFirestoreModelKey(sourceKey);

  return {
    key: `${entry.collectionPrefix}/${flatId}`,
    modelType: entry.modelType,
    modelName: entry.modelName,
    collectionPrefix: entry.collectionPrefix,
    encoding
  };
}

/**
 * Recovers and decodes the source key behind a two-way flattened id.
 *
 * @param flatId - The leaf document id of a two-way composite-key model.
 * @param manifest - The model manifest.
 * @returns The decoded source key, or `undefined` when the id does not contain a separator or does
 *   not recover to an even number of segments — it was not produced by `twoWayFlatFirestoreModelKey`.
 */
function decodeTwoWayCompositeSource(flatId: string, manifest: ReadonlyArray<McpManifestModelEntry>): DecodedKeySegments | undefined {
  let result: DecodedKeySegments | undefined;

  if (flatId.includes('_')) {
    const sourceKey = inferKeyFromTwoWayFlatFirestoreModelKey(flatId);
    const segmentCount = sourceKey.split('/').filter((s) => s.length > 0).length;

    if (segmentCount >= 2 && segmentCount % 2 === 0) {
      result = decodeFirestoreModelKeySegments(sourceKey, manifest);
    }
  }

  return result;
}

/**
 * Splits `rawKey` on `/` and resolves each `[prefix, id]` pair against the manifest — the segment
 * walk shared by {@link decodeFirestoreModelKey} and the two-way composite-source decode.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The model manifest.
 * @returns The decoded key with leaf, ancestors, and any unresolved prefixes.
 * @throws {Error} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKeySegments(rawKey: string, manifest: ReadonlyArray<McpManifestModelEntry>): DecodedKeySegments {
  const trimmed = rawKey.trim();

  if (trimmed.length === 0) {
    throw new Error('model-decode: key is empty. Provide a Firestore key like `sf/abc123`.');
  }

  const segments = trimmed.split('/').filter((s) => s.length > 0);

  if (segments.length < 2 || segments.length % 2 !== 0) {
    throw new Error(`model-decode: invalid Firestore key "${trimmed}". Expected an even number of segments (\`prefix/id\` pairs). Got ${segments.length} segment(s). Use the format \`prefix/id\` (or \`parentPrefix/parentId/childPrefix/childId\` for subcollections).`);
  }

  const decoded: DecodedKeySegment[] = [];
  const unresolved: string[] = [];

  for (let i = 0; i < segments.length; i += 2) {
    const prefix = segments[i];
    const id = segments[i + 1];
    const entry = findModelEntry(prefix, manifest);
    if (entry == null) {
      unresolved.push(prefix);
    }
    decoded.push(toSegment(prefix, id, entry));
  }

  const leaf = decoded.at(-1) as DecodedKeySegment;
  const ancestors = decoded.slice(0, -1);

  return { key: trimmed, leaf, ancestors, unresolvedPrefixes: unresolved };
}

function toSegment(prefix: string, id: string, entry: McpManifestModelEntry | undefined): DecodedKeySegment {
  const segment: DecodedKeySegment = entry
    ? {
        prefix,
        id,
        modelType: entry.modelType,
        modelName: entry.modelName,
        identityConst: entry.identityConst,
        sourcePackage: entry.sourcePackage,
        sourceFile: entry.sourceFile,
        ...(entry.modelGroup == null ? {} : { modelGroup: entry.modelGroup }),
        ...(entry.parentIdentityConst == null ? {} : { parentIdentityConst: entry.parentIdentityConst })
      }
    : { prefix, id };
  return segment;
}

// MARK: Schemas
const MODEL_DECODE_INPUT_SCHEMA = {
  type: 'object',
  required: ['key'],
  properties: {
    key: {
      type: 'string',
      minLength: 1,
      description: 'Firestore model key — prefix/id, or `parentPrefix/parentId/childPrefix/childId` for subcollections.'
    }
  },
  additionalProperties: false
} as const;

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

const DECODED_SEGMENTS_PROPERTIES = {
  key: { type: 'string', description: 'The trimmed input key.' },
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
  required: ['key', 'leaf', 'ancestors', 'unresolvedPrefixes', 'derivedKeys'],
  properties: {
    ...DECODED_SEGMENTS_PROPERTIES,
    derivedKeys: {
      type: 'array',
      description: 'Composite-key models whose document id is derived from this key (from `@dbxModelCompositeKey`), each with its ready-to-use key. Empty when none apply.',
      items: DERIVED_KEY_SCHEMA
    },
    compositeSource: {
      type: 'object',
      description: 'When the leaf is a two-way composite-key model, the source key recovered from its id, decoded. Absent otherwise.',
      required: ['key', 'leaf', 'ancestors', 'unresolvedPrefixes'],
      properties: DECODED_SEGMENTS_PROPERTIES
    }
  }
} as const;
