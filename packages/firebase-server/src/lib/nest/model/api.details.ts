import { type AuthRole, type Configurable, type Maybe } from '@dereekb/util';
import { type OnCallFunctionType, type OnCallTypedModelParams, type FirestoreModelType, type ModelFirebaseCrudFunctionSpecifier } from '@dereekb/firebase';
import { type FirebaseServerAuthData } from '../controller/auth.context.server';
import { type OnCallModelFunctionAnalyticsDetails } from './analytics.details';

// MARK: JSON Schema
/**
 * Reference to a type that can produce a JSON Schema representation.
 *
 * Compatible with ArkType's Type.toJsonSchema() and any other schema library.
 * The optional `options` parameter allows callers to pass configuration (e.g.,
 * ArkType's fallback handlers for predicates that can't be represented in JSON Schema).
 */
export interface JsonSchemaRef {
  toJsonSchema(options?: object): object;
}

// MARK: MCP Types
/**
 * A natural language summary of an MCP tool operation result.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-firebase-server:mcp
 */
export type McpToolResponseSummary = string;

// MARK: MCP Response Content
/**
 * Minimal structural type for MCP tool response content.
 *
 * Mirrors the shape of MCP SDK's CallToolResult without importing the SDK directly,
 * so api.details.ts remains dependency-free.
 */
export interface McpToolResponseContent {
  readonly content: ReadonlyArray<McpToolResponseContentBlock>;
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

/**
 * A single content block in an MCP tool response.
 */
export interface McpToolResponseContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly mimeType?: string;
  readonly data?: string;
}

// MARK: MCP Visibility
/**
 * Minimal dispatch coordinates surfaced to a dynamic visibility predicate so a
 * shared function can branch by tool identity.
 *
 * Structurally satisfied by the MCP tool generator's `McpToolDispatchTarget`.
 */
export interface McpToolVisibilityDispatchTarget {
  readonly call: string;
  readonly modelType: string;
  readonly specifier?: string;
}

/**
 * Declarative visibility rule. Evaluated per-request without invoking user code.
 */
export interface McpVisibilityRule {
  /**
   * Caller must hold every role listed (AND-semantics). Empty array is vacuously true.
   */
  readonly requiredRoles?: ReadonlyArray<AuthRole>;
  /**
   * When true, the caller must be authenticated (`ctx.auth != null`).
   */
  readonly requireAuthenticated?: boolean;
}

/**
 * Context passed to the dynamic visibility function form.
 */
export interface McpVisibilityContext {
  /**
   * The authenticated caller, when present. `undefined` for anonymous callers.
   */
  readonly auth?: FirebaseServerAuthData;
  /**
   * The caller's OIDC scopes, when the request was authenticated with a `scope`-bearing token.
   * `undefined` for non-OIDC callers — treated the same as `oidcCallModelScopePreAssert` bypass.
   */
  readonly scopes?: ReadonlySet<string>;
  /**
   * Dispatch identity of the tool being evaluated. Lets a shared predicate branch by tool.
   */
  readonly tool: McpToolVisibilityDispatchTarget;
}

/**
 * Per-handler MCP visibility, evaluated cheap-to-expensive at request time.
 *
 * - `boolean`: `true` means "always visible (subject to scope)"; `false` means "never visible".
 * - {@link McpVisibilityRule}: declarative check (role / auth gate), no user code invoked.
 * - Function: synchronous predicate invoked per request. MUST be synchronous — async checks
 *   introduce unbounded `tools/list` latency. If the function throws, the framework treats the
 *   result as `false` (fail-closed) and logs a warning.
 *
 * `visibility: true` does NOT bypass the OIDC scope filter — scope is the absolute first gate
 * and `visibility` only narrows further.
 */
export type McpToolVisibility = boolean | McpVisibilityRule | ((context: McpVisibilityContext) => boolean);

