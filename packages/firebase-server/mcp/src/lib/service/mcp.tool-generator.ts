import { type Maybe } from '@dereekb/util';
import { type Type } from 'arktype';
import { arktypeToJsonSchemaForExport } from '@dereekb/model';
import { type ModelApiDetailsResult, type ModelCallApiDetails, type OnCallModelFunctionApiDetails, type FirebaseServerAuthData, type McpToolDetailsBuilder } from '@dereekb/firebase-server';
import { type Request } from 'express';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { mcpManifestKey, type McpManifestToolEntry } from './mcp.manifest';
import { classifyVisibility, resolveEffectiveReadOnly, resolveRequiredScope, type McpToolFilterMetadata } from './mcp.visibility';

/**
 * Frozen wire-shape entry returned on `tools/list`.
 *
 * Built once at boot per tool and reused for every request when no
 * {@link McpToolDefinition.toolDetailsBuilder} is configured. Tools that opt in
 * to dynamic details produce a fresh wire entry per request.
 */
export interface McpToolListEntry {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: object;
  readonly outputSchema?: object;
}

/**
 * A single MCP tool definition generated from one (modelType, callType, specifier) triple.
 */
export interface McpToolDefinition {
  /**
   * Tool name advertised on `tools/list`.
   *
   * Format: `<modelType>-<callType>` for default (`_`) specifiers,
   * `<modelType>-<callType>-<specifier>` for non-default specifiers.
   *
   * @example 'guestbook-create'
   * @example 'profile-update-username'
   * @example 'storageFile-invoke-recomputeChecksums'
   */
  readonly name: string;
  /**
   * Human-readable description surfaced to MCP clients.
   *
   * Resolved from the build-time MCP manifest entry when present; otherwise auto-generated.
   */
  readonly description: string;
  /**
   * JSON Schema for the tool input.
   *
   * Resolved in order: manifest entry's `inputSchema` (when a manifest is supplied) > handler's
   * `inputType.toJsonSchema()` > `undefined`. `undefined` means the tool is skipped during
   * registration; the gap is logged so it's visible.
   */
  readonly inputSchema?: object;
  /**
   * JSON Schema for the tool output, when the manifest provides one. The wire `tools/list`
   * response only includes this when the pinned MCP SDK type allows it.
   */
  readonly outputSchema?: object;
  /**
   * The original handler-level API details. Carries response formatters, analytics
   * config, etc. — the controller resolves Tier 1/2/3 response shape from this.
   *
   * `undefined` for statically-registered tools that don't go through the callModel chain.
   */
  readonly details?: OnCallModelFunctionApiDetails;
  /**
   * The dispatch coordinates extracted from the position in the call model tree.
   * The controller uses these to build the `OnCallTypedModelParams` envelope at call time.
   *
   * For statically-registered tools the coordinates are synthetic (they identify the tool to
   * dynamic visibility predicates) but {@link staticHandler} runs instead of the callModel chain.
   */
  readonly dispatch: McpToolDispatchTarget;
  /**
   * When present, the per-request controller calls this handler directly instead of going
   * through the callModel dispatch chain. Used for built-in MCP tools (e.g. `model-get`) that
   * read from the Firebase model surface without a corresponding `callModel` handler.
   */
  readonly staticHandler?: McpStaticToolHandler;
  /**
   * Precomputed boot-time filter metadata consumed by the per-request `tools/list` filter.
   */
  readonly filterMetadata: McpToolFilterMetadata;
  /**
   * The frozen `tools/list` wire entry for this tool, computed once at boot from the
   * static description / inputSchema / outputSchema. The factory returns this verbatim
   * when {@link toolDetailsBuilder} is `undefined`, avoiding a per-request allocation.
   */
  readonly staticWireEntry: McpToolListEntry;
  /**
   * The handler's per-request builder, hoisted from `details.mcp.toolDetails` once at
   * boot so the request hot path doesn't dereference through the details tree.
   *
   * `undefined` for tools that did not opt in (the common case) and for statically
   * registered tools.
   */
  readonly toolDetailsBuilder?: McpToolDetailsBuilder;
}

/**
 * Per-request handler for a statically-registered MCP tool.
 *
 * Receives the raw tool arguments and the MCP request context (auth + raw request); returns the
 * MCP `CallToolResult` envelope verbatim. The factory wraps the call in a try/catch so handlers
 * may surface user-visible errors by throwing.
 */
export type McpStaticToolHandler = (args: Record<string, unknown>, ctx: McpStaticToolHandlerContext) => Promise<CallToolResult>;

/**
 * Request-scoped context passed to {@link McpStaticToolHandler} implementations.
 *
 * Identical in shape to `McpRequestContext` but redeclared here so the tool generator does not
 * depend on the server factory module (the dependency goes the other way).
 */
export interface McpStaticToolHandlerContext {
  readonly auth?: FirebaseServerAuthData;
  readonly rawRequest: Request;
}

/**
 * The (call, modelType, specifier) coordinate that resolves a generated MCP tool
 * back to a single dispatch target on the underlying callModel chain.
 */
