import { IMPERSONATION_URL_QUERY_PARAM, type Maybe } from '@dereekb/util';
import { type FirestoreModelIdentity, type FirestoreModelKey, type FirestoreModelType, inferKeyFromTwoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type ModelAccessMultiReadResult } from '@dereekb/firebase-server';
import { formatMcpToolErrorResponse } from '../mcp.response-formatter';
import { buildStaticToolDefinition, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { matchRouteManifestUrl, type RouteManifest, type RouteManifestModelEntry, type RouteManifestStateEntry, type RouteUrlMatch } from '../mcp.route-manifest';
import { MCP_MODEL_GET_BATCH_SIZE, type McpModelGetReadDocuments, type McpModelGetResolveIdentity } from './mcp.tool.model-get';

// MARK: Constants
/**
 * Reserved tool name for the built-in `url-models` static tool.
 */
export const URL_MODELS_TOOL_NAME = 'url-models';

/**
 * Synthetic call type used in the tool's dispatch identity.
 */
export const URL_MODELS_DISPATCH_CALL = 'url-models';

/**
 * Synthetic model type used in the tool's dispatch identity. The tool isn't
 * bound to a real model (the `url` is its input), so we use the literal "route".
 */
export const URL_MODELS_DISPATCH_MODEL_TYPE = 'route';

/**
 * Placeholder segment standing for the caller's authenticated uid.
 */
const AUTH_UID_PLACEHOLDER = '{authUid}';

/**
 * Matches a `{flatKey:<param>}` key template, capturing the route param whose
 * URL value is a whole two-way-flat FirestoreModelKey. Mirror of the build-time
 * `FLAT_KEY_TOKEN_RE` in `@dereekb/dbx-cli`'s route-model-tag parser.
 */
const FLAT_KEY_TEMPLATE_RE = /^\{flatKey:([a-zA-Z_][a-zA-Z0-9_]*)\}$/u;

/**
 * Reads the impersonation uid from a URL's `?imp=<uid>` query parameter, if present.
 *
 * Impersonation ("view as another user") is conveyed by the {@link IMPERSONATION_URL_QUERY_PARAM} query
 * param; when set, it overrides the uid used to fill `{authUid}` placeholders so a decoded URL reports the
 * models the impersonated user's page renders. Handles both a full URL and a bare path (mirroring
 * {@link parseUrlModelsPathname}, which discards the query when matching). Returns the trimmed non-empty
 * uid, or `undefined` when absent.
 *
 * @param url - A full URL or bare path, optionally carrying `?imp=<uid>`.
 * @returns The impersonated uid, or `undefined`.
 */
export function readUrlModelsImpersonationUid(url: string): Maybe<string> {
  const trimmed = url.trim();
  let search: string;

  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed)) {
    search = new URL(trimmed).search;
  } else {
    const hashStripped = trimmed.split('#', 1)[0];
    const queryIndex = hashStripped.indexOf('?');
    search = queryIndex >= 0 ? hashStripped.slice(queryIndex) : '';
  }

  const value = new URLSearchParams(search).get(IMPERSONATION_URL_QUERY_PARAM)?.trim();
  return value ? value : undefined;
}

// MARK: Types
/**
 * Why a model binding could not be resolved into a concrete key.
 */
export type UrlModelUnresolvedReason = 'missing-param' | 'subcollection-requires-key-template' | 'unknown-model-type' | 'auth-required' | 'invalid-flat-key';

/**
 * One resolved model binding for a matched page.
 */
export interface ResolvedRouteModel {
  readonly modelType: string;
  readonly kind: RouteManifestModelEntry['kind'];
  readonly keyTemplate?: string;
  readonly description?: string;
  readonly from?: string;
  /**
   * The concrete FirestoreModelKey, when the binding resolved (`id`/`key` kinds).
   */
  readonly key?: FirestoreModelKey;
  /**
   * Present when the binding could not be turned into a key.
   */
  readonly unresolved?: { readonly reason: UrlModelUnresolvedReason; readonly message: string };
}

/**
 * Documents loaded for one model type (when `load` is requested).
 */
export interface UrlModelLoadedGroup {
  readonly modelType: string;
  readonly results: ModelAccessMultiReadResult['results'];
  readonly errors: ModelAccessMultiReadResult['errors'];
}

/**
 * Constructor dependencies for {@link createUrlModelsTool}.
 */
