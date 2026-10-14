import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type OidcScopeTerm } from '@dereekb/firebase';
import { type McpVisibilityRule } from '@dereekb/firebase-server';
import { arktypeToJsonSchemaForExport } from '@dereekb/model';
import { type Type } from 'arktype';
import { type CallToolResult } from '@modelcontextprotocol/server';
import { type McpAdditionalTool, type McpAdditionalToolExpose, type McpAdditionalTools, type McpCompactToolKey, type McpCompactToolNames } from '../mcp.config';
import { mcpManifestKey } from './mcp.manifest';
import { buildMcpMethodRegistry, mcpMethodIdForDispatch, mcpMethodSummary, type McpMethodRegistry, type McpMethodRegistryInputEntry, type McpMethodSummary, type McpMethodToolSelector } from './mcp.method';
import { formatMcpToolResponse } from './mcp.response-formatter';
import { buildStaticToolDefinition, MCP_TOOL_NAME_MAX_LENGTH, validateMcpToolName, type McpStaticToolHandlerContext, type McpToolDefinition } from './mcp.tool-generator';

// MARK: Names
/**
 * Maximum length of a compact tool-name prefix. `search_<prefix>_documentation` is the longest compact name and must stay
 * within {@link MCP_TOOL_NAME_MAX_LENGTH}.
 */
export const MCP_TOOL_NAME_PREFIX_MAX_LENGTH = 43;

/**
 * Valid MCP tool name pattern.
 */
export const MCP_TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * `_meta` key that asks Claude Code to load a tool upfront instead of deferring it behind tool search.
 */
export const MCP_ALWAYS_LOAD_META_KEY = 'anthropic/alwaysLoad';

/**
 * Every compact tool key, in listing order.
 */
export const MCP_COMPACT_TOOL_KEYS: readonly McpCompactToolKey[] = ['search', 'details', 'read', 'write', 'destructive', 'token', 'documentation'];

/**
 * Derives the compact tool-name prefix from a server name.
 *
 * Lowercases, replaces runs of non-alphanumerics with `_`, trims leading/trailing `_`, then strips a trailing `_mcp`
 * and a trailing `_api`, so `demo-api-mcp` names its tools `demo_api_search` rather than `demo_api_api_search`.
 *
 * @param serverName - The base server name (never the ` (read-only)`-suffixed form).
 * @returns The prefix.
 * @throws {Error} When nothing is left after stripping.
 *
 * @example
 * ```ts
 * resolveMcpToolNamePrefix('demo-api-mcp'); // 'demo'
 * ```
 */
export function resolveMcpToolNamePrefix(serverName: string): string {
  let prefix = serverName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');

  if (prefix.endsWith('_mcp')) {
    prefix = prefix.slice(0, -4);
  }

  if (prefix.endsWith('_api')) {
    prefix = prefix.slice(0, -4);
  }

  if (prefix.length === 0) {
    throw new Error(`Cannot derive an MCP tool name prefix from server name "${serverName}". Set McpModuleConfig.toolNamePrefix.`);
  }

  return prefix;
}

/**
 * Input for {@link resolveMcpCompactToolNames}.
 */
export interface ResolveMcpCompactToolNamesInput {
  readonly prefix: string;
  readonly names?: Maybe<Partial<Record<McpCompactToolKey, string>>>;
}

/**
 * Resolves and validates the compact tool names.
 *
 * @param input - The prefix and optional per-tool overrides.
 * @returns The resolved names.
 * @throws {Error} When the prefix or any resolved name is invalid. A silently dropped compact tool must never happen.
 */