// MARK: MCP Tool Details Builder
/**
 * Input passed to a {@link McpToolDetailsBuilder}.
 *
 * `defaultDescription` and `defaultInputSchema` reflect the framework's boot-time resolved
 * values (manifest entry if present, otherwise the auto-generated defaults). Builders can
 * return them verbatim, mutate a copy, or replace them entirely.
 *
 * `auth` and `scopes` come from the same per-request context the MCP visibility predicate
 * sees. `undefined` for anonymous / non-OIDC callers.
 */
export interface McpToolDetailsBuilderInput {
  readonly dispatch: McpToolVisibilityDispatchTarget;
  readonly defaultDescription: string;
  readonly defaultInputSchema?: object;
  readonly auth?: FirebaseServerAuthData;
  readonly scopes?: ReadonlySet<string>;
}

/**
 * Builder output. Either field can be omitted to keep the framework default;
 * returning an empty object is a no-op.
 */
export interface McpToolDetailsBuilderResult {
  readonly description?: string;
  readonly inputSchema?: object;
}

/**
 * Synchronous builder invoked once per `tools/list` request, after the visibility filter
 * has accepted the tool.
 *
 * MUST be synchronous — async work would introduce unbounded `tools/list` latency, matching
 * the visibility-predicate constraint.
 *
 * If the builder throws, the framework falls back to the defaults and logs a warning
 * (fail-soft).
 */
export type McpToolDetailsBuilder = (input: McpToolDetailsBuilderInput) => McpToolDetailsBuilderResult;

// MARK: Handler-Level API Details
/**
 * MCP-specific customization for a model function.
 *
 * When omitted, defaults are auto-generated from the handler's position in the call model tree.
 *
 * Response formatting uses a tiered system:
 * - **Tier 1 (default)**: Auto-generated summary from the result shape. No config needed.
 * - **Tier 2**: Provide {@link summarizeResponse} to return a natural language string. The framework wraps it into MCP content + structuredContent automatically.
 * - **Tier 3**: Provide {@link formatResponse} for complete control over the MCP response content blocks.
 *
 * Resolution order: formatResponse > summarizeResponse > auto-generated default.
 */
export interface OnCallModelFunctionMcpDetails {
  /**
   * Custom tool name override.
   */
  readonly name?: string;
  /**
   * Tier 2 response formatter: returns a natural language summary string.
   *
   * The framework wraps the string into a text content block and attaches the raw result
   * as structuredContent automatically.
   *
   * @param result - The handler's return value.
   * @param params - The OnCallTypedModelParams that were dispatched.
   * @returns A human-readable summary of the operation result.
   */
  readonly summarizeResponse?: (result: unknown, params: OnCallTypedModelParams) => McpToolResponseSummary;
  /**
   * Tier 3 response formatter: complete control over the MCP tool response.
   *
   * When provided, takes precedence over {@link summarizeResponse} and the auto-generated default.
   *
   * @param result - The handler's return value.
   * @param params - The OnCallTypedModelParams that were dispatched.
   * @returns The full MCP tool response content.
   */
  readonly formatResponse?: (result: unknown, params: OnCallTypedModelParams) => McpToolResponseContent;
  /**
   * Controls whether this handler's tool is advertised on `tools/list` for a given request.
   *
   * See {@link McpToolVisibility} for the three accepted forms. Always applied after the
   * OIDC scope filter and the module-level `readOnly` check.
   */
  readonly visibility?: McpToolVisibility;
  /**
   * Explicit override for the effective read-only classification of this handler.
   *
   * When unset, the framework infers from the call type: `read` and `query` → true,
   * `create`/`update`/`delete` → false, anything else → undefined (treated as a write
   * for fail-safe filtering when `McpModuleConfig.readOnly` is on).
   */
  readonly readOnly?: boolean;
  /**
   * Optional per-request builder that produces enriched tool description / inputSchema
   * for `tools/list`. See {@link McpToolDetailsBuilder}.
   *
   * Tools without a builder reuse a precomputed wire entry, so this opt-in only adds
   * overhead to the handlers that need it.
   */
  readonly toolDetails?: McpToolDetailsBuilder;
}