export interface McpToolDispatchTarget {
  readonly call: string;
  readonly modelType: string;
  /**
   * `undefined` when the handler isn't behind a specifier (default `_` entry on a
   * non-specifier model type).
   */
  readonly specifier?: string;
}

/**
 * Options forwarded to {@link JsonSchemaRef.toJsonSchema}.
 *
 * Wraps the ArkType-specific fallback handlers so consumers can opt out of the
 * default predicate / `undefinedAsClearable` behavior if their schema lib needs
 * different options.
 */
export interface JsonSchemaGenerationOptions {
  readonly [option: string]: unknown;
}

/**
 * Default `toJsonSchema()` options.
 *
 * ArkType throws on predicate definitions and on `undefined` fields by default;
 * these fallback handlers downgrade those errors so a partial schema is emitted
 * for tools that mostly fit JSON Schema. The `unit` fallback covers `clearable(t)`
 * from `@dereekb/model` (which expands to `t | undefined` and surfaces as an ArkType
 * `unit: undefined` schema node).
 */
export const DEFAULT_JSON_SCHEMA_GENERATION_OPTIONS: JsonSchemaGenerationOptions = {
  fallback: {
    predicate: () => ({}),
    unit: () => ({}),
    undefinedAsClearable: () => ({})
  }
};

/**
 * Reason a tool was skipped during generation.
 */
export type McpToolGenerationSkipReason = 'missing_input_type' | 'schema_generation_failed';

/**
 * One tool that was skipped during generation.
 */
export interface McpToolGenerationSkip {
  readonly toolName: string;
  readonly reason: McpToolGenerationSkipReason;
  readonly dispatch: McpToolDispatchTarget;
  readonly error?: Error;
}

/**
 * Aggregated output of {@link generateMcpToolDefinitions}.
 */
export interface McpToolGenerationResult {
  /**
   * Tools that may be visible on `tools/list`, subject to the per-request filter.
   * Excludes anything classified as `'never'` visible at boot.
   */
  readonly tools: ReadonlyArray<McpToolDefinition>;
  /**
   * Tools whose `visibility` was classified as `'never'` at boot.
   * Partitioned out so the per-request loop never touches them.
   */
  readonly neverVisibleTools: ReadonlyArray<McpToolDefinition>;
  /**
   * Tools that could not be generated (no inputType, or `toJsonSchema()` threw).
   * Surfaced so the caller can log them at startup.
   */
  readonly skipped: ReadonlyArray<McpToolGenerationSkip>;
}

// MARK: Wire Entry
interface BuildStaticWireEntryInput {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly outputSchema?: object;
}

/**
 * Builds the frozen wire-shape entry used by the per-request `tools/list` hot path.
 *
 * Tools without an `inputSchema` default to `{ type: 'object' }` to match the runtime
 * behaviour the factory used before the precompute optimisation existed.
 */
export function buildStaticWireEntry(input: BuildStaticWireEntryInput): McpToolListEntry {
  const inputSchema = input.inputSchema ?? { type: 'object' };
  const entry: McpToolListEntry = input.outputSchema != null ? { name: input.name, description: input.description, inputSchema, outputSchema: input.outputSchema } : { name: input.name, description: input.description, inputSchema };
  return Object.freeze(entry);
}

// MARK: Naming
/**
 * The default specifier key used when a handler is not behind a specifier router.
 */
export const DEFAULT_SPECIFIER_KEY = '_';

/**
 * Builds the MCP tool name for a (modelType, callType, specifier) triple.
 *
 * Apps can override the auto-generated name by setting
 * {@link OnCallModelFunctionApiDetails.mcp.name} on the handler.
 *
 * @param modelType - The Firestore model type (e.g., `storageFile`).
 * @param callType - The call type (e.g., `invoke`).
 * @param specifier - The specifier key, or `_` / undefined for the default entry.
 */
export function buildMcpToolName(modelType: string, callType: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === DEFAULT_SPECIFIER_KEY;
  return isDefault ? `${modelType}-${callType}` : `${modelType}-${callType}-${specifier}`;
}

/**
 * Builds the default description used when no build-time MCP manifest
 * entry is available for the (modelType, callType, specifier) tuple.
 */
export function buildDefaultMcpToolDescription(modelType: string, callType: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === DEFAULT_SPECIFIER_KEY;
  return isDefault ? `Performs the "${callType}" call on the "${modelType}" model.` : `Performs the "${callType}" call on the "${modelType}" model with the "${specifier}" specifier.`;
}

// MARK: Generation
/**
 * Generates MCP tool definitions from a model-first API details tree.
 *
 * Walks each (modelType, callType, specifier) triple in the tree, calls
 * `inputType.toJsonSchema(options)` for the schema, and applies any handler-level
 * MCP `name` override. Descriptions and input/output schemas are pulled from the
 * build-time manifest when supplied. Tools without an `inputType` are skipped and
 * reported so callers can log the gap at startup.
 *
 * @param apiDetails - The model-first API details tree returned by `getModelApiDetails(callModelFn)`.
 * @param options - Optional schema generation options forwarded to `toJsonSchema()`. Defaults to {@link DEFAULT_JSON_SCHEMA_GENERATION_OPTIONS}.
 * @returns The list of generated tool definitions plus any skip reports.
 */