export function resolveMcpCompactToolNames(input: ResolveMcpCompactToolNamesInput): McpCompactToolNames {
  const { prefix, names } = input;

  if (prefix.length > MCP_TOOL_NAME_PREFIX_MAX_LENGTH || !MCP_TOOL_NAME_PATTERN.test(prefix)) {
    throw new Error(`Invalid MCP tool name prefix "${prefix}": it must match ${MCP_TOOL_NAME_PATTERN.source} and be at most ${MCP_TOOL_NAME_PREFIX_MAX_LENGTH} characters.`);
  }

  const resolved: McpCompactToolNames = {
    search: names?.search ?? `${prefix}_api_search`,
    details: names?.details ?? `${prefix}_api_details`,
    read: names?.read ?? `${prefix}_api_read`,
    write: names?.write ?? `${prefix}_api_write`,
    destructive: names?.destructive ?? `${prefix}_api_destructive`,
    token: names?.token ?? `${prefix}_cli_token`,
    documentation: names?.documentation ?? `search_${prefix}_documentation`
  };

  const seen = new Set<string>();

  for (const key of MCP_COMPACT_TOOL_KEYS) {
    const name = resolved[key];

    if (!MCP_TOOL_NAME_PATTERN.test(name) || validateMcpToolName(name).level === 'error') {
      throw new Error(`Invalid compact MCP tool name "${name}" for "${key}": it must match ${MCP_TOOL_NAME_PATTERN.source} (max ${MCP_TOOL_NAME_MAX_LENGTH} characters).`);
    }

    if (seen.has(name)) {
      throw new Error(`Compact MCP tool name "${name}" is used by more than one compact tool.`);
    }

    seen.add(name);
  }

  return resolved;
}

// MARK: Input Schemas
/**
 * Input schema for the compact `search` tool.
 */
export const MCP_COMPACT_SEARCH_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    query: { type: 'string', description: "One to three keywords, not a sentence, e.g. 'create worker' or 'update status'. May be empty when `model` or `kind` is set to list the matching methods." },
    model: { type: 'string', description: 'Optional model type to restrict results to, e.g. `worker`.' },
    kind: { type: 'string', enum: ['read', 'write', 'destructive'], description: 'Optional method kind filter. `destructive` also matches a method that a param can make destructive.' },
    limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum results (default 8).' }
  },
  required: ['query']
});

/**
 * Input schema for the compact `details` tool.
 */
export const MCP_COMPACT_DETAILS_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    method: { type: 'string', description: 'A method id (or alias) returned by search, e.g. `worker.create`.' }
  },
  required: ['method']
});

/**
 * Input schema for the compact `read` / `write` router tools.
 */
export const MCP_COMPACT_ROUTER_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    method: { type: 'string', description: 'The method id, e.g. `worker.create`.' },
    params: { type: 'object', description: "The method's parameters, matching the input schema from details.", additionalProperties: true }
  },
  required: ['method']
});

// MARK: Instructions
/**
 * Claude Code truncates server instructions and tool descriptions at this many characters.
 */
export const MCP_CLIENT_TEXT_MAX_LENGTH = 2048;

/**
 * Input for {@link buildMcpCompactInstructions}.
 */
export interface BuildMcpCompactInstructionsInput {
  /**
   * The app label, usually the tool-name prefix.
   */
  readonly app: string;
  readonly names: McpCompactToolNames;
  /**
   * The built-in read method ids available, e.g. `model-get`.
   */
  readonly builtinReadMethods: readonly string[];
  readonly hasDocumentation: boolean;
  readonly hasToken: boolean;
  readonly methodToolsListed: boolean;
  /**
   * Whether the module runs in `readOnly` mode, where only the `read` router is listed.
   */
  readonly readOnly?: boolean;
}

/**
 * Builds the compact usage block appended to the server instructions.
 *
 * @param input - The resolved names and which optional tools exist.
 * @returns The usage block.
 */
export function buildMcpCompactInstructions(input: BuildMcpCompactInstructionsInput): string {
  const { app, names, builtinReadMethods, hasDocumentation, hasToken, methodToolsListed, readOnly } = input;
  const callStep =
    readOnly === true
      ? `3) Call it with \`${names.read}\`, passing \`{ method, params }\`.`
      : `3) Call it with \`${names.read}\` (read-only methods), \`${names.write}\` (methods that add or change data) or \`${names.destructive}\` (methods that delete or overwrite data, or send real messages), passing \`{ method, params }\`; \`${names.details}\` says which, and which params make a call destructive.`;
  const parts = [`Use these tools to work with the ${app} API. 1) \`${names.search}\` finds API methods by keywords, not sentences ('reopen timesheet', 'create worker'). 2) \`${names.details}\` returns a method's parameter schema. ${callStep} Method ids look like \`worker.update.schedule\` (model.call.specifier).`];

  if (builtinReadMethods.length > 0) {
    const quoted = builtinReadMethods.map((x) => `\`${x}\``).join(', ');
    parts.push(`Built-in read methods: ${quoted}.`);
  }

  if (hasDocumentation) {
    parts.push(`\`${names.documentation}\` searches the ${app} docs.`);
  }

  if (hasToken) {
    parts.push(`\`${names.token}\` mints a short-lived CLI credential.`);
  }

  if (methodToolsListed) {
    parts.push('Per-method tools are also listed.');
  }

  return parts.join(' ');
}

