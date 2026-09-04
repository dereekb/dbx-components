import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type FirebaseAuthUserId, type FirestoreModelIdentity, type FirestoreModelKey, type FirestoreModelType } from '@dereekb/firebase';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { type ModelAccessMultiRoleMapResult, type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { formatMcpToolErrorResponse } from '../mcp.response-formatter';
import { buildStaticToolDefinition, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';

// MARK: Constants
/**
 * Reserved tool name for the built-in `model-roles` static tool.
 */
export const MODEL_ROLES_TOOL_NAME = 'model-roles';

/**
 * Synthetic call type used in the tool's dispatch identity. Distinct from `model-get`'s `get` so
 * visibility predicates can target the two independently.
 */
export const MODEL_ROLES_DISPATCH_CALL = 'roles';

/**
 * Synthetic model type used in the tool's dispatch identity. Mirrors {@link MODEL_GET_DISPATCH_MODEL_TYPE}
 * — the tool isn't bound to one model type, so the literal "model" stands in.
 */
export const MODEL_ROLES_DISPATCH_MODEL_TYPE = 'model';

/**
 * Maximum number of keys accepted per `model-roles` call. Role resolution runs the model's real
 * permission delegate per key (which may itself read parent documents), so this is deliberately
 * lower than the `model-get` batch size.
 */
export const MCP_MODEL_ROLES_MAX_KEYS = 25;

// MARK: Types
/**
 * Resolves granted role maps for a batch of keys. Signature matches
 * `ModelApiGetService.readRoleMaps` so the service method can be passed directly.
 */
export type McpModelRolesReadRoleMaps = (params: { readonly modelType: FirestoreModelType; readonly keys: FirestoreModelKey[]; readonly auth: Maybe<FirebaseServerAuthData>; readonly targetUid?: Maybe<FirebaseAuthUserId> }) => Promise<ModelAccessMultiRoleMapResult>;

/**
 * Lookup that resolves a `modelType` to its registered {@link FirestoreModelIdentity}, so bare ids
 * can be promoted to full keys. Mirrors `McpModelGetResolveIdentity`.
 */
export type McpModelRolesResolveIdentity = (modelType: FirestoreModelType, auth: Maybe<FirebaseServerAuthData>) => Maybe<FirestoreModelIdentity>;

/**
 * Predicate authorizing a caller to resolve roles for a uid other than their own. Mirrors
 * `McpModelRolesTargetUidPredicate` from the module config; redeclared here so this module does not
 * depend on the config module.
 */
export type McpModelRolesTargetUidCheck = (auth: Maybe<FirebaseServerAuthData>) => PromiseOrValue<boolean>;

/**
 * Constructor dependencies for {@link createModelRolesTool}.
 */
export interface CreateModelRolesToolDeps {
  /**
   * Resolves the granted role maps for a batch of keys.
   */
  readonly readRoleMaps: McpModelRolesReadRoleMaps;
  /**
   * Resolves the registered identity for a model type so bare ids can be promoted into full keys.
   */
  readonly resolveIdentity: McpModelRolesResolveIdentity;
  /**
   * Authorizes use of the `uid` parameter. Omitted means the parameter fails closed for everyone;
   * the tool still answers for the calling user.
   */
  readonly canTargetOtherUids?: Maybe<McpModelRolesTargetUidCheck>;
}

/**
 * Shape of the `model-roles` tool input.
 */
export interface ModelRolesToolInput {
  readonly modelType: string;
  readonly keys: ReadonlyArray<string>;
  readonly uid?: string;
}

// MARK: Factory
/**
 * Builds the built-in `model-roles` MCP tool definition.
 *
 * Answers "what is this user actually allowed to do with this document?" by running the same
 * `roleMapForModel()` delegate the permission-checked read/write paths use, and returning the
 * resolved roles instead of consuming them. Because the model's real delegate runs, derived and
 * cascading roles appear exactly as the API grants them — there is no second implementation of the
 * rules to drift.
 *
 * Two things it disambiguates that a plain read cannot:
 * - **Missing vs. forbidden.** A key that resolves to a missing document returns
 *   `exists: false, roles: []` rather than an error, so "the document is not there" reads
 *   differently from "it is there and you have no access" (`exists: true, roles: []`).
 * - **Full access.** Admin short-circuits that grant the full-access marker come back as
 *   `fullAccess: true` rather than as an opaque enumerated set.
 *
 * By default roles are resolved for the calling user. Passing `uid` resolves them for another user
 * and is gated behind {@link CreateModelRolesToolDeps.canTargetOtherUids}.
 *
 * @param deps - Role-map reader, identity resolver, and the target-uid authorization predicate.
 * @returns A statically-registered {@link McpToolDefinition} ready to be appended to the MCP
 *   server factory's tool registry.
 */
export function createModelRolesTool(deps: CreateModelRolesToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (args, ctx) => modelRolesToolHandler(args, ctx, deps);
  const name = MODEL_ROLES_TOOL_NAME;
  const description =
    'Resolve which roles the current user (or, with "uid", another user) is granted on one or more model keys — the same permission computation the API runs, returned instead of enforced. Use to answer "why was this forbidden?" and to tell a missing document (exists:false) apart from one you cannot access (exists:true, roles:[]). Admin full-access short-circuits report fullAccess:true. Targeting another uid requires elevated access.';

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: MODEL_ROLES_INPUT_SCHEMA,
    outputSchema: MODEL_ROLES_OUTPUT_SCHEMA,
    dispatch: {
      call: MODEL_ROLES_DISPATCH_CALL,
      modelType: MODEL_ROLES_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    effectiveReadOnly: true,
    rule: { requireAuthenticated: true }
  });
}

// MARK: Handler
async function modelRolesToolHandler(args: Record<string, unknown>, ctx: McpStaticToolHandlerContext, deps: CreateModelRolesToolDeps): Promise<CallToolResult> {
  let result: CallToolResult;

  try {
    const input = parseModelRolesInput(args);
    const identity = deps.resolveIdentity(input.modelType, ctx.auth);

    if (identity == null) {
      throw new Error(`Unknown modelType: ${input.modelType}`);
    }

    const targetUid = await resolveTargetUid({ requestedUid: input.uid, auth: ctx.auth, canTargetOtherUids: deps.canTargetOtherUids });
    const keys = resolveKeys(input.keys, identity);
    const resolved = await deps.readRoleMaps({ modelType: input.modelType, keys, auth: ctx.auth, ...(targetUid == null ? {} : { targetUid }) });

    result = {
      content: [{ type: 'text', text: JSON.stringify(resolved) }],
      structuredContent: resolved as unknown as Record<string, unknown>
    };
  } catch (error) {
    result = formatMcpToolErrorResponse(error) as CallToolResult;
  }

  return result;
}

interface ResolveTargetUidInput {
  readonly requestedUid: Maybe<string>;
  readonly auth: Maybe<FirebaseServerAuthData>;
  readonly canTargetOtherUids: Maybe<McpModelRolesTargetUidCheck>;
}

/**
 * Resolves the effective target uid for a call, enforcing the elevated-access gate.
 *
 * Requesting your own uid is always allowed and is treated as no target at all, so a caller that
 * passes their own uid never trips the predicate.
 *
 * @param input - The requested uid, the caller's auth, and the authorization predicate.
 * @returns The uid to resolve as, or `undefined` to resolve as the caller.
 * @throws {Error} When another user's uid is requested and the predicate denies (or is absent).
 */
async function resolveTargetUid(input: ResolveTargetUidInput): Promise<Maybe<string>> {
  const { requestedUid, auth, canTargetOtherUids } = input;
  let result: Maybe<string>;

  if (requestedUid != null && requestedUid !== auth?.uid) {
    const allowed = canTargetOtherUids == null ? false : await canTargetOtherUids(auth);

    if (!allowed) {
      throw new Error("model-roles: resolving roles for another user's uid requires elevated access.");
    }

    result = requestedUid;
  }

  return result;
}

function parseModelRolesInput(args: Record<string, unknown>): ModelRolesToolInput {
  const modelType = args['modelType'];
  const keys = args['keys'];
  const uid = args['uid'];

  if (typeof modelType !== 'string' || modelType.length === 0) {
    throw new Error('model-roles: "modelType" is required and must be a non-empty string.');
  }

  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('model-roles: "keys" is required and must be a non-empty array.');
  }

  if (keys.length > MCP_MODEL_ROLES_MAX_KEYS) {
    throw new Error(`model-roles: at most ${MCP_MODEL_ROLES_MAX_KEYS} keys may be resolved per call (received ${keys.length}).`);
  }

  if (uid !== undefined && (typeof uid !== 'string' || uid.length === 0)) {
    throw new Error('model-roles: "uid" must be a non-empty string when provided.');
  }

  const normalizedKeys = keys.map((value, index) => {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`model-roles: keys[${index}] must be a non-empty string.`);
    }
    return value;
  });

  return { modelType, keys: normalizedKeys, ...(uid === undefined ? {} : { uid }) };
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
      throw new Error(`model-roles: modelType "${identity.modelType}" is a subcollection; bare ids are not allowed. Provide full keys (e.g. "parentPrefix/parentId/${identity.collectionName}/${value}").`);
    }
  }

  return resolved;
}

