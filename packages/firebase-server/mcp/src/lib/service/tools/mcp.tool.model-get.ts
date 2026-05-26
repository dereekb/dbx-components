import { type Maybe } from '@dereekb/util';
import { type FirestoreModelIdentity, type FirestoreModelKey, type FirestoreModelType } from '@dereekb/firebase';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type ModelAccessMultiReadResult, type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { formatMcpToolErrorResponse } from '../mcp.response-formatter';
import { buildStaticWireEntry, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';

// MARK: Constants
/**
 * Reserved tool name for the built-in `model-get` static tool.
 */
export const MODEL_GET_TOOL_NAME = 'model-get';

/**
 * Synthetic call type used in the tool's dispatch identity. Aligns with the dbx-cli `get`
 * command and the `/api/model/:modelType/get` HTTP endpoint that backs it.
 */
export const MODEL_GET_DISPATCH_CALL = 'get';

/**
 * Synthetic model type used in the tool's dispatch identity. The tool itself isn't bound to a
 * specific model type (the `modelType` is part of its input), so we use the literal "model" as
 * the identity. Apps avoiding collision should not register a real model literally named
 * "model".
 */
export const MODEL_GET_DISPATCH_MODEL_TYPE = 'model';

/**
 * Maximum number of keys per backend multi-read request. Matches
 * `MAX_MODEL_ACCESS_MULTI_READ_KEYS` exported from `@dereekb/firebase-server`; mirrored as a
 * local constant so the bundler doesn't have to follow the import chain just for one number.
 */
export const MCP_MODEL_GET_BATCH_SIZE = 50;

// MARK: Types
/**
 * Per-batch read function. Identical signature to {@link ModelApiGetService.readDocuments} so the
 * service method can be passed directly.
 */
export type McpModelGetReadDocuments = (modelType: FirestoreModelType, keys: FirestoreModelKey[], auth: Maybe<FirebaseServerAuthData>) => Promise<ModelAccessMultiReadResult>;

/**
 * Lookup function that resolves a `modelType` to its registered {@link FirestoreModelIdentity}.
 *
 * Takes the request's auth so the wiring layer can build a real model context on first use
 * (the underlying `getFirestoreCollection(context)` accessor is context-dependent). Returns
 * `undefined` for unknown model types; the handler surfaces this as a user-visible error.
 */
export type McpModelGetResolveIdentity = (modelType: FirestoreModelType, auth: Maybe<FirebaseServerAuthData>) => Maybe<FirestoreModelIdentity>;

/**
 * Constructor dependencies for {@link createModelGetTool}.
 */
export interface CreateModelGetToolDeps {
  /**
   * Reads a batch of model documents. Provided as a callback so the unit tests can mock it
   * without instantiating the Nest DI container.
   */
  readonly readDocuments: McpModelGetReadDocuments;
  /**
   * Resolves the registered identity for a model type so bare ids can be promoted into full
   * `prefix/id` keys.
   */
  readonly resolveIdentity: McpModelGetResolveIdentity;
}

/**
 * Shape of the `model-get` tool input.
 */
export interface ModelGetToolInput {
  readonly modelType: string;
  readonly keys: ReadonlyArray<string>;
}

// MARK: Factory
/**
 * Builds the built-in `model-get` MCP tool definition.
 *
 * Mirrors dbx-cli's `get` / `get-many` behavior:
 * - Accepts an array of keys; values containing `/` are treated as full keys and passed verbatim
 *   while bare ids are promoted to `${collectionName}/${id}` for root models.
 * - Nested (subcollection) models reject bare ids since a parent path is required.
 * - Auto-chunks at {@link MCP_MODEL_GET_BATCH_SIZE} keys per backend call, mirroring
 *   `getMultipleModelsOverHttpChunked` on the CLI side.
 *
 * The handler returns the same `{ results, errors }` shape produced by
 * `ModelApiGetService.readDocuments`, exposed via both the text content block and
 * `structuredContent` so MCP clients can consume either form.
 *
 * @param deps - Read-documents and identity-resolver callbacks (typically wired to
 *   `ModelApiGetService`).
 * @returns A statically-registered {@link McpToolDefinition} ready to be appended to the MCP
 *   server factory's tool registry.
 */
export function createModelGetTool(deps: CreateModelGetToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (args, ctx) => modelGetToolHandler(args, ctx, deps);
  const name = MODEL_GET_TOOL_NAME;
  const description = 'Fetch one or more Firestore model documents by key or bare id. Values containing `/` are treated as full keys; bare ids are auto-promoted to `<collectionName>/<id>` for root models. Subcollection models require full keys.';

  return {
    name,
    description,
    inputSchema: MODEL_GET_INPUT_SCHEMA,
    outputSchema: MODEL_GET_OUTPUT_SCHEMA,
    dispatch: {
      call: MODEL_GET_DISPATCH_CALL,
      modelType: MODEL_GET_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    filterMetadata: {
      visibilityKind: 'declarative',
      rule: { requireAuthenticated: true },
      effectiveReadOnly: true
    },
    staticWireEntry: buildStaticWireEntry({ name, description, inputSchema: MODEL_GET_INPUT_SCHEMA, outputSchema: MODEL_GET_OUTPUT_SCHEMA })
  };
}

// MARK: Handler
async function modelGetToolHandler(args: Record<string, unknown>, ctx: McpStaticToolHandlerContext, deps: CreateModelGetToolDeps): Promise<CallToolResult> {
  let result: CallToolResult;

  try {
    const input = parseModelGetInput(args);
    const identity = deps.resolveIdentity(input.modelType, ctx.auth);

    if (identity == null) {
      throw new Error(`Unknown modelType: ${input.modelType}`);
    }

    const resolvedKeys = resolveKeys(input.keys, identity);
    const merged = await readInChunks(input.modelType, resolvedKeys, ctx.auth, deps.readDocuments);

    result = {
      content: [{ type: 'text', text: JSON.stringify(merged) }],
      structuredContent: merged as unknown as Record<string, unknown>
    };
  } catch (error) {
    result = formatMcpToolErrorResponse(error) as CallToolResult;
  }

  return result;
}

function parseModelGetInput(args: Record<string, unknown>): ModelGetToolInput {
  const modelType = args.modelType;
  const keys = args.keys;

  if (typeof modelType !== 'string' || modelType.length === 0) {
    throw new Error('model-get: "modelType" is required and must be a non-empty string.');
  }

  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('model-get: "keys" is required and must be a non-empty array.');
  }

  const normalizedKeys = keys.map((value, index) => {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`model-get: keys[${index}] must be a non-empty string.`);
    }
    return value;
  });

  return { modelType, keys: normalizedKeys };
}