// MARK: Surface Plan
/**
 * Input for {@link planMcpToolSurface}.
 */
export interface PlanMcpToolSurfaceInput {
  readonly compact: boolean;
  readonly methodTools: Maybe<boolean | McpMethodToolSelector>;
  /**
   * Resolved compact names. Reserved on the wire when {@link compact} is on.
   */
  readonly compactNames: McpCompactToolNames;
  readonly generated: readonly McpToolDefinition[];
  /**
   * Built-in method tools (every built-in except the token tool), in legacy order.
   */
  readonly builtins: readonly McpToolDefinition[];
  readonly token?: Maybe<McpToolDefinition>;
  /**
   * The standalone documentation search tool, when docs are on.
   */
  readonly documentation?: Maybe<McpToolDefinition>;
  readonly additional?: Maybe<McpAdditionalTools>;
  /**
   * The request-scoped batch tool name, reserved when a storage service is wired.
   */
  readonly batchName?: Maybe<string>;
}

/**
 * Boot-time plan of the advertised surface.
 */
export interface McpToolSurfacePlan {
  /**
   * Every method candidate filtered per request: generated, built-ins, then additional `method` / `both` tools.
   */
  readonly methodCandidates: readonly McpToolDefinition[];
  /**
   * Tools listed on their own regardless of methods: the token tool, the documentation search tool, and additional
   * `tool` tools.
   */
  readonly standaloneTools: readonly McpToolDefinition[];
  readonly registry: McpMethodRegistry;
  /**
   * Method candidates also listed as their own tools.
   */
  readonly promoted: ReadonlySet<McpToolDefinition>;
  /**
   * Listed tools that carry the `anthropic/alwaysLoad` hint.
   */
  readonly alwaysLoad: ReadonlySet<McpToolDefinition>;
  /**
   * Whether the request-scoped batch tool is listed as its own tool.
   */
  readonly batchPromoted: boolean;
  /**
   * Error lines for dropped tools and names, logged once at boot.
   */
  readonly errors: readonly string[];
  /**
   * Warning lines (collisions, unknown selector entries), logged once at boot.
   */
  readonly warnings: readonly string[];
}

/**
 * Plans the advertised tool surface once at boot.
 *
 * Wire-name precedence: reserved compact names (compact mode) > generated > built-ins > the token and documentation tools
 * (legacy mode) > batch > additional. A method whose wire name is already taken stays a method but is not promoted. An additional tool
 * whose name is invalid or collides with any method id, alias, or wire name is dropped.
 *
 * @param input - The tool sources and mode.
 * @returns The surface plan.
 */