/**
 * API details metadata for a single model call handler function.
 *
 * Carries schema info (input/output types) and MCP-specific customization.
 * Attached to handler functions via withApiDetails().
 */
export interface OnCallModelFunctionApiDetails {
  /**
   * The input parameter type. Must implement toJsonSchema() for MCP tool input schema generation.
   */
  readonly inputType?: JsonSchemaRef;
  /**
   * The output result type. Optional — many handlers return void or generic results.
   */
  readonly outputType?: JsonSchemaRef;
  /**
   * MCP-specific customization. Auto-generated if omitted.
   */
  readonly mcp?: OnCallModelFunctionMcpDetails;
  /**
   * Analytics lifecycle configuration for this handler.
   * When provided, the dispatch chain will call lifecycle hooks around handler execution.
   */
  readonly analytics?: OnCallModelFunctionAnalyticsDetails;
}

/**
 * Ref interface for objects (functions) that carry handler-level _apiDetails.
 */
export interface OnCallModelFunctionApiDetailsRef {
  readonly _apiDetails?: OnCallModelFunctionApiDetails;
}

// MARK: Aggregated API Details
/**
 * API details aggregated at the specifier level.
 *
 * Produced by onCallSpecifierHandler when its handlers carry _apiDetails.
 * Maps specifier keys (e.g., '_', 'username', 'fromUpload') to handler-level details.
 */
export interface OnCallModelTypeApiDetails {
  readonly isSpecifier: boolean;
  readonly specifiers: { readonly [key: string]: OnCallModelFunctionApiDetails | undefined };
}

/**
 * API details aggregated at the CRUD model level.
 *
 * Produced by onCallCreateModel/onCallReadModel/etc.
 * Maps model type strings (e.g., 'profile', 'guestbook') to specifier-level details.
 * Direct (non-specifier) handlers are wrapped with `isSpecifier: false` and their
 * details placed under the `_` key.
 */
export interface OnCallCrudModelApiDetails {
  readonly modelTypes: { readonly [key: string]: OnCallModelTypeApiDetails | undefined };
}

/**
 * API details aggregated at the top call model level.
 *
 * Produced by onCallModel. Maps CRUD operation strings to their model-level details.
 */
export interface OnCallModelApiDetails {
  readonly create?: OnCallCrudModelApiDetails;
  readonly read?: OnCallCrudModelApiDetails;
  readonly update?: OnCallCrudModelApiDetails;
  readonly delete?: OnCallCrudModelApiDetails;
  readonly [call: string]: OnCallCrudModelApiDetails | undefined;
}

/**
 * Union of all API details types at any aggregation level.
 */
export type OnCallApiDetails = OnCallModelFunctionApiDetails | OnCallModelTypeApiDetails | OnCallCrudModelApiDetails | OnCallModelApiDetails;

/**
 * Ref interface for functions at any level of the call model tree.
 */
export interface OnCallApiDetailsRef {
  readonly _apiDetails?: OnCallApiDetails;
}

// MARK: Type Guards
/**
 * Whether the details are specifier-level (has specifiers map).
 *
 * @param details - The API details to check.
 * @returns True if the details contain a specifiers map.
 */
export function isOnCallModelTypeApiDetails(details: OnCallApiDetails): details is OnCallModelTypeApiDetails {
  return details != null && 'specifiers' in details;
}

/**
 * Whether the details are CRUD-model-level (has modelTypes map).
 *
 * @param details - The API details to check.
 * @returns True if the details contain a modelTypes map.
 */
export function isOnCallCrudModelApiDetails(details: OnCallApiDetails): details is OnCallCrudModelApiDetails {
  return details != null && 'modelTypes' in details;
}

/**
 * Whether the details are handler-level (leaf node — no specifiers or modelTypes).
 *
 * @param details - The API details to check.
 * @returns True if the details are handler-level (no specifiers or modelTypes).
 */
export function isOnCallHandlerApiDetails(details: OnCallApiDetails): details is OnCallModelFunctionApiDetails {
  return details != null && !('specifiers' in details) && !('modelTypes' in details);
}