function resolveKeys(keys: ReadonlyArray<string>, identity: FirestoreModelIdentity): FirestoreModelKey[] {
  const isRoot = identity.type === 'root';
  const resolved: FirestoreModelKey[] = [];

  for (const value of keys) {
    if (value.includes('/')) {
      resolved.push(value);
    } else if (isRoot) {
      resolved.push(`${identity.collectionName}/${value}`);
    } else {
      throw new Error(`model-get: modelType "${identity.modelType}" is a subcollection; bare ids are not allowed. Provide full keys (e.g. "parentPrefix/parentId/${identity.collectionName}/${value}").`);
    }
  }

  return resolved;
}

async function readInChunks(modelType: FirestoreModelType, keys: FirestoreModelKey[], auth: Maybe<FirebaseServerAuthData>, readDocuments: McpModelGetReadDocuments): Promise<ModelAccessMultiReadResult> {
  const merged: ModelAccessMultiReadResult = { results: [], errors: [] };

  for (let offset = 0; offset < keys.length; offset += MCP_MODEL_GET_BATCH_SIZE) {
    const batch = keys.slice(offset, offset + MCP_MODEL_GET_BATCH_SIZE);
    const partial = await readDocuments(modelType, batch, auth);
    merged.results.push(...partial.results);
    merged.errors.push(...partial.errors);
  }

  return merged;
}

// MARK: Schemas
const MODEL_GET_INPUT_SCHEMA = {
  type: 'object',
  required: ['modelType', 'keys'],
  properties: {
    modelType: {
      type: 'string',
      minLength: 1,
      description: 'Firestore model type to fetch (e.g. "guestbook", "profile").'
    },
    keys: {
      type: 'array',
      minItems: 1,
      description: 'Full keys ("prefix/id") or bare ids (root models only).',
      items: { type: 'string', minLength: 1 }
    }
  },
  additionalProperties: false
} as const;

const MODEL_GET_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['results', 'errors'],
  properties: {
    results: {
      type: 'array',
      description: 'Per-key successful reads.',
      items: {
        type: 'object',
        required: ['key', 'data'],
        properties: {
          key: { type: 'string' },
          data: {}
        }
      }
    },
    errors: {
      type: 'array',
      description: 'Per-key failures (not-found, forbidden, etc.).',
      items: {
        type: 'object',
        required: ['key', 'message'],
        properties: {
          key: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' }
        }
      }
    }
  }
} as const;
