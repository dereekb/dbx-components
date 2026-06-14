import { type Maybe } from '@dereekb/util';
import { type KnownOnCallFunctionType } from '@dereekb/firebase';
import { type Type } from 'arktype';
import { arktypeToJsonSchemaForExport } from '@dereekb/model';
import { type ModelApiDetailsResult, type OnCallModelFunctionApiDetails, type FirebaseServerAuthData, type McpToolDetailsBuilder } from '@dereekb/firebase-server';
import { type Request } from 'express';
import { type CallToolResult, type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { mcpManifestKey, type McpManifestToolEntry } from './mcp.manifest';
import { classifyVisibility, resolveEffectiveReadOnly, resolveMcpToolAnnotations, resolveRequiredScope, type McpToolFilterMetadata } from './mcp.visibility';

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
  /**
   * Standard MCP read/write hints (`readOnlyHint`, `destructiveHint`) advertised to clients so a
   * tool's mutating behaviour is machine-readable. Resolved at boot from the effective read-only
   * classification; see {@link resolveMcpToolAnnotations}.
   */
  readonly annotations?: ToolAnnotations;
}

/**
 * A single MCP tool definition generated from one (modelType, callType, specifier) triple.
 */
export interface McpToolDefinition {
  /**
   * Tool name advertised on `tools/list`.
   *
   * Format: `<modelSegment>-<callType>` for default (`_`) specifiers; named specifiers drop the
   * call-type segment (`<modelSegment>-<specifier>`) to stay short. When two visible tools would
   * resolve to the same name, both are disambiguated with the abbreviated call type
   * (`<modelSegment>-<abbrev>-<specifier>`); see {@link buildDisambiguatedMcpToolName}.
   *
   * @example 'guestbook-create'
   * @example 'profile-username'
   * @example 'profile-u-username'
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
   * Standard MCP read/write hints for this tool, mirrored onto {@link staticWireEntry} and the
   * dynamic wire path so opt-in `toolDetails` handlers keep their annotations. Resolved at boot
   * from the effective read-only classification; see {@link resolveMcpToolAnnotations}.
   */
  readonly annotations?: ToolAnnotations;
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
 *
 * - `missing_input_type` — the handler has no `inputType` to build a schema from.
 * - `schema_generation_failed` — `toJsonSchema()` threw for the handler's `inputType`.
 * - `name_too_long` — the resolved name exceeds {@link MCP_TOOL_NAME_MAX_LENGTH}; advertising it
 *   would make remote clients reject the whole `tools/list` payload, so it is dropped.
 * - `duplicate_name` — another already-registered visible tool resolved to the same name (e.g. two
 *   specifiers collide once the call-type segment is dropped); the later tool is dropped.
 */
export type McpToolGenerationSkipReason = 'missing_input_type' | 'schema_generation_failed' | 'name_too_long' | 'duplicate_name';

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
 * Reason a generated tool's handler and build-time manifest disagree about MCP result mapping.
 *
 * - `mapper_without_mapped_manifest` — the handler declares `mcp.mapSuccessfulResult` but the
 *   manifest entry was not built from a mapped result type, i.e. the `.api.ts` leaf is missing its
 *   `@dbxModelApiMcpResult <TypeName>` annotation, so the advertised output schema describes the raw
 *   (un-mapped) result.
 * - `mapped_manifest_without_mapper` — the manifest entry is annotated for a mapped result but the
 *   handler no longer declares `mapSuccessfulResult` (stale annotation).
 *
 * Both are runtime↔manifest consistency checks the build-time manifest renderer cannot perform on
 * its own (it has the `.api.ts` annotation but not the handler's wired `mapSuccessfulResult`), so the
 * runtime keeps them. Purely build-time-detectable conditions are deliberately *not* warned here to
 * keep the server boot quiet:
 * - Name length over the soft limit is surfaced by the manifest renderer, not at runtime (the hard
 *   cap is still enforced as a `name_too_long` skip).
 * - A preferred name that collided with another visible tool is re-derived with the abbreviated call
 *   type ({@link buildDisambiguatedMcpToolName}) **silently** at runtime; the manifest renderer flags it.
 */
export type McpToolGenerationWarningReason = 'mapper_without_mapped_manifest' | 'mapped_manifest_without_mapper';

/**
 * One generated tool whose handler / manifest MCP-result mapping is inconsistent. The tool is still
 * generated; the warning is surfaced so the caller can log the drift at startup.
 */
export interface McpToolGenerationWarning {
  readonly toolName: string;
  readonly reason: McpToolGenerationWarningReason;
  readonly dispatch: McpToolDispatchTarget;
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
  /**
   * Generated tools whose handler / manifest MCP-result mapping is inconsistent (only computed when a
   * manifest is supplied). Surfaced so the caller can log the drift at startup.
   */
  readonly warnings: ReadonlyArray<McpToolGenerationWarning>;
}

// MARK: Wire Entry
interface BuildStaticWireEntryInput {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly outputSchema?: object;
  readonly annotations?: ToolAnnotations;
}

/**
 * Builds the frozen wire-shape entry used by the per-request `tools/list` hot path.
 *
 * Tools without an `inputSchema` default to `{ type: 'object' }` to match the runtime
 * behaviour the factory used before the precompute optimisation existed.
 *
 * @param input - The tool name, description, and optional input/output schemas used to assemble the wire entry.
 * @returns A frozen wire entry safe to share across requests.
 */
export function buildStaticWireEntry(input: BuildStaticWireEntryInput): McpToolListEntry {
  const inputSchema = input.inputSchema ?? { type: 'object' };
  const entry: { name: string; description: string; inputSchema: object; outputSchema?: object; annotations?: ToolAnnotations } = { name: input.name, description: input.description, inputSchema };

  if (input.outputSchema != null) {
    entry.outputSchema = input.outputSchema;
  }

  if (input.annotations != null) {
    entry.annotations = input.annotations;
  }

  return Object.freeze(entry);
}

/**
 * Description prefix prepended to a mutating tool's description so MCP clients that don't render
 * {@link ToolAnnotations} still surface the write signal in plain text.
 */
export const MCP_WRITE_TOOL_DESCRIPTION_PREFIX = '[WRITE] ';

/**
 * Prepends {@link MCP_WRITE_TOOL_DESCRIPTION_PREFIX} to a description when its annotations mark the
 * tool as a write (`readOnlyHint === false`). Read-only tools are returned unchanged.
 *
 * @param description - The base tool description.
 * @param annotations - The resolved MCP annotations for the tool.
 * @returns The description, prefixed with the write marker when the tool mutates.
 */
export function applyWriteMarker(description: string, annotations: ToolAnnotations): string {
  return annotations.readOnlyHint === false ? `${MCP_WRITE_TOOL_DESCRIPTION_PREFIX}${description}` : description;
}

// MARK: Naming
/**
 * The default specifier key used when a handler is not behind a specifier router.
 */
export const DEFAULT_SPECIFIER_KEY = '_';

/**
 * Soft limit for an MCP tool name. Names longer than this still register, but the generator
 * surfaces a `name_length_warning` so the drift toward the hard cap is visible at boot / build.
 */
export const MCP_TOOL_NAME_WARN_LENGTH = 55;

/**
 * Hard limit for an MCP tool name. Remote MCP clients reject a `tools/list` payload that contains
 * any tool whose `name` exceeds this (`FrontendRemoteMcpToolDefinition.name: String should have at
 * most 64 characters`), which fails the whole connection. Names over this are not registered.
 */
export const MCP_TOOL_NAME_MAX_LENGTH = 64;

/**
 * Severity of a tool name's length relative to {@link MCP_TOOL_NAME_WARN_LENGTH} /
 * {@link MCP_TOOL_NAME_MAX_LENGTH}.
 *
 * - `error` — over the hard cap; the tool must not be advertised.
 * - `warn` — over the soft limit but within the hard cap; advertised, but flagged.
 * - `ok` — within the soft limit.
 */
export type McpToolNameLengthLevel = 'ok' | 'warn' | 'error';

/**
 * The outcome of validating a tool name's length.
 */
export interface McpToolNameValidation {
  readonly name: string;
  readonly length: number;
  readonly level: McpToolNameLengthLevel;
}

/**
 * Classifies a tool name's length against the soft/hard MCP name-length limits.
 *
 * Shared by the runtime generator and the build-time manifest renderer so both apply the
 * same thresholds and never drift.
 *
 * @param name - The fully-resolved tool name (including any per-handler override).
 * @returns The length classification — `error` over {@link MCP_TOOL_NAME_MAX_LENGTH}, `warn` over
 *   {@link MCP_TOOL_NAME_WARN_LENGTH}, otherwise `ok`.
 *
 * @example
 * ```ts
 * validateMcpToolName('worker-create'); // { name: 'worker-create', length: 13, level: 'ok' }
 * ```
 */
export function validateMcpToolName(name: string): McpToolNameValidation {
  const length = name.length;
  let level: McpToolNameLengthLevel = 'ok';

  if (length > MCP_TOOL_NAME_MAX_LENGTH) {
    level = 'error';
  } else if (length > MCP_TOOL_NAME_WARN_LENGTH) {
    level = 'warn';
  }

  return { name, length, level };
}

/**
 * Builds the MCP tool name for a (modelSegment, callType, specifier) triple.
 *
 * The call-type segment is only emitted for the default (`_`) specifier, where it carries the
 * meaning (`worker-create`, `worker-update`). Named specifiers drop it — the specifier already
 * disambiguates (`worker-syncCheckHqEmployee`), which keeps names short and within the MCP
 * 64-character cap. Apps can override the whole name per handler via
 * {@link OnCallModelFunctionApiDetails.mcp.name}.
 *
 * This is the preferred (short) form. When two visible tools collide on it — two call types share a
 * specifier once the call-type segment is dropped — the generator re-derives both names with
 * {@link buildDisambiguatedMcpToolName} instead.
 *
 * @param modelSegment - The model segment of the name. Defaults to the model type, but may be a
 *   shorter per-model override (e.g. the collection prefix) resolved by the caller.
 * @param callType - The call type (e.g., `invoke`).
 * @param specifier - The specifier key, or `_` / undefined for the default entry.
 * @returns The hyphen-joined tool name advertised on `tools/list`.
 *
 * @example
 * ```ts
 * buildMcpToolName('worker', 'create'); // 'worker-create'
 * buildMcpToolName('worker', 'update', 'syncCheckHqEmployee'); // 'worker-syncCheckHqEmployee'
 * ```
 */
export function buildMcpToolName(modelSegment: string, callType: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === DEFAULT_SPECIFIER_KEY;
  return isDefault ? `${modelSegment}-${callType}` : `${modelSegment}-${specifier}`;
}

/**
 * Single-character abbreviations for the standard CRUDQ + invoke call types, used to disambiguate
 * colliding tool names without re-introducing the full call-type segment everywhere.
 *
 * @example
 * ```ts
 * MCP_CALL_TYPE_ABBREVIATIONS.update; // 'u'
 * ```
 */
export const MCP_CALL_TYPE_ABBREVIATIONS: Readonly<Record<KnownOnCallFunctionType, string>> = {
  create: 'c',
  read: 'r',
  update: 'u',
  delete: 'd',
  query: 'q',
  invoke: 'i'
};

/**
 * Abbreviates a call type for use in a disambiguated tool name. Known CRUDQ + invoke types collapse
 * to a single character; a custom call type is returned unchanged so the name stays unambiguous.
 *
 * @param callType - The call type / verb.
 * @returns The single-character abbreviation, or the original string for a custom call type.
 *
 * @example
 * ```ts
 * abbreviateMcpCallType('update'); // 'u'
 * abbreviateMcpCallType('recompute'); // 'recompute'
 * ```
 */
export function abbreviateMcpCallType(callType: string): string {
  return MCP_CALL_TYPE_ABBREVIATIONS[callType as KnownOnCallFunctionType] ?? callType;
}

/**
 * Builds the disambiguated MCP tool name for a (modelSegment, callType, specifier) triple — the form
 * used only when the preferred {@link buildMcpToolName} output collides with another visible tool.
 *
 * Named specifiers re-insert the call type, abbreviated, between the segment and specifier
 * (`worker-u-syncCheckHqEmployee`); since the two colliding tools differ only by call type, their
 * abbreviations differ and the names no longer clash. Default (`_`) specifiers already carry the
 * full call type, so they are returned in their {@link buildMcpToolName} form unchanged.
 *
 * @param modelSegment - The model segment of the name (model type, or a per-model override).
 * @param callType - The call type / verb.
 * @param specifier - The specifier key, or `_` / undefined for the default entry.
 * @returns The hyphen-joined disambiguated tool name.
 *
 * @example
 * ```ts
 * buildDisambiguatedMcpToolName('worker', 'update', 'syncCheckHqEmployee'); // 'worker-u-syncCheckHqEmployee'
 * buildDisambiguatedMcpToolName('worker', 'create'); // 'worker-create'
 * ```
 */
export function buildDisambiguatedMcpToolName(modelSegment: string, callType: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === DEFAULT_SPECIFIER_KEY;
  return isDefault ? `${modelSegment}-${callType}` : `${modelSegment}-${abbreviateMcpCallType(callType)}-${specifier}`;
}

/**
 * Builds the default description used when no build-time MCP manifest
 * entry is available for the (modelType, callType, specifier) tuple.
 *
 * @param modelType - The Firestore model type segment used in the generated description.
 * @param callType - The call type segment used in the generated description.
 * @param specifier - The specifier segment, or `_` / undefined for the default entry.
 * @returns A human-readable fallback description for the tool.
 */
export function buildDefaultMcpToolDescription(modelType: string, callType: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === DEFAULT_SPECIFIER_KEY;
  return isDefault ? `Performs the "${callType}" call on the "${modelType}" model.` : `Performs the "${callType}" call on the "${modelType}" model with the "${specifier}" specifier.`;
}

// MARK: Generation
/**
 * Optional naming inputs for {@link generateMcpToolDefinitions}.
 */
export interface McpToolGenerationNamingOptions {
  /**
   * Per-model override of the tool-name model segment, keyed by model type. When a model type is
   * present, its segment (e.g. the collection prefix) replaces the model type in generated names;
   * otherwise the model type is used.
   */
  readonly modelSegments?: ReadonlyMap<string, string>;
}

/**
 * Optional build-time context for {@link generateMcpToolDefinitions}. Grouped into one object so the
 * function stays at three parameters and new build-time inputs extend it rather than the arg list.
 */
export interface GenerateMcpToolDefinitionsContext {
  /**
   * Build-time manifest map supplying overrides for descriptions and input/output schemas, keyed by
   * {@link mcpManifestKey}.
   */
  readonly manifest?: ReadonlyMap<string, McpManifestToolEntry>;
  /**
   * Per-model name segment overrides (e.g. collection prefixes).
   */
  readonly naming?: McpToolGenerationNamingOptions;
}

/**
 * Generates MCP tool definitions from a model-first API details tree.
 *
 * Walks each (modelType, callType, specifier) triple in the tree, calls
 * `inputType.toJsonSchema(options)` for the schema, and applies any handler-level
 * MCP `name` override. Descriptions and input/output schemas are pulled from the
 * build-time manifest when supplied. Tools without an `inputType` are skipped and
 * reported so callers can log the gap at startup. Tools whose resolved name exceeds
 * {@link MCP_TOOL_NAME_MAX_LENGTH} are skipped so the advertised `tools/list` stays valid.
 *
 * Generation runs in two passes so a name clash is known before any name is finalized: the first
 * pass plans every candidate and counts how many visible auto-named tools share each preferred name;
 * the second builds each tool, re-deriving the colliding ones with the abbreviated call type
 * ({@link buildDisambiguatedMcpToolName}) so both survive instead of one shadowing the other. A
 * residual collision that disambiguation cannot resolve (e.g. an `mcp.name` override matching an auto
 * name) drops the later tool so the dispatch map stays unambiguous.
 *
 * @param apiDetails - The model-first API details tree returned by `getModelApiDetails(callModelFn)`.
 * @param options - Optional schema generation options forwarded to `toJsonSchema()`. Defaults to {@link DEFAULT_JSON_SCHEMA_GENERATION_OPTIONS}.
 * @param context - Optional build-time context (manifest overrides + per-model name segments).
 * @returns The list of generated tool definitions plus any skip reports.
 */
export function generateMcpToolDefinitions(apiDetails: ModelApiDetailsResult, options: JsonSchemaGenerationOptions = DEFAULT_JSON_SCHEMA_GENERATION_OPTIONS, context?: GenerateMcpToolDefinitionsContext): McpToolGenerationResult {
  const tools: McpToolDefinition[] = [];
  const neverVisibleTools: McpToolDefinition[] = [];
  const skipped: McpToolGenerationSkip[] = [];
  const warnings: McpToolGenerationWarning[] = [];
  const seenNames = new Set<string>();
  const manifest = context?.manifest;
  const naming = context?.naming;

  const candidates = planMcpToolCandidates(apiDetails, naming);
  const clashCounts = countVisibleAutoNameClashes(candidates);

  for (const candidate of candidates) {
    buildToolFromCandidate({ candidate, clashCounts, options, manifest, seenNames, outTools: tools, outNeverVisibleTools: neverVisibleTools, outSkipped: skipped, outWarnings: warnings });
  }

  return { tools, neverVisibleTools, skipped, warnings };
}

/**
 * One planned tool, captured in the first (cheap) generation pass before schema generation. Holds
 * everything needed to count name clashes and, in the second pass, build the definition without
 * re-classifying visibility.
 */
interface McpToolCandidate {
  readonly modelType: string;
  readonly callType: string;
  readonly handlerDetails: OnCallModelFunctionApiDetails;
  readonly specifier: string | undefined;
  readonly dispatch: McpToolDispatchTarget;
  readonly modelSegment: string;
  /**
   * The per-handler `mcp.name` override, if any. Overridden names do not participate in
   * auto-disambiguation (the app chose them explicitly).
   */
  readonly overrideName: Maybe<string>;
  /**
   * The preferred (short) name — the override, or {@link buildMcpToolName}.
   */
  readonly baseName: string;
  readonly classified: ReturnType<typeof classifyVisibility>;
  readonly isVisible: boolean;
}

/**
 * First pass: walk the API tree and plan one {@link McpToolCandidate} per handler. No schema
 * generation happens here — only the cheap naming + visibility classification needed to detect
 * clashes before any name is finalized.
 *
 * @param apiDetails - The model-first API details tree.
 * @param naming - Optional per-model name-segment overrides.
 * @returns One candidate per non-null handler, in tree order.
 */
function planMcpToolCandidates(apiDetails: ModelApiDetailsResult, naming?: McpToolGenerationNamingOptions): McpToolCandidate[] {
  const candidates: McpToolCandidate[] = [];

  for (const [modelType, modelEntry] of Object.entries(apiDetails.models)) {
    for (const [callType, callDetails] of Object.entries(modelEntry.calls)) {
      if (callDetails == null) {
        continue;
      }

      for (const [specifierKey, handlerDetails] of Object.entries(callDetails.specifiers)) {
        if (handlerDetails == null) {
          continue;
        }

        const specifier = callDetails.isSpecifier ? specifierKey : undefined;
        const dispatch: McpToolDispatchTarget = { call: callType, modelType, specifier };
        const modelSegment = naming?.modelSegments?.get(modelType) ?? modelType;
        const overrideName = handlerDetails.mcp?.name;
        const baseName = overrideName ?? buildMcpToolName(modelSegment, callType, specifier);
        const classified = classifyVisibility(handlerDetails.mcp?.visibility);
        const isVisible = classified.visibilityKind !== 'never';

        candidates.push({ modelType, callType, handlerDetails, specifier, dispatch, modelSegment, overrideName, baseName, classified, isVisible });
      }
    }
  }

  return candidates;
}

/**
 * Counts how many visible, auto-named (no `mcp.name` override) candidates share each preferred name.
 * Only these participate in clash detection — hidden tools never reach the wire, and overrides are
 * explicit. A base name with a count over 1 is a clash that the build pass disambiguates.
 *
 * @param candidates - The planned candidates from {@link planMcpToolCandidates}.
 * @returns A map of preferred name to the number of visible auto-named candidates producing it.
 */
function countVisibleAutoNameClashes(candidates: ReadonlyArray<McpToolCandidate>): Map<string, number> {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    if (candidate.isVisible && candidate.overrideName == null) {
      counts.set(candidate.baseName, (counts.get(candidate.baseName) ?? 0) + 1);
    }
  }

  return counts;
}

interface BuildToolFromCandidateContext {
  readonly candidate: McpToolCandidate;
  /**
   * Per-preferred-name clash counts from {@link countVisibleAutoNameClashes}.
   */
  readonly clashCounts: ReadonlyMap<string, number>;
  readonly options: JsonSchemaGenerationOptions;
  readonly manifest?: ReadonlyMap<string, McpManifestToolEntry>;
  /**
   * Names of already-registered visible tools, used to drop residual collisions. Mutated as tools
   * are registered across the whole generation pass.
   */
  readonly seenNames: Set<string>;
  readonly outTools: McpToolDefinition[];
  readonly outNeverVisibleTools: McpToolDefinition[];
  readonly outSkipped: McpToolGenerationSkip[];
  readonly outWarnings: McpToolGenerationWarning[];
}

/**
 * Second pass: turn one planned {@link McpToolCandidate} into a tool definition, resolving its final
 * name (disambiguating a clash with the abbreviated call type), generating its schema, and routing it
 * to the visible or never-visible bucket.
 *
 * @param context - The candidate plus the shared generation accumulators.
 */
function buildToolFromCandidate(context: BuildToolFromCandidateContext): void {
  const { candidate, clashCounts, options, manifest, seenNames, outTools, outNeverVisibleTools, outSkipped, outWarnings } = context;
  const { modelType, callType, handlerDetails, specifier, dispatch, modelSegment, overrideName, baseName, classified, isVisible } = candidate;

  // A visible auto-named tool whose preferred name is produced by more than one visible tool is
  // re-derived with the abbreviated call type so both survive on the wire. Overrides and hidden tools
  // keep their preferred name (overrides are explicit; hidden tools never reach the wire).
  const needsDisambiguation = isVisible && overrideName == null && (clashCounts.get(baseName) ?? 0) > 1;
  const name = needsDisambiguation ? buildDisambiguatedMcpToolName(modelSegment, callType, specifier) : baseName;
  const nameValidation = validateMcpToolName(name);

  // A name over the hard cap would make remote clients reject the whole tools/list payload — never advertise it.
  if (nameValidation.level === 'error') {
    outSkipped.push({ toolName: name, reason: 'name_too_long', dispatch });
    return;
  }

  const manifestEntry = manifest?.get(mcpManifestKey(modelType, callType, specifier));
  const baseDescription = manifestEntry?.description ?? buildDefaultMcpToolDescription(modelType, callType, specifier);

  const inputSchema = resolveInputSchema({ handlerDetails, manifestEntry, options, dispatch, toolName: name, outSkipped });

  if (inputSchema == null) {
    return;
  }

  // Cross-check the handler's mapSuccessfulResult against the manifest's mapped-result signal. Only
  // meaningful when a manifest is supplied (it carries the `.api.ts` annotation outcome).
  if (manifest != null) {
    const hasMapper = handlerDetails.mcp?.mapSuccessfulResult != null;
    const manifestMapped = manifestEntry?.mcpResultTypeName != null;

    if (hasMapper && !manifestMapped) {
      outWarnings.push({ toolName: name, reason: 'mapper_without_mapped_manifest', dispatch });
    } else if (!hasMapper && manifestMapped) {
      outWarnings.push({ toolName: name, reason: 'mapped_manifest_without_mapper', dispatch });
    }
  }

  const requiredScope = resolveRequiredScope(callType) ?? undefined;
  const effectiveReadOnly = resolveEffectiveReadOnly(handlerDetails.mcp?.readOnly, callType);
  const annotations = resolveMcpToolAnnotations(effectiveReadOnly);
  const description = applyWriteMarker(baseDescription, annotations);
  let filterMetadata: McpToolFilterMetadata;

  if (classified.visibilityKind === 'declarative') {
    filterMetadata = { visibilityKind: 'declarative', rule: classified.rule, requiredScope, effectiveReadOnly };
  } else if (classified.visibilityKind === 'dynamic') {
    filterMetadata = { visibilityKind: 'dynamic', visibilityFn: classified.visibilityFn, requiredScope, effectiveReadOnly };
  } else {
    filterMetadata = { visibilityKind: classified.visibilityKind, requiredScope, effectiveReadOnly };
  }

  // Disambiguation has already separated the common dropped-call-type clash; this is the backstop for
  // a residual collision it cannot resolve (an `mcp.name` override matching an auto name, or two model
  // segments coinciding on the same call type) which would otherwise let one tool silently shadow the
  // other in the per-request name→definition map. Hidden tools never reach the map, so skip the check.
  if (isVisible) {
    if (seenNames.has(name)) {
      outSkipped.push({ toolName: name, reason: 'duplicate_name', dispatch });
      return;
    }

    seenNames.add(name);
  }

  const outputSchema = manifestEntry?.outputSchema;
  const staticWireEntry = buildStaticWireEntry({ name, description, inputSchema, outputSchema, annotations });
  const definition: McpToolDefinition = {
    name,
    description,
    inputSchema,
    outputSchema,
    annotations,
    details: handlerDetails,
    dispatch,
    filterMetadata,
    staticWireEntry,
    toolDetailsBuilder: handlerDetails.mcp?.toolDetails
  };

  if (isVisible) {
    outTools.push(definition);
  } else {
    outNeverVisibleTools.push(definition);
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

  let result: object | undefined;

  try {
    const exported = arktypeToJsonSchemaForExport(handlerDetails.inputType as unknown as Type<unknown>);

    if (exported && typeof exported === 'object') {
      result = exported;
    } else {
      // arktypeToJsonSchemaForExport returned a non-object (shouldn't happen for object schemas).
      // Fall back to the raw arktype output preserving the legacy options for safety.
      result = handlerDetails.inputType.toJsonSchema(options);
    }
  } catch (error) {
    outSkipped.push({ toolName, reason: 'schema_generation_failed', dispatch, error: error as Error });
    result = undefined;
  }

  return result;
}