/**
 * Whether the specifier-level details represent a true specifier (multiple sub-operations)
 * vs a wrapped direct handler (`isSpecifier: false`, details under `_`).
 *
 * @param details - The specifier-level API details to check.
 * @returns True if the details represent a true specifier with multiple sub-operations.
 */
export function isActualSpecifier(details: OnCallModelTypeApiDetails): boolean {
  return details.isSpecifier;
}

// MARK: Wrapper
/**
 * Configuration for withApiDetails().
 *
 * Combines API metadata, auth configuration, and the handler function into a single config object.
 */
export interface WithApiDetailsConfig<F extends (...args: any[]) => any> extends OnCallModelFunctionApiDetails {
  /**
   * When true, marks the handler as not requiring auth (equivalent to optionalAuthContext).
   * Sets `_requireAuth = false` on the function, allowing it to be called without auth data.
   *
   * This replaces the need to compose withApiDetails + optionalAuthContext separately,
   * which would lose _apiDetails since optionalAuthContext creates a new wrapper function.
   */
  readonly optionalAuth?: boolean;
  /**
   * Optional analytics lifecycle configuration for this handler.
   * When provided, the dispatch chain will call lifecycle hooks around handler execution.
   *
   * The request type and return type are inferred from the `fn` parameter, providing
   * full type safety in lifecycle callbacks.
   */
  readonly analytics?: OnCallModelFunctionAnalyticsDetails<Parameters<F>[0], Awaited<ReturnType<F>>>;
  /**
   * The handler function.
   */
  readonly fn: F;
}

/**
 * Attaches API details metadata to a handler function.
 *
 * The handler function is provided in the config object alongside its metadata.
 * The function is returned unchanged but with the _apiDetails property set.
 * Compatible with all handler types (create, read, update, delete, specifier).
 *
 * When `optionalAuth: true` is set, also marks the function as not requiring auth
 * (same effect as optionalAuthContext). This avoids the composition issue where
 * optionalAuthContext(withApiDetails(...)) would lose the _apiDetails.
 *
 * @param config - The API details configuration including the handler function.
 * @returns The handler function with _apiDetails attached.
 *
 * @example
 * ```typescript
 * // Handler with api details (auth required by default)
 * export const createGuestbook: DemoCreateModelFunction<CreateGuestbookParams> = withApiDetails({
 *   inputType: createGuestbookParamsType,
 *   fn: async (request) => {
 *     const { nest, auth, data } = request;
 *     const result = await nest.guestbookActions.createGuestbook(data);
 *     return onCallCreateModelResultWithDocs(await result());
 *   }
 * });
 *
 * // Handler with optional auth
 * export const profileCreate: DemoCreateModelFunction<{}> = withApiDetails({
 *   optionalAuth: true,
 *   fn: async (request) => { ... }
 * });
 * ```
 */
export function withApiDetails<F extends (...args: any[]) => any>(config: WithApiDetailsConfig<F>): F & OnCallModelFunctionApiDetailsRef {
  const { optionalAuth, fn, ...apiDetails } = config;
  (fn as Configurable<OnCallModelFunctionApiDetailsRef>)._apiDetails = apiDetails;

  if (optionalAuth) {
    (fn as Configurable<OnCallModelFunctionApiDetailsRef & { _requireAuth?: boolean }>)._requireAuth = false;
  }

  return fn as F & OnCallModelFunctionApiDetailsRef;
}

// MARK: Aggregation Utilities
/**
 * Reads _apiDetails from a function if present.
 *
 * @param fn - The function or object that may carry _apiDetails.
 * @returns The API details if present, otherwise undefined.
 */
export function readApiDetails(fn: Maybe<OnCallApiDetailsRef>): Maybe<OnCallApiDetails> {
  return fn?._apiDetails;
}

/**
 * Aggregates _apiDetails from a specifier handler config object.
 *
 * Returns OnCallModelTypeApiDetails if any handlers have _apiDetails, otherwise undefined.
 *
 * @param config - Map of specifier keys to handler functions.
 * @returns Aggregated specifier-level API details, or undefined if no handlers have _apiDetails.
 */
