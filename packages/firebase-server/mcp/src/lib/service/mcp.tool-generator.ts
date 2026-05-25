import { type Maybe } from '@dereekb/util';
import { type ModelApiDetailsResult, type ModelCallApiDetails, type OnCallModelFunctionApiDetails } from '@dereekb/firebase-server';
import { mcpManifestKey, type McpManifestToolEntry } from './mcp.manifest';
import { classifyVisibility, resolveEffectiveReadOnly, resolveRequiredScope, type McpToolFilterMetadata } from './mcp.visibility';

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
   */
  readonly details: OnCallModelFunctionApiDetails;
  /**
   * The dispatch coordinates extracted from the position in the call model tree.
   * The controller uses these to build the `OnCallTypedModelParams` envelope at call time.
   */
  readonly dispatch: McpToolDispatchTarget;
  /**
   * Precomputed boot-time filter metadata consumed by the per-request `tools/list` filter.
   */
  readonly filterMetadata: McpToolFilterMetadata;
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
  const { modelType, callType, callDetails, options, manifest, outTools, outNeverVisibleTools, outSkipped } = context;

  for (const [specifierKey, handlerDetails] of Object.entries(callDetails.specifiers)) {
    if (handlerDetails == null) {
      continue;
    }

    const dispatch: McpToolDispatchTarget = {
      call: callType,
      modelType,
      specifier: callDetails.isSpecifier ? specifierKey : undefined
    };

    const customName = handlerDetails.mcp?.name;
    const name = customName ?? buildMcpToolName(modelType, callType, callDetails.isSpecifier ? specifierKey : undefined);
    const manifestEntry = manifest?.get(mcpManifestKey(modelType, callType, callDetails.isSpecifier ? specifierKey : undefined));

    const description = manifestEntry?.description ?? buildDefaultMcpToolDescription(modelType, callType, callDetails.isSpecifier ? specifierKey : undefined);

    let inputSchema: object | undefined = manifestEntry?.inputSchema;

    if (inputSchema == null) {
      if (handlerDetails.inputType) {
        try {
          inputSchema = handlerDetails.inputType.toJsonSchema(options);
        } catch (error) {
          outSkipped.push({ toolName: name, reason: 'schema_generation_failed', dispatch, error: error as Error });
          continue;
        }
      } else {
        outSkipped.push({ toolName: name, reason: 'missing_input_type', dispatch });
        continue;
      }
    }

    const classified = classifyVisibility(handlerDetails.mcp?.visibility);
    const filterMetadata: McpToolFilterMetadata = {
      requiredScope: resolveRequiredScope(callType) ?? undefined,
      visibilityKind: classified.visibilityKind,
      rule: classified.rule,
      visibilityFn: classified.visibilityFn,
      effectiveReadOnly: resolveEffectiveReadOnly(handlerDetails.mcp?.readOnly, callType)
    };

    const definition: McpToolDefinition = { name, description, inputSchema, outputSchema: manifestEntry?.outputSchema, details: handlerDetails, dispatch, filterMetadata };

    if (filterMetadata.visibilityKind === 'never') {
      outNeverVisibleTools.push(definition);
    } else {
      outTools.push(definition);
    }
  }
}