// MARK: Schemas
const MODEL_ROLES_INPUT_SCHEMA = {
  type: 'object',
  required: ['modelType', 'keys'],
  properties: {
    modelType: {
      type: 'string',
      minLength: 1,
      description: 'Firestore model type to resolve roles on (e.g. "guestbook", "profile").'
    },
    keys: {
      type: 'array',
      minItems: 1,
      maxItems: MCP_MODEL_ROLES_MAX_KEYS,
      description: 'Full keys ("prefix/id") or bare ids (root models only).',
      items: { type: 'string', minLength: 1 }
    },
    uid: {
      type: 'string',
      minLength: 1,
      description: 'Resolve roles as this user instead of the caller. Requires elevated access; passing your own uid is always allowed.'
    }
  },
  additionalProperties: false
} as const;

const MODEL_ROLES_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['targeted', 'results', 'errors'],
  properties: {
    uid: {
      type: 'string',
      description: 'The uid the roles were resolved for.'
    },
    targeted: {
      type: 'boolean',
      description: 'True when the roles were resolved for a user other than the caller.'
    },
    results: {
      type: 'array',
      description: 'Per-key resolved permission state.',
      items: {
        type: 'object',
        required: ['key', 'exists', 'fullAccess', 'roles'],
        properties: {
          key: { type: 'string' },
          exists: { type: 'boolean', description: 'Whether the document exists. Roles are only computed for documents that exist.' },
          fullAccess: { type: 'boolean', description: 'True when the full-access marker was granted; every role is implicitly held and "roles" is empty.' },
          roles: { type: 'array', items: { type: 'string' }, description: 'Granted role names, sorted.' }
        }
      }
    },
    errors: {
      type: 'array',
      description: 'Per-key failures. A missing document is NOT an error — it appears in results with exists:false.',
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