export function planMcpToolSurface(input: PlanMcpToolSurfaceInput): McpToolSurfacePlan {
  const { compact, methodTools, compactNames, generated, builtins, token, documentation, batchName } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  const { methods: additionalMethods, tools: additionalTools } = partitionMcpAdditionalTools({ input, errors });

  const registryEntries: McpMethodRegistryInputEntry[] = [...generated.map((definition) => ({ definition, source: 'callModel' as const })), ...builtins.map((definition) => ({ definition, source: 'builtin' as const })), ...additionalMethods.map((x) => ({ definition: x.definition, source: 'additional' as const }))];
  const registry = buildMcpMethodRegistry(registryEntries);
  warnings.push(...registry.warnings);

  const isSelected = resolveMcpMethodToolPredicate({ methodTools, registry, batchName, warnings });
  const selectorMarksAlwaysLoad = methodTools != null && typeof methodTools !== 'boolean';

  // Claim wire names in precedence order.
  const wireNames = new Set<string>(compact ? MCP_COMPACT_TOOL_KEYS.map((key) => compactNames[key]) : []);
  const promoted = new Set<McpToolDefinition>();
  const alwaysLoad = new Set<McpToolDefinition>();
  const additionalBoth = new Set(additionalMethods.filter((x) => x.expose === 'both').map((x) => x.definition));

  for (const method of registry.methods) {
    const definition = method.definition;
    const isBoth = additionalBoth.has(definition);

    if (!isBoth && !isSelected(mcpMethodSummary(method))) {
      continue;
    }

    if (wireNames.has(definition.name)) {
      warnings.push(method.source === 'builtin' && !compact ? mcpStaticToolCollisionWarning(definition.name) : `MCP method "${method.id}" is not listed as its own tool: the name "${definition.name}" is already taken. It stays reachable as a method.`);
    } else {
      wireNames.add(definition.name);
      promoted.add(definition);

      if (isBoth || selectorMarksAlwaysLoad) {
        alwaysLoad.add(definition);
      }
    }
  }

  const standaloneTools: McpToolDefinition[] = [];

  if (token != null && !compact && wireNames.has(token.name)) {
    warnings.push(mcpStaticToolCollisionWarning(token.name));
  } else if (token != null) {
    wireNames.add(token.name);
    standaloneTools.push(token);
  }

  if (documentation != null && !compact && wireNames.has(documentation.name)) {
    warnings.push(mcpStaticToolCollisionWarning(documentation.name));
  } else if (documentation != null) {
    wireNames.add(documentation.name);
    standaloneTools.push(documentation);

    // compact mode already marks (and lets tools.meta override) every compact tool, documentation included
    if (!compact) {
      alwaysLoad.add(documentation);
    }
  }

  for (const additional of additionalTools) {
    standaloneTools.push(additional.definition);
    alwaysLoad.add(additional.definition);
  }

  const batchPromoted = batchName != null && isSelected({ id: batchName, aliases: [], kind: 'destructive', source: 'builtin' });
  const methodCandidates = registry.methods.map((x) => x.definition);

  return { methodCandidates, standaloneTools, registry, promoted, alwaysLoad, batchPromoted, errors, warnings };
}

/**
 * The legacy warning logged when a built-in tool name collides with a generated tool.
 *
 * @param name - The colliding tool name.
 * @returns The warning line.
 */
function mcpStaticToolCollisionWarning(name: string): string {
  return `Static MCP tool "${name}" collides with an auto-generated tool of the same name; the auto-generated tool will win.`;
}

/**
 * Validates the additional tools and splits them into method exposures (`method` / `both`) and tool-only exposures.
 *
 * @param config - The surface input and the error sink.
 * @param config.input - The surface plan input.
 * @param config.errors - Receives one line per dropped tool.
 * @returns The accepted method and tool exposures.
 */
function partitionMcpAdditionalTools(config: { readonly input: PlanMcpToolSurfaceInput; readonly errors: string[] }): { readonly methods: McpAdditionalTool[]; readonly tools: McpAdditionalTool[] } {
  const { input, errors } = config;
  const { compact, compactNames, generated, builtins, token, batchName } = input;

  // Every name a method or wire entry can answer to.
  const claimedNames = new Set<string>(builtins.map((x) => x.name));

  for (const definition of generated) {
    const { modelType, call, specifier } = definition.dispatch;
    claimedNames
      .add(definition.name)
      .add(mcpMethodIdForDispatch(definition.dispatch))
      .add(mcpManifestKey(modelType, call, specifier));
  }

  if (compact) {
    MCP_COMPACT_TOOL_KEYS.forEach((key) => claimedNames.add(compactNames[key]));
  }

  [token?.name, batchName].forEach((name) => name != null && claimedNames.add(name));

  const methods: McpAdditionalTool[] = [];
  const tools: McpAdditionalTool[] = [];

  for (const additional of input.additional ?? []) {
    const name = additional.definition.name;

    if (!MCP_TOOL_NAME_PATTERN.test(name)) {
      errors.push(`Dropped additional MCP tool "${name}": its name must match ${MCP_TOOL_NAME_PATTERN.source} (no dots).`);
    } else if (claimedNames.has(name)) {
      errors.push(`Dropped additional MCP tool "${name}": the name is already used by another tool or method.`);
    } else {
      claimedNames.add(name);
      (additional.expose === 'tool' ? tools : methods).push(additional);
    }
  }

  return { methods, tools };
}

/**
 * Resolves `tools.methodTools` into a predicate over method summaries. List entries are resolved against the
 * registry once; an unknown entry adds a warning.
 *
 * @param config - The selector, registry, batch name, and warning sink.
 * @param config.methodTools - The configured selector.
 * @param config.registry - The boot method registry.
 * @param config.batchName - The batch tool name, selectable by name.
 * @param config.warnings - Receives unknown-entry warnings.
 * @returns The predicate.
 */