export function aggregateSpecifierApiDetails(config: { readonly [key: string]: Maybe<OnCallApiDetailsRef> }): Maybe<OnCallModelTypeApiDetails> {
  const specifiers: { [key: string]: OnCallModelFunctionApiDetails | undefined } = {};
  let hasAny = false;

  for (const [key, handler] of Object.entries(config)) {
    const details = readApiDetails(handler);

    if (details != null) {
      // At the specifier level, details should be handler-level (OnCallModelFunctionApiDetails)
      specifiers[key] = details as OnCallModelFunctionApiDetails;
      hasAny = true;
    }
  }

  return hasAny ? { isSpecifier: true, specifiers } : undefined;
}

/**
 * Aggregates _apiDetails from a model type map (used by onCallCreateModel, etc.).
 *
 * Returns OnCallCrudModelApiDetails if any handlers have _apiDetails, otherwise undefined.
 *
 * @param map - Map of model type strings to handler functions.
 * @returns Aggregated CRUD-model-level API details, or undefined if no handlers have _apiDetails.
 */
export function aggregateCrudModelApiDetails(map: { readonly [key: string]: Maybe<OnCallApiDetailsRef> }): Maybe<OnCallCrudModelApiDetails> {
  const modelTypes: { [key: string]: OnCallModelTypeApiDetails | undefined } = {};
  let hasAny = false;

  for (const [key, handler] of Object.entries(map)) {
    const details = readApiDetails(handler);

    if (details != null) {
      if (isOnCallModelTypeApiDetails(details)) {
        // Already specifier-level details
        modelTypes[key] = details;
      } else {
        // Wrap direct handler details as a non-specifier with `_` key
        modelTypes[key] = { isSpecifier: false, specifiers: { _: details as OnCallModelFunctionApiDetails } };
      }

      hasAny = true;
    }
  }

  return hasAny ? { modelTypes } : undefined;
}

/**
 * Aggregates _apiDetails from the top-level call model map.
 *
 * Returns OnCallModelApiDetails if any CRUD handlers have _apiDetails, otherwise undefined.
 *
 * @param map - Map of call type strings to CRUD handler functions.
 * @returns Aggregated model-level API details, or undefined if no handlers have _apiDetails.
 */
export function aggregateModelApiDetails(map: { readonly [key: string]: Maybe<OnCallApiDetailsRef> }): Maybe<OnCallModelApiDetails> {
  const result: { [call: string]: OnCallCrudModelApiDetails | undefined } = {};
  let hasAny = false;

  for (const [call, handler] of Object.entries(map)) {
    const details = readApiDetails(handler);

    if (details != null) {
      result[call] = details as OnCallCrudModelApiDetails;
      hasAny = true;
    }
  }

  return hasAny ? result : undefined;
}

// MARK: Model-First View
/**
 * API details for a single CRUD call on a model type.
 *
 * Always {@link OnCallModelTypeApiDetails} — direct handlers are wrapped with
 * `isSpecifier: false` and their details placed under the `_` key.
 */
export type ModelCallApiDetails = OnCallModelTypeApiDetails;

/**
 * CRUD calls available for a single model type.
 *
 * Keyed by call type ('create', 'read', 'update', 'delete').
 * Each value is specifier-level details (direct handlers wrapped with `isSpecifier: false`).
 */
export interface ModelCallsApiDetails {
  readonly create?: ModelCallApiDetails;
  readonly read?: ModelCallApiDetails;
  readonly update?: ModelCallApiDetails;
  readonly delete?: ModelCallApiDetails;
  readonly [call: string]: ModelCallApiDetails | undefined;
}

/**
 * API details organized by model type first, then by CRUD call type.
 *
 * This is the consumer-friendly view of the call model tree — models are the top-level
 * grouping, with their available CRUD operations nested underneath.
 *
 * @example
 * ```typescript
 * const details = getModelApiDetails(callModelFn);
 * const storageFileGroupCalls = details.models['storageFileGroup'].calls;
 * // => { update: { specifiers: { _: {...}, regenerateContent: {...} } } }
 * ```
 */
