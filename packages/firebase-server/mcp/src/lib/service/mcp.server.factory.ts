import { existsSync, readFileSync } from 'node:fs';
import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type Request } from 'express';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { getOidcScopesFromRequest } from '@dereekb/firebase-server/oidc';
import { authRolesSetHasRoles, type AuthClaims, type AuthRoleSet, type Maybe } from '@dereekb/util';
import { ModelApiCallModelDispatchService, ModelApiGetService, type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { McpModuleConfig, DEFAULT_MCP_SERVER_NAME, DEFAULT_MCP_SERVER_INSTRUCTIONS, MCP_AUTH_ROLE_READER, type McpAuthRoleReader } from '../mcp.config';
import { MCP_ANALYTICS_SERVICE, noopMcpAnalyticsService, type McpAnalyticsEvent, type McpAnalyticsService } from './analytics/mcp.analytics.handler';
import { MCP_MANIFEST_VERSION, type McpManifest, type McpManifestAuth, type McpManifestModelEntry, type McpManifestToolEntry } from './mcp.manifest';
import { formatMcpToolErrorResponse, formatMcpToolResponse } from './mcp.response-formatter';
import { generateMcpToolDefinitions, type McpToolDefinition, type McpToolGenerationResult, type McpToolGenerationWarning, type McpToolListEntry, type McpStaticToolHandler } from './mcp.tool-generator';
import { createModelGetTool } from './tools/mcp.tool.model-get';
import { createModelInfoTool } from './tools/mcp.tool.model-info';
import { createModelDecodeTool } from './tools/mcp.tool.model-decode';
import { createWhoamiTool } from './tools/mcp.tool.whoami';

/**
 * Optional per-request context passed when invoking the MCP server through a
 * Streamable HTTP transport. Carries the authenticated user (already extracted
 * by the OIDC bearer middleware) and the raw Express request so the dispatch
 * chain can satisfy `nestApplication`, `auth`, and `rawRequest` consumers.
 */
export interface McpRequestContext {
  readonly auth?: FirebaseServerAuthData;
  readonly rawRequest: Request;
}

/**
 * Injectable factory that builds {@link McpServer} instances pre-wired to the
 * call model dispatch chain.
 *
 * The factory is invoked per Streamable HTTP request — `@modelcontextprotocol/sdk`
 * recommends a fresh `McpServer` + transport pair per stateless JSON-RPC request,
 * which sidesteps session bookkeeping for the common Claude-connector case.
 */
@Injectable()
export class McpServerFactoryService {
  private readonly _logger = new Logger(McpServerFactoryService.name);

  private _cachedTools: McpToolGenerationResult | undefined;
  private _cachedStaticTools: ReadonlyArray<McpToolDefinition> | undefined;
  private _cachedManifest: ReadonlyMap<string, McpManifestToolEntry> | undefined;
  private _cachedManifestModels: ReadonlyArray<McpManifestModelEntry> | undefined;
  private _cachedManifestAuth: McpManifestAuth | undefined;
  private _manifestLoaded = false;
  private _loggedSkips = false;
  private _warnedMissingRoleReader = false;
  private readonly _analyticsService: McpAnalyticsService;

  // eslint-disable-next-line @typescript-eslint/max-params -- NestJS DI requires individual constructor parameters
  constructor(
    @Inject(McpModuleConfig) private readonly mcpConfig: McpModuleConfig,
    @Inject(ModelApiCallModelDispatchService) private readonly dispatchService: ModelApiCallModelDispatchService,
    @Optional() @Inject(ModelApiGetService) private readonly modelApiGetService?: ModelApiGetService,
    @Optional() @Inject(MCP_AUTH_ROLE_READER) private readonly roleReader?: McpAuthRoleReader,
    @Optional() @Inject(MCP_ANALYTICS_SERVICE) analyticsService?: McpAnalyticsService
  ) {
    this._analyticsService = analyticsService ?? noopMcpAnalyticsService();
  }

  /**
   * Builds a configured MCP server with tool listing + dispatch handlers wired up.
   *
   * @param ctx - The per-request context (auth, raw request) used when forwarding tool calls.
   * @returns A configured MCP server ready to be `connect()`-ed to a transport.
   */
  createServer(ctx: McpRequestContext): McpServer {
    const baseServerName = this.mcpConfig.serverName ?? DEFAULT_MCP_SERVER_NAME;
    const serverName = this.mcpConfig.readOnly === true ? `${baseServerName} (read-only)` : baseServerName;

    const server = new McpServer(
      {
        name: serverName,
        version: this.mcpConfig.serverVersion ?? '0.0.0'
      },
      {
        instructions: this.mcpConfig.serverInstructions ?? DEFAULT_MCP_SERVER_INSTRUCTIONS
      }
    );

    server.server.registerCapabilities({ tools: {} });

    const toolGeneration = this._resolveToolDefinitions();
    const staticTools = this._resolveStaticTools();
    const scopes = this._resolveScopes(ctx);
    const authRoles = this._resolveAuthRoles(ctx);
    const combinedTools: ReadonlyArray<McpToolDefinition> = [...toolGeneration.tools, ...staticTools];
    const visibleTools = this._filterToolsForRequest(combinedTools, { ctx, scopes, authRoles });
    const definitionsByName = new Map<string, McpToolDefinition>(visibleTools.map((tool) => [tool.name, tool]));

    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: visibleTools.map((tool) => this._buildToolListEntry(tool, ctx, scopes))
    }));

    server.server.setRequestHandler(CallToolRequestSchema, async (request) => this._handleToolCall(request, definitionsByName, ctx));

    return server;
  }

  /**
   * Reads cached tool definitions, regenerating + logging skips on first call.
   *
   * The underlying call model `_apiDetails` is built at boot and doesn't change at runtime,
   * so the generation result is safe to cache for the lifetime of the process.
   *
   * @returns The cached or freshly-generated tool generation result.
   */
  private _resolveToolDefinitions(): McpToolGenerationResult {
    let result = this._cachedTools;

    if (result == null) {
      const apiDetails = this.dispatchService.getApiDetails();
      const manifest = this._resolveManifest();

      if (apiDetails == null) {
        result = { tools: [], neverVisibleTools: [], skipped: [], warnings: [] };
      } else {
        result = generateMcpToolDefinitions(apiDetails, undefined, manifest);
      }

      this._cachedTools = result;
    }

    if (!this._loggedSkips && (result.skipped.length > 0 || result.warnings.length > 0)) {
      this._loggedSkips = true;
      for (const skip of result.skipped) {
        const errorSuffix = skip.error ? `: ${skip.error.message}` : '';
        this._logger.warn(`Skipped MCP tool ${skip.toolName} (${skip.reason})${errorSuffix}`);
      }
      for (const warning of result.warnings) {
        this._logger.warn(this._describeToolGenerationWarning(warning));
      }
    }

    return result;
  }

  /**
   * Renders a human-readable boot-time warning for an MCP-result mapping inconsistency between a
   * handler's `mapSuccessfulResult` and the build-time manifest.
   *
   * @param warning - The tool-generation warning to describe.
   * @returns The log line to emit at startup.
   */
  private _describeToolGenerationWarning(warning: McpToolGenerationWarning): string {
    let result: string;

    if (warning.reason === 'mapper_without_mapped_manifest') {
      result = `MCP tool ${warning.toolName} declares mcp.mapSuccessfulResult but its manifest entry has no mapped result type — annotate the matching '.api.ts' leaf with '@dbxModelApiMcpResult <TypeName>' and regenerate the manifest so the advertised output schema matches the mapped result.`;
    } else {
      result = `MCP tool ${warning.toolName} has a '@dbxModelApiMcpResult' manifest annotation but its handler no longer declares mcp.mapSuccessfulResult — remove the stale annotation and regenerate the manifest, or restore the mapper.`;
    }

    return result;
  }

  /**
   * Builds the list of statically-registered (non-callModel) MCP tools.
   *
   * Includes `model-get` whenever {@link ModelApiGetService} is available, plus
   * `model-info` and `model-decode` whenever the boot-time MCP manifest provided
   * a non-empty `models` catalog. The list is cached for the lifetime of the
   * process since static tools share the same boot-time inputs as the
   * auto-generated ones.
   *
   * @returns The cached array of static tool definitions, filtered for collisions with generated tools.
   */
  private _resolveStaticTools(): ReadonlyArray<McpToolDefinition> {
    let result = this._cachedStaticTools;

    if (result == null) {
      // Ensure the manifest has been loaded so its `models` array is available for the catalog tools.
      this._resolveManifest();

      const staticTools: McpToolDefinition[] = [];
      const getService = this.modelApiGetService;

      if (getService != null) {
        staticTools.push(
          createModelGetTool({
            readDocuments: (modelType, keys, auth) => getService.readDocuments(modelType, keys, auth),
            resolveIdentity: (modelType, auth) => getService.getModelIdentity(modelType, auth)
          })
        );
      }

      const modelManifest = this._cachedManifestModels;

      if (modelManifest != null && modelManifest.length > 0) {
        staticTools.push(createModelInfoTool({ manifest: modelManifest }), createModelDecodeTool({ manifest: modelManifest }));
      }

      const authManifest = this._cachedManifestAuth;

      if (authManifest != null) {
        staticTools.push(createWhoamiTool({ auth: authManifest, roleReader: this.roleReader }));
      }

      // Guard against the auto-generated tools accidentally claiming a static tool name. The first
      // dispatch wins via Map.set order, so a collision would silently shadow one side.
      const generatedNames = new Set(this._cachedTools?.tools.map((t) => t.name) ?? []);
      const filtered: McpToolDefinition[] = [];

      for (const tool of staticTools) {
        if (generatedNames.has(tool.name)) {
          this._logger.warn(`Static MCP tool "${tool.name}" collides with an auto-generated tool of the same name; the auto-generated tool will win.`);
        } else {
          filtered.push(tool);
        }
      }

      result = filtered;
      this._cachedStaticTools = result;
    }

    return result;
  }

  /**
   * Reads the pre-rendered MCP manifest JSON once, validates its version, and caches the
   * resulting `key → entry` map plus the optional `models` catalog for the process lifetime.
   *
   * Missing file or wrong version fall back to "no manifest" with a single boot warning;
   * the runtime still produces tools using the auto-generated descriptions and
   * ArkType-derived schemas.
   *
   * @returns The cached tool-entry map, or `undefined` when no manifest was loaded.
   */
  private _resolveManifest(): ReadonlyMap<string, McpManifestToolEntry> | undefined {
    if (!this._manifestLoaded) {
      this._manifestLoaded = true;
      const path = this.mcpConfig.mcpManifestPath;

      if (path == null) {
        this._resetManifestCache();
      } else if (existsSync(path)) {
        this._parseManifestFile(path);
      } else {
        this._logger.warn(`MCP manifest path is set but the file is missing: ${path}. Falling back to runtime defaults.`);
        this._resetManifestCache();
      }
    }

    return this._cachedManifest;
  }

  private _resetManifestCache(): void {
    this._cachedManifest = undefined;
    this._cachedManifestModels = undefined;
    this._cachedManifestAuth = undefined;
  }

  private _parseManifestFile(path: string): void {
    try {
      const raw = readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw) as McpManifest;

      if (parsed.version === MCP_MANIFEST_VERSION) {
        this._applyParsedManifest(parsed, path);
      } else {
        this._logger.warn(`MCP manifest version mismatch at ${path}: got ${String(parsed.version)}, expected ${MCP_MANIFEST_VERSION}. Falling back to runtime defaults.`);
        this._resetManifestCache();
      }
    } catch (error) {
      this._logger.warn(`Failed to read MCP manifest at ${path}: ${(error as Error).message}. Falling back to runtime defaults.`);
      this._resetManifestCache();
    }
  }

  private _applyParsedManifest(parsed: McpManifest, path: string): void {
    const map = new Map<string, McpManifestToolEntry>();

    for (const [key, entry] of Object.entries(parsed.tools)) {
      if (entry != null) {
        map.set(key, entry);
      }
    }

    const models = Array.isArray(parsed.models) && parsed.models.length > 0 ? (parsed.models as ReadonlyArray<McpManifestModelEntry>) : undefined;
    const modelSuffix = models == null ? '' : `, ${models.length} model entries`;
    const auth = parsed.auth != null && Array.isArray(parsed.auth.claims) ? parsed.auth : undefined;
    const authSuffix = auth == null ? '' : `, ${auth.claims.length} auth claim entries`;

    this._logger.log(`Loaded MCP manifest from ${path}: ${map.size} tool entries${modelSuffix}${authSuffix}.`);
    this._cachedManifest = map;
    this._cachedManifestModels = models;
    this._cachedManifestAuth = auth;
  }

  /**
   * Reads the caller's OIDC scopes from the raw Express request via the auth context.
   *
   * Synthesizes the same `{ auth: { token } }` shape that `getOidcScopesFromRequest`
   * expects post-dispatch, so the upstream helper stays the single source of scope parsing.
   * Returns `undefined` for non-OIDC callers (no `oidcValidatedToken.scope`) — the filter
   * loop treats that as "skip scope enforcement", matching `oidcCallModelScopePreAssert`.
   *
   * @param ctx - The per-request context carrying the validated auth payload.
   * @returns The set of granted OIDC scopes, or `undefined` when scope enforcement should be skipped.
   */
  private _resolveScopes(ctx: McpRequestContext): Maybe<ReadonlySet<string>> {
    const oidcValidatedToken = (ctx.auth as { oidcValidatedToken?: unknown } | undefined)?.oidcValidatedToken;
    return oidcValidatedToken == null ? undefined : getOidcScopesFromRequest({ auth: { token: oidcValidatedToken } });
  }

  /**
   * Maps the caller's Firebase custom claims through the optional role reader.
   * Emits one boot-time warning when a declarative `requiredRoles` rule will be checked
   * but no reader is wired — that path will fail closed.
   *
   * @param ctx - The per-request context carrying the authenticated user's token.
   * @returns The resolved auth role set, or `undefined` when no auth or reader is available.
   */
  private _resolveAuthRoles(ctx: McpRequestContext): Maybe<AuthRoleSet> {
    let result: Maybe<AuthRoleSet>;

    if (ctx.auth?.token != null && this.roleReader != null) {
      result = this.roleReader(ctx.auth.token as unknown as AuthClaims);
    }

    return result;
  }

  private _filterToolsForRequest(tools: ReadonlyArray<McpToolDefinition>, context: { ctx: McpRequestContext; scopes: Maybe<ReadonlySet<string>>; authRoles: Maybe<AuthRoleSet> }): ReadonlyArray<McpToolDefinition> {
    const { ctx, scopes, authRoles } = context;
    const readOnlyMode = this.mcpConfig.readOnly === true;
    const visible: McpToolDefinition[] = [];

    for (const tool of tools) {
      const { filterMetadata } = tool;

      if (scopes != null && filterMetadata.requiredScope != null && !scopes.has(filterMetadata.requiredScope)) {
        continue;
      }

      if (readOnlyMode && filterMetadata.effectiveReadOnly !== true) {
        continue;
      }

      if (!this._passesVisibility({ tool, ctx, scopes, authRoles })) {
        continue;
      }

      visible.push(tool);
    }

    return visible;
  }

  private _passesVisibility(input: { tool: McpToolDefinition; ctx: McpRequestContext; scopes: Maybe<ReadonlySet<string>>; authRoles: Maybe<AuthRoleSet> }): boolean {
    const { tool, ctx, scopes, authRoles } = input;
    const { filterMetadata } = tool;
    let result: boolean;

    if (filterMetadata.visibilityKind === 'declarative') {
      result = this._checkDeclarativeVisibility(filterMetadata.rule, ctx, authRoles);
    } else if (filterMetadata.visibilityKind === 'dynamic') {
      try {
        result = filterMetadata.visibilityFn({ auth: ctx.auth, scopes: scopes ?? undefined, tool: tool.dispatch }) === true;
      } catch (error) {
        this._logger.warn(`MCP tool ${tool.name} visibility predicate threw; treating as not visible: ${(error as Error).message}`);
        result = false;
      }
    } else {
      result = true;
    }

    return result;
  }

  private _checkDeclarativeVisibility(rule: { requireAuthenticated?: boolean; requiredRoles?: ReadonlyArray<string> }, ctx: McpRequestContext, authRoles: Maybe<AuthRoleSet>): boolean {
    let result = true;

    if (rule.requireAuthenticated === true && ctx.auth == null) {
      result = false;
    } else if (rule.requiredRoles != null && rule.requiredRoles.length > 0) {
      if (authRoles == null) {
        if (this.roleReader == null && !this._warnedMissingRoleReader) {
          this._warnedMissingRoleReader = true;
          this._logger.warn('MCP tool visibility rule declared requiredRoles but no McpAuthRoleReader is provided. Tools gated by role will be hidden.');
        }
        result = false;
      } else {
        result = authRolesSetHasRoles(authRoles, rule.requiredRoles);
      }
    }

    return result;
  }

  /**
   * Resolves the wire-shape `tools/list` entry for a single tool.
   *
   * Hot-path short-circuit: tools without a `toolDetailsBuilder` reuse the precomputed,
   * frozen {@link McpToolDefinition.staticWireEntry} verbatim — zero allocations per
   * request for the common case.
   *
   * Tools that opted in to {@link McpToolDetailsBuilder} get a fresh wire entry built
   * from the builder's overrides. If the builder throws, the framework falls back to
   * the static defaults and logs a warning (fail-soft, matching `_passesVisibility`).
   *
   * @param tool - The tool definition whose wire entry is being resolved.
   * @param ctx - The per-request context forwarded to any dynamic details builder.
   * @param scopes - The caller's granted OIDC scopes forwarded to any dynamic details builder.
   * @returns The wire-shape entry to emit for this tool on `tools/list`.
   */
  private _buildToolListEntry(tool: McpToolDefinition, ctx: McpRequestContext, scopes: Maybe<ReadonlySet<string>>): McpToolListEntry {
    let result: McpToolListEntry;

    if (tool.toolDetailsBuilder == null) {
      result = tool.staticWireEntry;
    } else {
      let description = tool.description;
      let inputSchema: object | undefined = tool.inputSchema;

      try {
        const overrides = tool.toolDetailsBuilder({
          dispatch: tool.dispatch,
          defaultDescription: description,
          defaultInputSchema: inputSchema,
          auth: ctx.auth,
          scopes: scopes ?? undefined
        });

        if (overrides.description != null) {
          description = overrides.description;
        }

        if (overrides.inputSchema != null) {
          inputSchema = overrides.inputSchema;
        }
      } catch (error) {
        this._logger.warn(`MCP tool ${tool.name} toolDetails builder threw; falling back to defaults: ${(error as Error).message}`);
      }

      const wire: { name: string; description: string; inputSchema: object; outputSchema?: object } = {
        name: tool.name,
        description,
        inputSchema: inputSchema ?? { type: 'object' }
      };

      if (tool.outputSchema != null) {
        wire.outputSchema = tool.outputSchema;
      }

      result = wire;
    }

    return result;
  }

  /**
   * Central dispatch point for every MCP tool call. Runs the underlying handler — callModel,
   * static, or unknown-tool — then emits a single analytics event on completion so every call
   * is tracked uniformly.
   *
   * Success vs error is decided by the resolved outcome: an outcome that carries a thrown
   * error, or a response flagged `isError`, counts as a failure. The original thrown error
   * (when present) is forwarded on the event.
   *
   * @param request - The `tools/call` request carrying the tool name and arguments.
   * @param definitionsByName - The visible tool definitions keyed by name for this request.
   * @param ctx - The per-request context (auth, raw request) forwarded to the handler.
   * @returns The MCP tool response.
   */
  private async _handleToolCall(request: McpCallToolRequest, definitionsByName: Map<string, McpToolDefinition>, ctx: McpRequestContext): Promise<CallToolResult> {
    const toolName = request.params.name;
    const definition = definitionsByName.get(toolName);
    const args = request.params.arguments ?? {};
    const startedAt = Date.now();

    let outcome: McpToolCallOutcome;

    if (definition == null) {
      outcome = { response: formatMcpToolErrorResponse(new Error(`Unknown tool: ${toolName}`)) as CallToolResult };
    } else if (definition.staticHandler == null) {
      outcome = await this._handleCallModelToolCall(definition, args, ctx);
    } else {
      outcome = await this._handleStaticToolCall(definition.staticHandler, args, ctx);
    }

    const isSuccessful = outcome.error == null && outcome.response.isError !== true;

    // Unknown tools never reached a handler; classify as 'static' since no callModel dispatch occurred.
    const toolKind: McpAnalyticsEvent['toolKind'] = definition != null && definition.staticHandler == null ? 'callModel' : 'static';

    this._emitMcpAnalytics({
      event: toolName,
      toolName,
      toolKind,
      call: definition?.dispatch.call,
      modelType: definition?.dispatch.modelType,
      specifier: definition?.dispatch.specifier,
      uid: ctx.auth?.uid,
      auth: ctx.auth,
      readOnly: this.mcpConfig.readOnly === true,
      args,
      isSuccessful,
      error: outcome.error,
      durationMs: Date.now() - startedAt
    });

    return outcome.response;
  }

  /**
   * Forwards an event to the registered {@link McpAnalyticsService}, swallowing any failure so
   * a faulty analytics implementation can never break tool dispatch (fail-soft, matching the
   * visibility-predicate guards above).
   *
   * @param event - The MCP analytics event to forward.
   */
  private _emitMcpAnalytics(event: McpAnalyticsEvent): void {
    try {
      this._analyticsService.handleMcpAnalyticsEvent(event);
    } catch (error) {
      this._logger.warn(`MCP analytics handler threw for tool ${event.toolName}; ignoring: ${(error as Error).message}`);
    }
  }

  private async _handleStaticToolCall(staticHandler: McpStaticToolHandler, args: Record<string, unknown>, ctx: McpRequestContext): Promise<McpToolCallOutcome> {
    let outcome: McpToolCallOutcome;

    try {
      outcome = { response: await staticHandler(args, ctx) };
    } catch (error) {
      outcome = { response: formatMcpToolErrorResponse(error) as CallToolResult, error };
    }

    return outcome;
  }

  private async _handleCallModelToolCall(definition: McpToolDefinition, args: Record<string, unknown>, ctx: McpRequestContext): Promise<McpToolCallOutcome> {
    const params: OnCallTypedModelParams = {
      call: definition.dispatch.call,
      modelType: definition.dispatch.modelType,
      specifier: definition.dispatch.specifier,
      data: args
    };

    let outcome: McpToolCallOutcome;

    try {
      const result = await this.dispatchService.dispatch(params, ctx.auth, ctx.rawRequest);
      outcome = { response: (await formatMcpToolResponse(result, params, definition.details)) as CallToolResult };
    } catch (error) {
      outcome = { response: formatMcpToolErrorResponse(error) as CallToolResult, error };
    }

    return outcome;
  }
}

/**
 * The parsed `tools/call` request shape consumed by the dispatch chain.
 */
type McpCallToolRequest = { params: { name: string; arguments?: Record<string, unknown> } };

/**
 * Internal resolved outcome of a single MCP tool invocation: the wire response plus the
 * original thrown error (when one occurred), so the dispatch lifecycle can forward it to analytics.
 */
interface McpToolCallOutcome {
  readonly response: CallToolResult;
  readonly error?: unknown;
}