export interface CreateUrlModelsToolDeps {
  /**
   * The pre-rendered route manifest used to match URLs to states.
   */
  readonly routeManifest: RouteManifest;
  /**
   * Reads a batch of model documents (shared with `model-get`).
   */
  readonly readDocuments: McpModelGetReadDocuments;
  /**
   * Resolves a model type's registered identity so `id` key templates can be
   * promoted to `<collectionName>/<id>` (shared with `model-get`).
   */
  readonly resolveIdentity: McpModelGetResolveIdentity;
}

/**
 * Shape of the `url-models` tool input.
 */
export interface UrlModelsToolInput {
  readonly url: string;
  readonly models?: ReadonlyArray<string>;
  readonly keysOnly?: boolean;
  readonly load?: boolean;
  /**
   * Overrides the uid used to fill `{authUid}` placeholders when resolving model
   * keys (defaults to the authenticated caller). Use to preview the models
   * another user would see on a page. A `?imp=<uid>` (impersonation) query param
   * on the `url` takes precedence over this. Does not affect the document-load
   * path — `load` still reads via the calling user's permissions.
   */
  readonly currentUserUid?: string;
}

// MARK: Factory
/**
 * Builds the built-in `url-models` MCP tool definition.
 *
 * Matches a pasted app URL against the build-time route manifest and returns the
 * Firestore models the page renders — model types plus concrete keys with the
 * route params and `{authUid}` substituted. Optionally filtered to specific
 * `models`, reduced to keys-only, or loaded via the same permission-checked read
 * path as `model-get`.
 *
 * A URL that matches no state returns a structured `{ matched: null, candidates }`
 * (not an error) so the caller can suggest near-misses.
 *
 * @param deps - The route manifest plus the shared read-documents / identity callbacks.
 * @returns A statically-registered {@link McpToolDefinition}.
 */
export function createUrlModelsTool(deps: CreateUrlModelsToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (args, ctx) => urlModelsToolHandler(args, ctx, deps);
  const name = URL_MODELS_TOOL_NAME;
  const description =
    'Decode an app URL (or path) into the Firestore models its page renders. Pass a URL like `https://app.example.co/worker/abc/timesheets/list`; the tool matches it against the build-time route manifest and returns each model type plus the concrete key (route params + `{authUid}` substituted). A `?imp=<uid>` query param resolves `{authUid}` to that user (impersonation preview). Use `models` to filter to specific types, `keysOnly` for just the resolved keys, or `load: true` to fetch the documents via the same permission-checked path as `model-get` (cannot combine `load` with `keysOnly`).';

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: URL_MODELS_INPUT_SCHEMA,
    outputSchema: URL_MODELS_OUTPUT_SCHEMA,
    dispatch: {
      call: URL_MODELS_DISPATCH_CALL,
      modelType: URL_MODELS_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    effectiveReadOnly: true,
    rule: { requireAuthenticated: true }
  });
}

// MARK: Handler
async function urlModelsToolHandler(args: Record<string, unknown>, ctx: McpStaticToolHandlerContext, deps: CreateUrlModelsToolDeps): Promise<CallToolResult> {
  let result: CallToolResult;

  try {
    const input = parseUrlModelsInput(args);
    const payload = await resolveUrlModels(input, ctx, deps);
    result = {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      structuredContent: payload as unknown as Record<string, unknown>
    };
  } catch (error) {
    result = formatMcpToolErrorResponse(error) as CallToolResult;
  }

  return result;
}

function parseUrlModelsInput(args: Record<string, unknown>): UrlModelsToolInput {
  const url = args.url;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('url-models: "url" is required and must be a non-empty string.');
  }

  const keysOnly = args.keysOnly === true;
  const load = args.load === true;
  if (keysOnly && load) {
    throw new Error('url-models: "keysOnly" and "load" cannot be combined — "keysOnly" returns keys without loading documents.');
  }

  let models: ReadonlyArray<string> | undefined;
  if (args.models !== undefined) {
    if (!Array.isArray(args.models) || args.models.some((m) => typeof m !== 'string')) {
      throw new Error('url-models: "models" must be an array of model-type strings.');
    }
    models = args.models as ReadonlyArray<string>;
  }

  let currentUserUid: string | undefined;
  if (args.currentUserUid !== undefined) {
    if (typeof args.currentUserUid !== 'string' || args.currentUserUid.length === 0) {
      throw new Error('url-models: "currentUserUid" must be a non-empty string.');
    }
    currentUserUid = args.currentUserUid;
  }

  return { url, ...(models === undefined ? {} : { models }), keysOnly, load, ...(currentUserUid === undefined ? {} : { currentUserUid }) };
}