function resolveMcpMethodToolPredicate(config: { readonly methodTools: Maybe<boolean | McpMethodToolSelector>; readonly registry: McpMethodRegistry; readonly batchName: Maybe<string>; readonly warnings: string[] }): (summary: McpMethodSummary) => boolean {
  const { methodTools, registry, batchName, warnings } = config;
  let result: (summary: McpMethodSummary) => boolean;

  if (typeof methodTools === 'function') {
    result = methodTools;
  } else if (Array.isArray(methodTools)) {
    const selectedIds = new Set<string>();

    for (const entry of methodTools as readonly string[]) {
      const id = registry.resolveForSelector(entry)?.id ?? (entry === batchName ? entry : undefined);

      if (id == null) {
        warnings.push(`MCP methodTools entry "${entry}" does not match any method id or alias.`);
      } else {
        selectedIds.add(id);
      }
    }

    result = (summary) => selectedIds.has(summary.id);
  } else {
    const all = methodTools === true;
    result = () => all;
  }

  return result;
}

// MARK: Additional Tools
/**
 * Handler for an {@link mcpAdditionalTool}. The returned value is formatted like a callModel result.
 */
export type McpAdditionalToolHandler<I> = (args: I, ctx: McpStaticToolHandlerContext) => PromiseOrValue<unknown>;

/**
 * Config for {@link mcpAdditionalTool}.
 */
export interface McpAdditionalToolConfig<I = Record<string, unknown>> {
  /**
   * The tool name. Must match {@link MCP_TOOL_NAME_PATTERN}; no dots.
   */
  readonly name: string;
  readonly description: string;
  /**
   * ArkType input type used to build the input schema. Ignored when {@link inputSchema} is set.
   */
  readonly inputType?: Type<I>;
  /**
   * Explicit input JSON schema. Defaults to the {@link inputType} export, or `{ type: 'object' }`.
   */
  readonly inputSchema?: object;
  readonly outputSchema?: object;
  /**
   * Whether the tool only reads. A tool that is not read-only runs through `destructive`, unless it declares
   * `destructive: false` and is not `openWorld`, in which case it runs through `write`.
   */
  readonly readOnly: boolean;
  /**
   * Whether a tool that is not read-only may delete or overwrite data. Unset leaves it unclassified: advertised
   * `destructiveHint: true` and routed through `destructive` (fail-safe).
   */
  readonly destructive?: boolean;
  /**
   * Whether the tool sends real messages or changes state in a third-party service. Advertised as `openWorldHint` when set.
   */
  readonly openWorld?: boolean;
  readonly visibility?: McpVisibilityRule;
  readonly requiredScopeTerms?: readonly OidcScopeTerm[];
  readonly expose: McpAdditionalToolExpose;
  readonly handler: McpAdditionalToolHandler<I>;
}

/**
 * Builds an app-supplied {@link McpAdditionalTool} for `MCP_ADDITIONAL_TOOLS`.
 *
 * @param config - The tool's name, description, schema, read-only classification, exposure, and handler.
 * @returns The additional tool.
 *
 * @example
 * ```ts
 * mcpAdditionalTool({ name: 'app_weekly_report', description: 'Weekly report.', inputType: weeklyReportParamsType, readOnly: true, expose: 'tool', handler: (args, ctx) => reports.weekly(args, ctx.auth) });
 * ```
 */
export function mcpAdditionalTool<I = Record<string, unknown>>(config: McpAdditionalToolConfig<I>): McpAdditionalTool {
  const { name, description, inputType, outputSchema, readOnly, destructive, openWorld, visibility, requiredScopeTerms, expose, handler } = config;
  const inputSchema = config.inputSchema ?? (inputType == null ? { type: 'object' } : (arktypeToJsonSchemaForExport(inputType as unknown as Type<unknown>) as object));
  const dispatch = { call: name, modelType: 'app' };

  const definition = buildStaticToolDefinition({
    name,
    description,
    inputSchema,
    outputSchema,
    dispatch,
    effectiveReadOnly: readOnly,
    destructive,
    openWorld,
    rule: visibility,
    requiredScopeTerms,
    staticHandler: async (args, ctx) => {
      const value = await handler(args as I, ctx);
      return (await formatMcpToolResponse(value, { ...dispatch, data: args }, undefined)) as CallToolResult;
    }
  });

  return { definition, expose };
}