export interface ModelApiDetailsResult {
  readonly models: { readonly [modelType: string]: ModelApiDetailsModelEntry };
}

/**
 * API details for a single model type.
 */
export interface ModelApiDetailsModelEntry {
  /**
   * The CRUD calls available for this model type.
   */
  readonly calls: ModelCallsApiDetails;
}

/**
 * Extracts and pivots API details from a call model function into a model-first view.
 *
 * The internal aggregation tree is organized as CRUD → modelType. This function
 * pivots it to modelType → CRUD, which is the natural shape for MCP tool generation
 * and schema introspection.
 *
 * @param callModelFn - The function returned by onCallModel(), or any object with _apiDetails.
 * @returns Model-first API details, or undefined if no _apiDetails are present.
 *
 * @example
 * ```typescript
 * const details = getModelApiDetails(demoCallModel);
 * // details.models['guestbook'].calls.create => { inputType: createGuestbookParamsType }
 * // details.models['profile'].calls.update => { specifiers: { _: {...}, username: {...} } }
 * ```
 */
export function getModelApiDetails(callModelFn: Maybe<OnCallApiDetailsRef>): Maybe<ModelApiDetailsResult> {
  const topDetails = readApiDetails(callModelFn) as Maybe<OnCallModelApiDetails>;
  let result: Maybe<ModelApiDetailsResult>;

  if (topDetails != null) {
    const models: { [modelType: string]: { calls: { [call: string]: ModelCallApiDetails | undefined } } } = {};

    // Pivot: iterate CRUD types, then model types within each
    for (const [callType, crudDetails] of Object.entries(topDetails)) {
      if (crudDetails == null) {
        continue;
      }

      for (const [modelType, modelDetails] of Object.entries(crudDetails.modelTypes)) {
        if (modelDetails == null) {
          continue;
        }

        if (!(modelType in models)) {
          models[modelType] = { calls: {} };
        }

        models[modelType].calls[callType] = modelDetails;
      }
    }

    if (Object.keys(models).length > 0) {
      result = { models };
    }
  }

  return result;
}

// MARK: Analytics Resolution
/**
 * Resolves leaf-level analytics details from the aggregated _apiDetails tree.
 *
 * Walks: call -> modelType -> specifier (if specifier-level), then reads the `analytics`
 * field from the handler-level {@link OnCallModelFunctionApiDetails}.
 *
 * @param apiDetails - The top-level aggregated API details.
 * @param call - The CRUD operation type to look up.
 * @param modelType - The Firestore model type to look up.
 * @param specifier - Optional specifier key for variant handlers.
 * @returns The analytics details for the resolved handler, or undefined.
 */
// eslint-disable-next-line @typescript-eslint/max-params
export function resolveAnalyticsFromApiDetails(apiDetails: OnCallModelApiDetails, call: OnCallFunctionType, modelType: FirestoreModelType, specifier?: ModelFirebaseCrudFunctionSpecifier): Maybe<OnCallModelFunctionAnalyticsDetails> {
  const modelDetails = apiDetails[call]?.modelTypes[modelType];
  let result: Maybe<OnCallModelFunctionAnalyticsDetails>;

  if (modelDetails) {
    // All entries are now OnCallModelTypeApiDetails. For non-specifier handlers,
    // the details are under the `_` key.
    const key = specifier ?? '_';
    result = modelDetails.specifiers[key]?.analytics;
  }

  return result;
}

// MARK: Compat
// COMPAT: Deprecated aliases
/**
 * @deprecated Use {@link OnCallModelTypeApiDetails} instead.
 */
export type OnCallSpecifierApiDetails = OnCallModelTypeApiDetails;

/**
 * @deprecated Use {@link isOnCallModelTypeApiDetails} instead.
 */
export const isOnCallSpecifierApiDetails = isOnCallModelTypeApiDetails;