interface UrlModelsPayload {
  readonly url: string;
  readonly pathname: string;
  readonly matched: Maybe<UrlModelsMatchedPayload>;
  readonly ambiguous?: ReadonlyArray<{ readonly name: string; readonly fullUrl: string | undefined }>;
  readonly candidates?: ReadonlyArray<{ readonly name: string; readonly fullUrl: string | undefined }>;
}

interface UrlModelsMatchedPayload {
  readonly state: { readonly name: string; readonly fullUrl: string | undefined; readonly component: string | undefined; readonly componentFile: string | undefined };
  readonly via: 'literal' | 'param';
  readonly params: Readonly<Record<string, string>>;
  readonly models: ReadonlyArray<ResolvedRouteModel>;
  readonly loaded?: ReadonlyArray<UrlModelLoadedGroup>;
}

async function resolveUrlModels(input: UrlModelsToolInput, ctx: McpStaticToolHandlerContext, deps: CreateUrlModelsToolDeps): Promise<UrlModelsPayload> {
  const matchResult = matchRouteManifestUrl({ manifest: deps.routeManifest, url: input.url });
  let payload: UrlModelsPayload;

  if (matchResult.kind === 'none') {
    payload = { url: input.url, pathname: matchResult.pathname, matched: null, candidates: matchResult.candidates.map(stateSummary) };
  } else if (matchResult.kind === 'ambiguous') {
    payload = { url: input.url, pathname: matchResult.pathname, matched: null, ambiguous: matchResult.states.map(stateSummary) };
  } else {
    payload = { url: input.url, pathname: matchResult.pathname, matched: await buildMatchedPayload({ match: matchResult, input, ctx, deps }) };
  }

  return payload;
}

interface BuildMatchedPayloadInput {
  readonly match: RouteUrlMatch;
  readonly input: UrlModelsToolInput;
  readonly ctx: McpStaticToolHandlerContext;
  readonly deps: CreateUrlModelsToolDeps;
}

function stateSummary(state: RouteManifestStateEntry): { readonly name: string; readonly fullUrl: string | undefined } {
  return { name: state.name, fullUrl: state.fullUrl };
}

async function buildMatchedPayload(args: BuildMatchedPayloadInput): Promise<UrlModelsMatchedPayload> {
  const { match, input, ctx, deps } = args;
  // A `?imp=<uid>` query param on the URL (impersonation), then an explicit `currentUserUid`, override the
  // uid used to fill `{authUid}` placeholders so a caller can preview another user's page-models. The
  // document-load path still uses `ctx.auth`, so this is a key-substitution preview only — no privilege
  // escalation on the actual reads.
  const uid = readUrlModelsImpersonationUid(input.url) ?? input.currentUserUid ?? ctx.auth?.uid;
  const filtered = input.models === undefined ? match.state.models : match.state.models.filter((m) => input.models?.includes(m.modelType));
  const resolved = filtered.map((entry) => resolveModelEntry({ entry, params: match.params, uid, keysOnly: input.keysOnly === true, deps, ctx }));
  const loaded = input.load === true ? await loadResolvedModels(resolved, ctx, deps) : undefined;

  return {
    state: { name: match.state.name, fullUrl: match.state.fullUrl, component: match.state.component, componentFile: match.state.componentFile },
    via: match.via,
    params: match.params,
    models: resolved,
    ...(loaded === undefined ? {} : { loaded })
  };
}

// MARK: Per-entry key resolution
interface ResolveModelEntryInput {
  readonly entry: RouteManifestModelEntry;
  readonly params: Readonly<Record<string, string>>;
  readonly uid: Maybe<string>;
  readonly keysOnly: boolean;
  readonly deps: CreateUrlModelsToolDeps;
  readonly ctx: McpStaticToolHandlerContext;
}