export function generateMcpToolDefinitions(apiDetails: ModelApiDetailsResult, options: JsonSchemaGenerationOptions = DEFAULT_JSON_SCHEMA_GENERATION_OPTIONS, manifest?: ReadonlyMap<string, McpManifestToolEntry>): McpToolGenerationResult {
  const tools: McpToolDefinition[] = [];
  const neverVisibleTools: McpToolDefinition[] = [];
  const skipped: McpToolGenerationSkip[] = [];

  for (const [modelType, modelEntry] of Object.entries(apiDetails.models)) {
    for (const [callType, callDetails] of Object.entries(modelEntry.calls)) {
      if (callDetails == null) {
        continue;
      }

      generateToolsForModelCall({ modelType, callType, callDetails, options, manifest, outTools: tools, outNeverVisibleTools: neverVisibleTools, outSkipped: skipped });
    }
  }

  return { tools, neverVisibleTools, skipped };
}

interface GenerateToolsForModelCallContext {
  readonly modelType: string;
  readonly callType: string;
  readonly callDetails: ModelCallApiDetails;
  readonly options: JsonSchemaGenerationOptions;
  readonly manifest?: ReadonlyMap<string, McpManifestToolEntry>;
  readonly outTools: McpToolDefinition[];
  readonly outNeverVisibleTools: McpToolDefinition[];
  readonly outSkipped: McpToolGenerationSkip[];
}

function generateToolsForModelCall(context: GenerateToolsForModelCallContext): void {
  for (const [specifierKey, handlerDetails] of Object.entries(context.callDetails.specifiers)) {
    if (handlerDetails != null) {
      generateToolForSpecifier(context, specifierKey, handlerDetails);
    }
  }
}

function generateToolForSpecifier(context: GenerateToolsForModelCallContext, specifierKey: string, handlerDetails: OnCallModelFunctionApiDetails): void {
  const { modelType, callType, callDetails, options, manifest, outTools, outNeverVisibleTools, outSkipped } = context;
  const specifier = callDetails.isSpecifier ? specifierKey : undefined;
  const dispatch: McpToolDispatchTarget = { call: callType, modelType, specifier };

  const name = handlerDetails.mcp?.name ?? buildMcpToolName(modelType, callType, specifier);
  const manifestEntry = manifest?.get(mcpManifestKey(modelType, callType, specifier));
  const description = manifestEntry?.description ?? buildDefaultMcpToolDescription(modelType, callType, specifier);

  const inputSchema = resolveInputSchema({ handlerDetails, manifestEntry, options, dispatch, toolName: name, outSkipped });

  if (inputSchema == null) {
    return;
  }

  const classified = classifyVisibility(handlerDetails.mcp?.visibility);
  const filterMetadata: McpToolFilterMetadata = {
    requiredScope: resolveRequiredScope(callType) ?? undefined,
    visibilityKind: classified.visibilityKind,
    rule: classified.rule,
    visibilityFn: classified.visibilityFn,
    effectiveReadOnly: resolveEffectiveReadOnly(handlerDetails.mcp?.readOnly, callType)
  };

  const outputSchema = manifestEntry?.outputSchema;
  const staticWireEntry = buildStaticWireEntry({ name, description, inputSchema, outputSchema });
  const definition: McpToolDefinition = {
    name,
    description,
    inputSchema,
    outputSchema,
    details: handlerDetails,
    dispatch,
    filterMetadata,
    staticWireEntry,
    toolDetailsBuilder: handlerDetails.mcp?.toolDetails
  };

  if (filterMetadata.visibilityKind === 'never') {
    outNeverVisibleTools.push(definition);
  } else {
    outTools.push(definition);
  }
}

interface ResolveInputSchemaContext {
  readonly handlerDetails: OnCallModelFunctionApiDetails;
  readonly manifestEntry: Maybe<McpManifestToolEntry>;
  readonly options: JsonSchemaGenerationOptions;
  readonly dispatch: McpToolDispatchTarget;
  readonly toolName: string;
  readonly outSkipped: McpToolGenerationSkip[];
}

function resolveInputSchema(context: ResolveInputSchemaContext): object | undefined {
  const { handlerDetails, manifestEntry, options, dispatch, toolName, outSkipped } = context;

  if (manifestEntry?.inputSchema != null) {
    return manifestEntry.inputSchema;
  }

  if (handlerDetails.inputType == null) {
    outSkipped.push({ toolName, reason: 'missing_input_type', dispatch });
    return undefined;
  }

  try {
    const exported = arktypeToJsonSchemaForExport(handlerDetails.inputType as unknown as Type<unknown>);

    if (exported && typeof exported === 'object') {
      return exported as object;
    }

    // arktypeToJsonSchemaForExport returned a non-object (shouldn't happen for object schemas).
    // Fall back to the raw arktype output preserving the legacy options for safety.
    return handlerDetails.inputType.toJsonSchema(options);
  } catch (error) {
    outSkipped.push({ toolName, reason: 'schema_generation_failed', dispatch, error: error as Error });
    return undefined;
  }
}
