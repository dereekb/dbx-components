import { existsSync, readFileSync } from 'node:fs';
import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { type Request } from 'express';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { getOidcScopesFromRequest } from '@dereekb/firebase-server/oidc';
import { authRolesSetHasRoles, type AuthClaims, type AuthRoleSet, type Maybe } from '@dereekb/util';
import { ModelApiCallModelDispatchService, ModelApiGetService, FirebaseServerStorageService, type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { McpModuleConfig, DEFAULT_MCP_SERVER_NAME, DEFAULT_MCP_SERVER_INSTRUCTIONS, MCP_AUTH_ROLE_READER, type McpAuthRoleReader } from '../mcp.config';
import { applyMcpReasonParameterToSchema, extractMcpReasonFromArgs, mcpSchemaDeclaresProperty, resolveMcpReasonParameterConfig, type ResolvedMcpReasonParameterConfig } from './mcp.reason';
import { MCP_ANALYTICS_SERVICE, noopMcpAnalyticsService, type McpAnalyticsEvent, type McpAnalyticsService } from './analytics/mcp.analytics.handler';
import { MCP_MANIFEST_VERSION, type McpManifest, type McpManifestAuth, type McpManifestEnum, type McpManifestModelEntry, type McpManifestToolEntry } from './mcp.manifest';
import { ROUTE_MANIFEST_VERSION, type RouteManifest } from './mcp.route-manifest';
import { formatMcpToolErrorResponse, formatMcpToolResponse } from './mcp.response-formatter';
import { generateMcpToolDefinitions, MCP_TOOL_NAME_MAX_LENGTH, type McpToolDefinition, type McpToolGenerationNamingOptions, type McpToolGenerationResult, type McpToolGenerationSkip, type McpToolGenerationWarning, type McpToolListEntry, type McpStaticToolHandler } from './mcp.tool-generator';
import { createModelGetTool } from './tools/mcp.tool.model-get';
import { createModelInfoTool } from './tools/mcp.tool.model-info';
import { createModelDecodeTool } from './tools/mcp.tool.model-decode';
import { createEnumInfoTool } from './tools/mcp.tool.enum-info';
import { createWhoamiTool } from './tools/mcp.tool.whoami';
import { createUrlModelsTool } from './tools/mcp.tool.url-models';
import { createBatchExecuteTool, batchOperationCoordKey, type BatchOperationAuthorization } from './tools/mcp.tool.batch-execute';

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
  private _cachedManifestEnums: { readonly [name: string]: McpManifestEnum } | undefined;
  private _cachedManifestAuth: McpManifestAuth | undefined;
  private _cachedRouteManifest: RouteManifest | undefined;
  private _routeManifestLoaded = false;
  private _manifestLoaded = false;
  private _loggedSkips = false;
  private _warnedMissingRoleReader = false;
  private _resolvedReasonConfig?: ResolvedMcpReasonParameterConfig;
  private readonly _analyticsService: McpAnalyticsService;

  // eslint-disable-next-line @typescript-eslint/max-params -- NestJS DI requires individual constructor parameters
  constructor(
    @Inject(McpModuleConfig) private readonly mcpConfig: McpModuleConfig,
    @Inject(ModelApiCallModelDispatchService) private readonly dispatchService: ModelApiCallModelDispatchService,
    @Optional() @Inject(ModelApiGetService) private readonly modelApiGetService?: ModelApiGetService,
    @Optional() @Inject(MCP_AUTH_ROLE_READER) private readonly roleReader?: McpAuthRoleReader,
    @Optional() @Inject(MCP_ANALYTICS_SERVICE) analyticsService?: McpAnalyticsService,
    @Optional() @Inject(FirebaseServerStorageService) private readonly storageService?: FirebaseServerStorageService
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

    // The batch tool is request-scoped: it authorizes each batched operation against this caller's
    // resolved visible tool set, so it can't be cached like the other static tools.
    const batchTool = this._resolveBatchTool(ctx, definitionsByName);
    let listedTools: ReadonlyArray<McpToolDefinition> = visibleTools;

    if (batchTool != null) {
      definitionsByName.set(batchTool.name, batchTool);
      listedTools = [...visibleTools, batchTool];
    }

    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: listedTools.map((tool) => this._buildToolListEntry(tool, ctx, scopes))
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
        result = generateMcpToolDefinitions(apiDetails, undefined, { manifest, naming: this._resolveToolNamingOptions() });
      }

      this._cachedTools = result;
    }

    if (!this._loggedSkips && (result.skipped.length > 0 || result.warnings.length > 0)) {
      this._loggedSkips = true;
      for (const skip of result.skipped) {
        this._logSkip(skip);
      }
      for (const warning of result.warnings) {
        this._logger.warn(this._describeToolGenerationWarning(warning));
      }
    }

    return result;
  }

  /**
   * Builds the per-model tool-name segment overrides from the loaded manifest's `models` catalog.
   *
   * Sourcing the segments from the manifest (rather than runtime config) keeps the runtime in
   * agreement with the build-time manifest validation, which reads the same `mcpToolNameSegment`.
   *
   * @returns Naming options carrying the segment map, or `undefined` when no model declares one.
   */
  private _resolveToolNamingOptions(): McpToolGenerationNamingOptions | undefined {
    const models = this._cachedManifestModels;
    let result: McpToolGenerationNamingOptions | undefined;

    if (models != null && models.length > 0) {
      const modelSegments = new Map<string, string>();

      for (const model of models) {
        if (model.mcpToolNameSegment != null && model.mcpToolNameSegment.length > 0) {
          modelSegments.set(model.modelType, model.mcpToolNameSegment);
        }
      }

      if (modelSegments.size > 0) {
        result = { modelSegments };
      }
    }

    return result;
  }

  /**
   * Logs one skipped tool at the appropriate level: name-cap and collision skips are errors (they
   * would otherwise break or shadow tools on the wire), the rest are warnings.
   *
   * @param skip - The skipped-tool report to log.
   */
  private _logSkip(skip: McpToolGenerationSkip): void {
    const errorSuffix = skip.error ? `: ${skip.error.message}` : '';

    if (skip.reason === 'name_too_long') {
      this._logger.error(`Dropped MCP tool ${skip.toolName} — its name is ${skip.toolName.length} chars, over the ${MCP_TOOL_NAME_MAX_LENGTH}-char limit. Shorten the model/specifier, hide it (mcp.visibility: false), or set an mcp.name override.`);
    } else if (skip.reason === 'duplicate_name') {
      this._logger.error(`Dropped MCP tool ${skip.toolName} — another visible tool already resolved to this name. Give one an mcp.name override to disambiguate.`);
    } else {
      this._logger.warn(`Skipped MCP tool ${skip.toolName} (${skip.reason})${errorSuffix}`);
    }
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

        // `url-models` reuses the model-get read/identity path, so it is only offered when the get
        // service is wired AND a route manifest with at least one state was loaded.
        const routeManifest = this._resolveRouteManifest();

        if (routeManifest != null && routeManifest.states.length > 0) {
          staticTools.push(
            createUrlModelsTool({
              routeManifest,
              readDocuments: (modelType, keys, auth) => getService.readDocuments(modelType, keys, auth),
              resolveIdentity: (modelType, auth) => getService.getModelIdentity(modelType, auth)
            })
          );
        }
      }

      const modelManifest = this._cachedManifestModels;
      const enumManifest = this._cachedManifestEnums;

      if (modelManifest != null && modelManifest.length > 0) {
        staticTools.push(createModelInfoTool({ manifest: modelManifest, ...(enumManifest == null ? {} : { enums: enumManifest }) }), createModelDecodeTool({ manifest: modelManifest }));
      }

      // `enum-info` only needs the enum value tables — register it whenever the manifest carries a
      // non-empty `enums` block, independent of the model catalog.
      if (enumManifest != null && Object.keys(enumManifest).length > 0) {
        staticTools.push(createEnumInfoTool({ enums: enumManifest }));
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
   * Builds the per-request `batch-execute` tool, or `undefined` when it should not be offered.
   *
   * Unlike the cached static tools this is rebuilt per request, because it closes over the caller's
   * resolved visible tool set: each batched operation is authorized against exactly the callModel
   * tools this caller may invoke directly. Offered only when a storage service is wired (it reads
   * the uploaded operations file), the caller is authenticated, and the server is not in read-only
   * mode (the tool performs writes).
   *
   * @param ctx - The per-request context (auth, raw request) forwarded to dispatched operations.
   * @param definitionsByName - The caller's visible tool definitions, keyed by name.
   * @returns The batch tool definition, or `undefined` when unavailable for this request.
   */
  private _resolveBatchTool(ctx: McpRequestContext, definitionsByName: ReadonlyMap<string, McpToolDefinition>): Maybe<McpToolDefinition> {
    let result: Maybe<McpToolDefinition>;
    const storageService = this.storageService;

    if (storageService != null && ctx.auth != null && this.mcpConfig.readOnly !== true) {
      const authorizedCoords = new Set<string>();

      for (const definition of definitionsByName.values()) {
        // Only callModel tools are re-dispatchable; static tools (model-get, whoami) have synthetic
        // dispatch identities the callModel chain can't resolve.
        if (definition.staticHandler == null) {
          authorizedCoords.add(batchOperationCoordKey(definition.dispatch));
        }
      }

      result = createBatchExecuteTool({
        storageService,
        dispatch: (operation, auth, rawRequest) => this.dispatchService.dispatch(operation, auth, rawRequest),
        authorizeOperation: (operation) => this._authorizeBatchOperation(operation, authorizedCoords)
      });
    }

    return result;
  }

  /**
   * Authorizes a single batched operation against the caller's visible callModel tool coordinates.
   *
   * Re-applies the same gate the `tools/list` filter already enforced: an operation is allowed only
   * when its `(call, modelType, specifier)` coordinate matches a tool this caller can see. This is
   * the critical guard — `dispatchService.dispatch` bypasses the MCP visibility filter, so without
   * this check a batch could reach scope-, role-, or read-only-gated handlers.
   *
   * @param operation - The operation to authorize.
   * @param authorizedCoords - The set of dispatchable coordinate keys visible to this caller.
   * @returns Whether the operation may be dispatched, with a reason when it may not.
   */
  private _authorizeBatchOperation(operation: OnCallTypedModelParams, authorizedCoords: ReadonlySet<string>): BatchOperationAuthorization {
    const coordKey = batchOperationCoordKey({ call: operation.call ?? '', modelType: operation.modelType, specifier: operation.specifier ?? undefined });
    const specifierSuffix = operation.specifier ? ` specifier="${operation.specifier}"` : '';
    return authorizedCoords.has(coordKey) ? { allowed: true } : { allowed: false, reason: `no visible tool matches call="${operation.call ?? ''}" modelType="${operation.modelType}"${specifierSuffix} (unknown, or hidden by scope/role/read-only).` };
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
    this._cachedManifestEnums = undefined;
    this._cachedManifestAuth = undefined;
  }

  /**
   * Reads the pre-rendered route manifest JSON once, validates its version, and caches the result
   * for the process lifetime. Drives whether the built-in `url-models` static tool is registered.
   *
   * Missing file or wrong version fall back to "no route manifest" with a single boot warning;
   * the `url-models` tool is then simply not offered.
   *
   * @returns The cached route manifest, or `undefined` when none was loaded.
   */
  private _resolveRouteManifest(): RouteManifest | undefined {
    if (!this._routeManifestLoaded) {
      this._routeManifestLoaded = true;
      const path = this.mcpConfig.mcpRouteManifestPath;

      if (path == null) {
        this._cachedRouteManifest = undefined;
      } else if (existsSync(path)) {
        this._parseRouteManifestFile(path);
      } else {
        this._logger.warn(`MCP route manifest path is set but the file is missing: ${path}. The url-models tool will not be registered.`);
        this._cachedRouteManifest = undefined;
      }
    }

    return this._cachedRouteManifest;
  }

  private _parseRouteManifestFile(path: string): void {
    try {
      const raw = readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw) as RouteManifest;

      if (parsed.version === ROUTE_MANIFEST_VERSION) {
        this._cachedRouteManifest = parsed;
        this._logger.log(`Loaded MCP route manifest from ${path}: ${parsed.states.length} states.`);
      } else {
        this._logger.warn(`MCP route manifest version mismatch at ${path}: got ${String(parsed.version)}, expected ${ROUTE_MANIFEST_VERSION}. The url-models tool will not be registered.`);
        this._cachedRouteManifest = undefined;
      }
    } catch (error) {
      this._logger.warn(`Failed to read MCP route manifest at ${path}: ${(error as Error).message}. The url-models tool will not be registered.`);
      this._cachedRouteManifest = undefined;
    }
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
    const enums = parsed.enums != null && typeof parsed.enums === 'object' && Object.keys(parsed.enums).length > 0 ? parsed.enums : undefined;
    const enumSuffix = enums == null ? '' : `, ${Object.keys(enums).length} enum entries`;
    const auth = parsed.auth != null && Array.isArray(parsed.auth.claims) ? parsed.auth : undefined;
    const authSuffix = auth == null ? '' : `, ${auth.claims.length} auth claim entries`;

    this._logger.log(`Loaded MCP manifest from ${path}: ${map.size} tool entries${modelSuffix}${enumSuffix}${authSuffix}.`);
    this._cachedManifest = map;
    this._cachedManifestModels = models;
    this._cachedManifestEnums = enums;
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
   * Resolves the app's reason-parameter config once and caches it for the process lifetime.
   *
   * The underlying {@link McpModuleConfig.reasonParameter} value is fixed at boot, so the normalized
   * form is safe to memoize and reuse across every `tools/list` and `tools/call`.
   *
   * @returns The resolved reason-parameter config (defaults applied).
   */
  private _resolveReasonConfig(): ResolvedMcpReasonParameterConfig {
    let result = this._resolvedReasonConfig;

    if (result == null) {
      result = resolveMcpReasonParameterConfig(this.mcpConfig.reasonParameter);
      this._resolvedReasonConfig = result;
    }

    return result;
  }

  /**
   * Resolves the wire-shape `tools/list` entry for a single tool.
   *
   * Hot-path short-circuit: tools without a `toolDetailsBuilder` reuse the precomputed,
   * frozen {@link McpToolDefinition.staticWireEntry} verbatim — zero allocations per
   * request for the common case. When the auto-injected reason parameter is enabled (the
   * default), the entry is no longer returned frozen-verbatim: its `inputSchema` is wrapped
   * with the reason property per request (`tools/list` is low-frequency, so the allocation is
   * acceptable). Tools that already declare the parameter name are still reused verbatim.
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
    const reasonConfig = this._resolveReasonConfig();
    let result: McpToolListEntry;

    if (tool.toolDetailsBuilder == null) {
      result = tool.staticWireEntry;

      if (reasonConfig.enabled) {
        const reasoned = applyMcpReasonParameterToSchema(tool.staticWireEntry.inputSchema, reasonConfig);

        // applyMcpReasonParameterToSchema self-skips (returns the same reference) on collision, so the
        // frozen-verbatim hot path still holds for tools that already declare the parameter name.
        if (reasoned !== tool.staticWireEntry.inputSchema) {
          result = { ...tool.staticWireEntry, inputSchema: reasoned };
        }
      }
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

      let resolvedInputSchema: object = inputSchema ?? { type: 'object' };

      if (reasonConfig.enabled) {
        resolvedInputSchema = applyMcpReasonParameterToSchema(resolvedInputSchema, reasonConfig);
      }

      const wire: { name: string; description: string; inputSchema: object; outputSchema?: object; annotations?: ToolAnnotations } = {
        name: tool.name,
        description,
        inputSchema: resolvedInputSchema
      };

      if (tool.outputSchema != null) {
        wire.outputSchema = tool.outputSchema;
      }

      if (tool.annotations != null) {
        wire.annotations = tool.annotations;
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
    const rawArgs = request.params.arguments ?? {};
    const startedAt = Date.now();

    // Split the auto-injected reason out of the args: forward it to analytics, but never let it reach
    // the underlying handler. Tools that declare their own field of the same name keep it (driven by
    // the tool's own resolved inputSchema, not the reason-augmented wire schema).
    const reasonConfig = this._resolveReasonConfig();
    const declaresOwn = mcpSchemaDeclaresProperty(definition?.inputSchema, reasonConfig.parameterName);
    const { reason, args } = extractMcpReasonFromArgs(rawArgs, reasonConfig, declaresOwn);

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
      reason,
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