function resolveModelEntry(input: ResolveModelEntryInput): ResolvedRouteModel {
  const { entry, keysOnly } = input;
  const base: ResolvedRouteModel = keysOnly
    ? { modelType: entry.modelType, kind: entry.kind }
    : {
        modelType: entry.modelType,
        kind: entry.kind,
        ...(entry.keyTemplate === undefined ? {} : { keyTemplate: entry.keyTemplate }),
        ...(entry.description === undefined ? {} : { description: entry.description }),
        ...(entry.from === undefined ? {} : { from: entry.from })
      };

  let result: ResolvedRouteModel;
  if (entry.kind === 'list') {
    result = base;
  } else if (entry.kind === 'id') {
    result = { ...base, ...resolveIdKey(input) };
  } else if (entry.kind === 'flatKey') {
    result = { ...base, ...resolveFlatKey(input) };
  } else {
    result = { ...base, ...resolveFullKey(input) };
  }
  return result;
}

type KeyResolution = { readonly key: FirestoreModelKey } | { readonly unresolved: { readonly reason: UrlModelUnresolvedReason; readonly message: string } };

function resolveIdKey(input: ResolveModelEntryInput): KeyResolution {
  const { entry, params, uid, deps, ctx } = input;
  const value = substitutePlaceholder(entry.keyTemplate ?? '', params, uid);
  let result: KeyResolution;

  if (value.kind === 'unresolved') {
    result = { unresolved: value.unresolved };
  } else {
    const identity: Maybe<FirestoreModelIdentity> = deps.resolveIdentity(entry.modelType, ctx.auth);
    if (identity == null) {
      result = { unresolved: { reason: 'unknown-model-type', message: `Unknown model type \`${entry.modelType}\`.` } };
    } else if (identity.type === 'root') {
      result = { key: `${identity.collectionName}/${value.value}` };
    } else {
      result = { unresolved: { reason: 'subcollection-requires-key-template', message: `Model \`${entry.modelType}\` is a subcollection; an \`id\` key template cannot be promoted to a full key. Annotate it with a full \`gb/:id/...\` key template.` } };
    }
  }

  return result;
}

function resolveFlatKey(input: ResolveModelEntryInput): KeyResolution {
  const { entry, params } = input;
  const match = FLAT_KEY_TEMPLATE_RE.exec(entry.keyTemplate ?? '');
  let result: KeyResolution;

  if (match === null) {
    // Defensive: a flatKey entry whose template is not `{flatKey:<param>}` (a malformed manifest).
    result = { unresolved: { reason: 'invalid-flat-key', message: `Model \`${entry.modelType}\` is a flatKey binding but its key template \`${entry.keyTemplate ?? ''}\` is not \`{flatKey:<param>}\`.` } };
  } else {
    const paramName = match[1];
    const value = params[paramName];
    if (value === undefined || value.length === 0) {
      result = { unresolved: { reason: 'missing-param', message: `Route param \`:${paramName}\` (the flattened model key) was not captured from the URL.` } };
    } else {
      // The param value IS a two-way-flat key (`r_<id>_cs_<id>`); un-flatten it back to `r/<id>/cs/<id>`.
      const key = inferKeyFromTwoWayFlatFirestoreModelKey(value);
      result = isEvenSegmentKey(key) ? { key } : { unresolved: { reason: 'invalid-flat-key', message: `Route param \`:${paramName}\` did not decode to a valid FirestoreModelKey (got \`${key}\`).` } };
    }
  }

  return result;
}

/**
 * Whether a decoded key has the shape of a FirestoreModelKey: a non-empty,
 * even number of `/`-separated segments (collection/id pairs).
 *
 * @param key - The decoded (un-flattened) key.
 * @returns True when the key has an even, non-zero segment count.
 */
function isEvenSegmentKey(key: string): boolean {
  const segments = key.split('/').filter((s) => s.length > 0);
  return segments.length >= 2 && segments.length % 2 === 0;
}

function resolveFullKey(input: ResolveModelEntryInput): KeyResolution {
  const { entry, params, uid } = input;
  const segments = (entry.keyTemplate ?? '').split('/');
  const parts: string[] = [];
  let unresolved: { readonly reason: UrlModelUnresolvedReason; readonly message: string } | undefined;

  for (const segment of segments) {
    if (segment.startsWith(':') || segment === AUTH_UID_PLACEHOLDER) {
      const value = substitutePlaceholder(segment, params, uid);
      if (value.kind === 'unresolved') {
        unresolved = value.unresolved;
        break;
      }
      parts.push(value.value);
    } else {
      parts.push(segment);
    }
  }

  return unresolved === undefined ? { key: parts.join('/') } : { unresolved };
}

