import { type Configurable, type Maybe } from '@dereekb/util';
import { type OnCallFunctionType, type FirestoreModelType, type ModelFirebaseCrudFunctionSpecifier } from '@dereekb/firebase';
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

// MARK: Handler-Level API Details
/**
 * MCP-specific customization for a model function.
 *
 * When omitted, defaults are auto-generated from the handler's position in the call model tree.
 */
export interface OnCallModelFunctionMcpDetails {
  /**
   * Custom tool description for the MCP tool.
   */
  readonly description?: string;
  /**
   * Custom tool name override.
   */
  readonly name?: string;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 *
 * @param config - The API details configuration including the handler function.
 * @returns The handler function with _apiDetails attached.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return hasAny ? (result as OnCallModelApiDetails) : undefined;
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
 * @param callModelFn The function returned by onCallModel(), or any object with _apiDetails.
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

  if (topDetails == null) {
    return undefined;
  }

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

  return Object.keys(models).length > 0 ? { models } : undefined;
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

  if (modelDetails) {
    // All entries are now OnCallModelTypeApiDetails. For non-specifier handlers,
    // the details are under the `_` key.
    const key = specifier ?? '_';
    return modelDetails.specifiers[key]?.analytics;
  }

  return undefined;
}

// MARK: Compat
/**
 * @deprecated Use {@link OnCallModelTypeApiDetails} instead.
 */
export type OnCallSpecifierApiDetails = OnCallModelTypeApiDetails;

/**
 * @deprecated Use {@link isOnCallModelTypeApiDetails} instead.
 */
export const isOnCallSpecifierApiDetails = isOnCallModelTypeApiDetails;