type PlaceholderValue = { readonly kind: 'value'; readonly value: string } | { readonly kind: 'unresolved'; readonly unresolved: { readonly reason: UrlModelUnresolvedReason; readonly message: string } };

function substitutePlaceholder(segment: string, params: Readonly<Record<string, string>>, uid: Maybe<string>): PlaceholderValue {
  let result: PlaceholderValue;
  if (segment === AUTH_UID_PLACEHOLDER) {
    result = uid == null || uid.length === 0 ? { kind: 'unresolved', unresolved: { reason: 'auth-required', message: 'This page keys a model by the caller uid (`{authUid}`) but the request is not authenticated.' } } : { kind: 'value', value: uid };
  } else if (segment.startsWith(':')) {
    const paramName = segment.slice(1);
    const value = params[paramName];
    result = value === undefined ? { kind: 'unresolved', unresolved: { reason: 'missing-param', message: `Route param \`:${paramName}\` was not captured from the URL.` } } : { kind: 'value', value };
  } else {
    result = { kind: 'value', value: segment };
  }
  return result;
}

// MARK: Load
async function loadResolvedModels(resolved: ReadonlyArray<ResolvedRouteModel>, ctx: McpStaticToolHandlerContext, deps: CreateUrlModelsToolDeps): Promise<ReadonlyArray<UrlModelLoadedGroup>> {
  const keysByType = new Map<string, FirestoreModelKey[]>();
  for (const model of resolved) {
    if (model.key !== undefined) {
      const existing = keysByType.get(model.modelType);
      if (existing === undefined) {
        keysByType.set(model.modelType, [model.key]);
      } else {
        existing.push(model.key);
      }
    }
  }

  const out: UrlModelLoadedGroup[] = [];
  for (const [modelType, keys] of keysByType) {
    const merged = await readInChunks({ modelType, keys, auth: ctx.auth, readDocuments: deps.readDocuments });
    out.push({ modelType, results: merged.results, errors: merged.errors });
  }
  return out;
}

interface ReadInChunksInput {
  readonly modelType: FirestoreModelType;
  readonly keys: FirestoreModelKey[];
  readonly auth: McpStaticToolHandlerContext['auth'];
  readonly readDocuments: McpModelGetReadDocuments;
}

async function readInChunks(input: ReadInChunksInput): Promise<ModelAccessMultiReadResult> {
  const { modelType, keys, auth, readDocuments } = input;
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
const URL_MODELS_INPUT_SCHEMA = {
  type: 'object',
  required: ['url'],
  properties: {
    url: { type: 'string', minLength: 1, description: 'Full URL or pathname, e.g. "https://app.example.co/worker/abc/timesheets/list". A `?imp=<uid>` query resolves `{authUid}` to that user (impersonation preview).' },
    models: { type: 'array', items: { type: 'string' }, description: 'Restrict the output to these model types.' },
    keysOnly: { type: 'boolean', description: 'Return only the resolved keys (no descriptions or documents). Cannot combine with "load".' },
    load: { type: 'boolean', description: 'Load each resolved document via the permission-checked read path. Cannot combine with "keysOnly".' },
    currentUserUid: { type: 'string', minLength: 1, description: "Override the uid used to fill `{authUid}` placeholders when resolving model keys (defaults to the authenticated caller). Use to preview the models another user would see on a page. A `?imp=<uid>` query on the url takes precedence over this. `load` still reads via the calling user's permissions." }
  },
  additionalProperties: false
} as const;

const URL_MODELS_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['url', 'pathname', 'matched'],
  properties: {
    url: { type: 'string' },
    pathname: { type: 'string' },
    matched: {
      type: ['object', 'null'],
      description: 'The matched page and its models, or null when no state matched.',
      properties: {
        state: { type: 'object' },
        via: { type: 'string' },
        params: { type: 'object' },
        models: { type: 'array', items: { type: 'object' } },
        loaded: { type: 'array', items: { type: 'object' } }
      }
    },
    ambiguous: { type: 'array', items: { type: 'object' }, description: 'Competing states when the URL matched more than one.' },
    candidates: { type: 'array', items: { type: 'object' }, description: 'Closest near-miss states when nothing matched.' }
  }
} as const;
