import { existsSync, readFileSync } from 'node:fs';
import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { McpServer, type CallToolResult, type Tool, type ToolAnnotations } from '@modelcontextprotocol/server';
import { type Request } from 'express';
import { oidcScopeTermsSatisfied, type OnCallTypedModelParams } from '@dereekb/firebase';
import { getOidcScopesFromRequest } from '@dereekb/firebase-server/oidc';
import { authRolesSetHasRoles, type AuthClaims, type AuthRoleSet, type Maybe } from '@dereekb/util';
import { DocsApiService, ModelApiCallModelDispatchService, ModelApiGetService, FirebaseServerStorageService, type FirebaseServerAuthData, firebaseServerValidationErrorForSummary } from '@dereekb/firebase-server';
import {
  McpModuleConfig,
  DEFAULT_MCP_SERVER_NAME,
  DEFAULT_MCP_SERVER_INSTRUCTIONS,
  MCP_AUTH_ROLE_READER,
  type McpAuthRoleReader,
  MCP_CLI_TOKEN_MINTER,
  type McpCliTokenMinter,
  MCP_MODEL_ROLES_TARGET_UID_PREDICATE,
  type McpModelRolesTargetUidPredicate,
  MCP_ADDITIONAL_TOOLS,
  type McpAdditionalTools,
  type McpCompactToolNames,
  type McpToolExamplesConfig
} from '../mcp.config';
import { mcpToolInputValidator } from './mcp.tool-input.validation';
import { applyMcpReasonParameterToSchema, extractMcpReasonFromArgs, mcpSchemaDeclaresProperty, resolveMcpReasonParameterConfig, type ResolvedMcpReasonParameterConfig } from './mcp.reason';
import { MCP_ANALYTICS_SERVICE, noopMcpAnalyticsService, type McpAnalyticsEvent, type McpAnalyticsService } from './analytics/mcp.analytics.handler';
import { MCP_MANIFEST_VERSION, type McpManifest, type McpManifestAuth, type McpManifestEnum, type McpManifestModelEntry, type McpManifestToolEntry } from './mcp.manifest';
import { ROUTE_MANIFEST_VERSION, type RouteManifest } from './mcp.route-manifest';
import { formatMcpToolErrorResponse, formatMcpToolResponse } from './mcp.response-formatter';
import { generateMcpToolDefinitions, MCP_TOOL_NAME_MAX_LENGTH, type McpToolDefinition, type McpToolGenerationNamingOptions, type McpToolGenerationResult, type McpToolGenerationSkip, type McpToolGenerationWarning, type McpToolListEntry, type McpStaticToolHandler } from './mcp.tool-generator';
import { MCP_ALWAYS_LOAD_META_KEY, MCP_COMPACT_TOOL_KEYS, buildMcpCompactInstructions, planMcpToolSurface, resolveMcpCompactToolNames, resolveMcpToolNamePrefix, type BuildMcpCompactInstructionsInput, type McpToolSurfacePlan } from './mcp.compact';
import { findMcpToolExamplesConfigWarnings, resolveMcpToolCatalogExamples, resolveMcpToolMethodExamples, type McpToolCatalogExamples, type McpToolMethodExamples } from './mcp.examples';
import { mcpMethodKindForCall, mcpMethodKinds, type McpMethod, type McpMethodKind, type McpMethodView } from './mcp.method';
import { buildMcpMethodSearchEntries, suggestMcpMethods, type McpMethodSearchEntries } from './mcp.method.search';
import { createMcpCompactSearchTool } from './tools/mcp.tool.compact-search';
import { createMcpCompactDetailsTool } from './tools/mcp.tool.compact-details';
import { createMcpCompactRouterTool, describeMcpCompactRouterMismatch } from './tools/mcp.tool.compact-router';
import { createModelGetTool } from './tools/mcp.tool.model-get';
import { createModelRolesTool } from './tools/mcp.tool.model-roles';
import { createModelInfoTool } from './tools/mcp.tool.model-info';
import { createModelDecodeTool } from './tools/mcp.tool.model-decode';
import { createEnumInfoTool } from './tools/mcp.tool.enum-info';
import { createWhoamiTool } from './tools/mcp.tool.whoami';
import { CLI_TOKEN_TOOL_NAME, createCliTokenTool } from './tools/mcp.tool.cli-token';
import { createUrlModelsTool } from './tools/mcp.tool.url-models';
import { createMcpDocsSearchTool } from './tools/mcp.tool.docs-search';
import { createMcpDocsReadTool, MCP_DOCS_READ_TOOL_NAME } from './tools/mcp.tool.docs-read';
import { BATCH_EXECUTE_TOOL_NAME, createBatchExecuteTool, batchOperationCoordKey, type BatchOperationAuthorization } from './tools/mcp.tool.batch-execute';

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
 * The factory is invoked per Streamable HTTP request. That is the shape the MCP
 * SDK's 2026-07-28 entry (`createMcpHandler`) requires — it builds a fresh server
 * per request and has no session concept at all — and it is equally what the SDK
 * recommends for stateless 2025-era serving, so one factory backs both eras.
 */
@Injectable()
export class McpServerFactoryService {
  private readonly _logger = new Logger(McpServerFactoryService.name);
  private readonly _toolInputValidator = mcpToolInputValidator({ warn: (message) => this._logger.warn(message) });

  private _cachedTools: McpToolGenerationResult | undefined;
  private _catalog: McpToolCatalog | undefined;
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
    @Optional() @Inject(FirebaseServerStorageService) private readonly storageService?: FirebaseServerStorageService,
    @Optional() @Inject(MCP_MODEL_ROLES_TARGET_UID_PREDICATE) private readonly modelRolesTargetUidPredicate?: McpModelRolesTargetUidPredicate,
    @Optional() @Inject(MCP_CLI_TOKEN_MINTER) private readonly cliTokenMinter?: McpCliTokenMinter,
    @Optional() @Inject(MCP_ADDITIONAL_TOOLS) private readonly additionalTools?: McpAdditionalTools,
    @Optional() @Inject(DocsApiService) private readonly docsService?: DocsApiService
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
    const catalog = this._resolveCatalog();
    const baseServerName = this.mcpConfig.serverName ?? DEFAULT_MCP_SERVER_NAME;
    const serverName = this.mcpConfig.readOnly === true ? `${baseServerName} (read-only)` : baseServerName;

    const scopes = this._resolveScopes(ctx);
    const authRoles = this._resolveAuthRoles(ctx);
    const filterContext = { ctx, scopes, authRoles };
    const { plan, compact } = catalog;
    const visible = this._filterToolsForRequest(plan.methodCandidates, filterContext);
    const promotedVisible = visible.filter((tool) => plan.promoted.has(tool));

    // The batch tool is request-scoped: it authorizes each batched operation against the callModel methods this
    // caller may run directly (every visible method in compact mode; the listed ones in legacy mode).
    const batchTool = this._resolveBatchTool(ctx, compact ? visible : promotedVisible);
    const batchListed: McpToolDefinition[] = batchTool != null && plan.batchPromoted ? [batchTool] : [];
    const view = plan.registry.view(batchTool == null ? visible : [...visible, batchTool]);

    // Method examples come from this caller's visible methods, so the text never names a method they cannot see.
    const methodExamples = resolveMcpToolMethodExamples({ config: catalog.examplesConfig, methods: view.methods });
    const instructions = catalog.compactInstructionsInput == null ? catalog.baseInstructions : `${catalog.baseInstructions}\n\n${buildMcpCompactInstructions({ ...catalog.compactInstructionsInput, examples: methodExamples })}`;

    const server = new McpServer(
      {
        name: serverName,
        version: this.mcpConfig.serverVersion ?? '0.0.0'
      },
      {
        instructions
      }
    );

    server.server.registerCapabilities({ tools: {} });

    const docsSearchTool = catalog.docsSearchTool;
    const standalone = this._filterToolsForRequest(plan.standaloneTools, filterContext).filter((tool) => tool !== docsSearchTool || (this.docsService?.countVisibleDocs(ctx.auth) ?? 0) > 0);
    const listedAsTools = new Set<McpToolDefinition>([...promotedVisible, ...batchListed]);
    const compactTools = compact ? this._buildCompactTools({ catalog, view, ctx, scopes, listedAsTools, examples: methodExamples }) : [];
    const listedTools: ReadonlyArray<McpToolDefinition> = compact ? [...compactTools, ...standalone, ...promotedVisible, ...batchListed] : [...promotedVisible, ...standalone, ...batchListed];
    const definitionsByName = new Map<string, McpToolDefinition>(listedTools.map((tool) => [tool.name, tool]));
    const state: McpRequestToolState = { ctx, catalog, view, definitionsByName, methodExamples };

    server.server.setRequestHandler('tools/list', async () => ({
      // McpToolListEntry types its schemas as opaque `object`: they are read from a manifest file
      // or produced by arktype's JSON Schema export, so the `type: 'object'` root the SDK's wire
      // type mandates holds at runtime but cannot be proven statically. Every schema reaching here
      // either came from arktypeToJsonSchemaForExport or defaulted to `{ type: 'object' }`.
      tools: listedTools.map((tool) => this._buildToolListEntry(tool, { ctx, scopes }, catalog.metaByName.get(tool.name))) as Tool[]
    }));

    server.server.setRequestHandler('tools/call', async (request) => {
      const result = await this._handleToolCall(request, state);
      // Routed calls advertise no output schema of their own, so their (possibly array or primitive) results are
      // projected without one. A no-op on the 2026-07-28 era.
      const listed = catalog.routerKindByName.has(request.params.name) ? undefined : definitionsByName.get(request.params.name);
      return server.server.projectCallToolResult(result, (listed?.outputSchema as Maybe<Readonly<Record<string, unknown>>>) ?? undefined);
    });

    return server;
  }

  /**
   * The resolved compact tool names. `token` is the CLI token tool's name in either mode (`cli-token` when the
   * compact surface is off).
   *
   * @returns The resolved names.
   */
  get compactToolNames(): McpCompactToolNames {
    return this._resolveCatalog().compactNames;
  }

  /**
   * Builds the boot-time tool catalog once: generated tools, built-in methods, the token tool, app-supplied tools,
   * the method registry, the surface plan, and the instructions.
   *
   * @returns The cached catalog.
   * @throws {Error} When the compact surface is on and the tool-name prefix or a compact tool name is invalid.
   */
  private _resolveCatalog(): McpToolCatalog {
    let catalog = this._catalog;

    if (catalog == null) {
      const generation = this._resolveToolDefinitions();
      const toolsConfig = this.mcpConfig.tools;
      const compact = toolsConfig?.compact !== false;
      const methodTools = toolsConfig?.methodTools ?? false;
      const baseServerName = this.mcpConfig.serverName ?? DEFAULT_MCP_SERVER_NAME;
      let resolvedNames: McpCompactToolNames;
      let prefix: string;

      try {
        prefix = this.mcpConfig.toolNamePrefix ?? resolveMcpToolNamePrefix(baseServerName);
        resolvedNames = resolveMcpCompactToolNames({ prefix, names: toolsConfig?.names });
      } catch (error) {
        // Legacy mode never advertises the compact names, so a server name they can't be derived from is fine there.
        if (compact) {
          throw error;
        }

        prefix = 'mcp';
        resolvedNames = resolveMcpCompactToolNames({ prefix });
      }

      const compactNames: McpCompactToolNames = compact ? resolvedNames : { ...resolvedNames, token: CLI_TOKEN_TOOL_NAME };
      const examplesConfig = toolsConfig?.examples;
      const builtins = this._resolveBuiltinMethodTools(prefix, examplesConfig);
      const token = this.cliTokenMinter == null ? undefined : createCliTokenTool({ minter: this.cliTokenMinter, name: compactNames.token });
      const batchName = this.storageService == null ? undefined : BATCH_EXECUTE_TOOL_NAME;
      const docsSearchTool = this._resolveDocsSearchTool({ compact, compactNames, app: prefix });
      const plan = planMcpToolSurface({ compact, methodTools, compactNames, generated: generation.tools, builtins, token, documentation: docsSearchTool, additional: this.additionalTools, batchName });
      const listedDocsSearchTool = docsSearchTool != null && plan.standaloneTools.includes(docsSearchTool) ? docsSearchTool : undefined;

      plan.errors.forEach((line) => this._logger.error(line));
      plan.warnings.forEach((line) => this._logger.warn(line));

      const routerKindByName = new Map<string, McpMethodKind>();
      const metaByName = new Map<string, Record<string, unknown>>();
      let routerTools: Maybe<McpCompactRouterTools>;

      if (compact) {
        routerTools = {
          read: createMcpCompactRouterTool({ name: compactNames.read, kind: 'read', app: prefix, names: compactNames }),
          write: createMcpCompactRouterTool({ name: compactNames.write, kind: 'write', app: prefix, names: compactNames }),
          destructive: createMcpCompactRouterTool({ name: compactNames.destructive, kind: 'destructive', app: prefix, names: compactNames })
        };

        routerKindByName.set(compactNames.read, 'read');
        routerKindByName.set(compactNames.write, 'write');
        routerKindByName.set(compactNames.destructive, 'destructive');

        for (const key of MCP_COMPACT_TOOL_KEYS) {
          metaByName.set(compactNames[key], { [MCP_ALWAYS_LOAD_META_KEY]: true, ...toolsConfig?.meta?.[key] });
        }
      }

      for (const definition of plan.alwaysLoad) {
        metaByName.set(definition.name, { [MCP_ALWAYS_LOAD_META_KEY]: true });
      }

      const baseInstructions = this.mcpConfig.serverInstructions ?? DEFAULT_MCP_SERVER_INSTRUCTIONS;
      let compactInstructionsInput: Maybe<Omit<BuildMcpCompactInstructionsInput, 'examples'>>;

      if (compact && toolsConfig?.instructions !== false) {
        const builtinReadMethods = builtins.filter((tool) => tool.filterMetadata.effectiveReadOnly === true).map((tool) => tool.name);
        compactInstructionsInput = { app: prefix, names: compactNames, builtinReadMethods, hasDocumentation: listedDocsSearchTool != null, hasToken: token != null, methodToolsListed: plan.promoted.size > 0, readOnly: this.mcpConfig.readOnly === true };
      }

      findMcpToolExamplesConfigWarnings({ config: examplesConfig, registry: plan.registry, models: this._cachedManifestModels, enums: this._cachedManifestEnums }).forEach((line) => this._logger.warn(line));

      catalog = {
        compact,
        prefix,
        compactNames,
        plan,
        searchEntries: buildMcpMethodSearchEntries(plan.registry.methods, this._cachedManifestModels),
        routerTools,
        docsSearchTool: listedDocsSearchTool,
        routerKindByName,
        metaByName,
        baseInstructions,
        compactInstructionsInput,
        examplesConfig
      };

      this._catalog = catalog;
      this._logSurfaceSummary(catalog);
    }

    return catalog;
  }

  /**
   * Logs one line describing the advertised surface, so a flipped default or a missing optional injection is visible.
   *
   * @param catalog - The resolved catalog.
   */
  private _logSurfaceSummary(catalog: McpToolCatalog): void {
    const { plan, compact, prefix } = catalog;
    const methods = plan.registry.methods;
    const callModelCount = methods.filter((x) => x.source === 'callModel').length;
    const additionalCount = (this.additionalTools ?? []).length;
    const methodTools = this.mcpConfig.tools?.methodTools;
    const methodToolsLabel = methodTools == null || methodTools === false ? 'off' : `on (${plan.promoted.size} listed)`;
    const compactLabel = compact ? `on (prefix "${prefix}")` : 'off';
    const unsetHint = this.mcpConfig.tools == null ? ' McpModuleConfig.tools is unset, so the compact surface is the default; set tools: { compact: false, methodTools: true } for the legacy per-method tools.' : '';
    this._logger.log(
      `MCP tool surface: compact=${compactLabel}, methodTools=${methodToolsLabel}, ${methods.length} methods (${callModelCount} callModel), ${additionalCount} additional tools, token=${this.cliTokenMinter == null ? 'off' : 'on'}, docs=${this._describeDocs()}, examples=${this._describeExamples()}.${unsetHint}`
    );
  }

  /**
   * Describes where the tool text examples come from, for the surface summary log line.
   *
   * @returns `off`, `configured`, or `derived`.
   */
  private _describeExamples(): string {
    const examples = this.mcpConfig.tools?.examples;
    let result: string;

    if (examples === false) {
      result = 'off';
    } else if (examples != null && Object.values(examples).some((x) => x != null)) {
      result = 'configured';
    } else {
      result = 'derived';
    }

    return result;
  }

  /**
   * Whether the docs tools are offered: a docs service is injected and it loaded at least one doc.
   *
   * @returns True when docs are on.
   */
  private _isDocsOn(): boolean {
    return this.docsService != null && this.docsService.docCount > 0;
  }

  /**
   * Builds the documentation search tool when docs are on.
   *
   * @param input - The surface mode, resolved names, and app label.
   * @param input.compact - Whether the compact surface is on (decides how the tool tells callers to read a doc).
   * @param input.compactNames - The resolved compact names.
   * @param input.app - The app label (the tool-name prefix).
   * @returns The tool, or `undefined` when docs are off.
   */
  private _resolveDocsSearchTool(input: { readonly compact: boolean; readonly compactNames: McpCompactToolNames; readonly app: string }): Maybe<McpToolDefinition> {
    const { compact, compactNames, app } = input;
    const docsService = this.docsService;
    let result: Maybe<McpToolDefinition>;

    if (docsService != null && this._isDocsOn()) {
      const readHint = compact ? `\`${compactNames.read}\` with \`method: "${MCP_DOCS_READ_TOOL_NAME}"\`` : `the \`${MCP_DOCS_READ_TOOL_NAME}\` tool`;
      result = createMcpDocsSearchTool({ name: compactNames.documentation, app, readHint, docsService });
    }

    return result;
  }

  private _describeDocs(): string {
    let result: string;

    if (this.docsService == null) {
      result = 'off (no DocsApiService injected)';
    } else {
      const count = this.docsService.docCount;
      result = count > 0 ? `on (${count} docs)` : 'off (0 docs loaded)';
    }

    return result;
  }

  /**
   * Builds the request-scoped compact tools: `search` and `details` over the caller's visible methods, plus the
   * `read` / `write` / `destructive` routers when at least one visible method can produce a call of that kind (its base
   * kind or an escalating param's kind). Outside `readOnly` mode only: the `write` and `destructive` routers.
   *
   * @param input - The catalog, the caller's visible view, and the request context.
   * @param input.catalog - The resolved catalog.
   * @param input.view - The caller's visible methods.
   * @param input.ctx - The per-request context.
   * @param input.scopes - The caller's granted OIDC scopes.
   * @param input.listedAsTools - The method definitions also listed as their own tools for this request.
   * @returns The compact tools to list, in order.
   */
  private _buildCompactTools(input: { readonly catalog: McpToolCatalog; readonly view: McpMethodView; readonly ctx: McpRequestContext; readonly scopes: Maybe<ReadonlySet<string>>; readonly listedAsTools: ReadonlySet<McpToolDefinition>; readonly examples: McpToolMethodExamples }): McpToolDefinition[] {
    const { catalog, view, scopes, listedAsTools, examples } = input;
    const { compactNames: names, prefix: app, searchEntries: entries, routerTools } = catalog;
    const tools: McpToolDefinition[] = [];

    if (view.methods.length > 0) {
      tools.push(
        createMcpCompactSearchTool({ name: names.search, app, names, entries, view, examples }),
        createMcpCompactDetailsTool({
          name: names.details,
          app,
          names,
          entries,
          view,
          models: this._cachedManifestModels,
          isListedAsTool: (method) => listedAsTools.has(method.definition),
          resolveWireEntry: (definition, ctx) => this._resolveToolWireEntry(definition, { auth: ctx.auth, rawRequest: ctx.rawRequest }, scopes),
          examples
        })
      );
    }

    if (routerTools != null) {
      const kinds = new Set(view.methods.flatMap((method) => mcpMethodKinds(method)));
      const readOnly = this.mcpConfig.readOnly === true;

      if (kinds.has('read')) {
        tools.push(routerTools.read);
      }

      if (!readOnly && kinds.has('write')) {
        tools.push(routerTools.write);
      }

      if (!readOnly && kinds.has('destructive')) {
        tools.push(routerTools.destructive);
      }
    }

    return tools;
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
        result = generateMcpToolDefinitions(apiDetails, undefined, { manifest, naming: this._resolveToolNamingOptions(), defaultRequiredScope: this.mcpConfig.defaultRequiredScope, modelRequiredScopes: this.mcpConfig.modelRequiredScopes });
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
    } else if (skip.reason === 'escalating_params_on_read_only') {
      this._logger.error(`Dropped MCP tool ${skip.toolName} — it is read-only but declares mcp.escalatingParams; a param can't turn a read into a write yet. Set mcp.readOnly: false or remove escalatingParams.`);
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
   * Builds the built-in (non-callModel) method tools, in legacy listing order.
   *
   * Includes `model-get` and `model-roles` whenever {@link ModelApiGetService} is available (plus `url-models` when a
   * route manifest was loaded), `model-info` and `model-decode` whenever the boot-time MCP manifest provided a
   * non-empty `models` catalog, `enum-info` for a non-empty `enums` block, `whoami` for an `auth` block, and
   * `docs-read` when a {@link DocsApiService} loaded at least one doc. The CLI token tool is not a method; the catalog
   * builds it separately.
   *
   * @param app - The app label used in tool descriptions (the tool-name prefix).
   * @returns The built-in method tool definitions.
   */
  private _resolveBuiltinMethodTools(app: string, examplesConfig: Maybe<McpToolExamplesConfig | false>): McpToolDefinition[] {
    // Ensure the manifest has been loaded so its `models` array is available for the catalog tools.
    this._resolveManifest();

    const builtins: McpToolDefinition[] = [];
    const getService = this.modelApiGetService;
    const modelManifest = this._cachedManifestModels;
    const enumManifest = this._cachedManifestEnums;
    const routeManifest = this._resolveRouteManifest();
    const examples: McpToolCatalogExamples = resolveMcpToolCatalogExamples({ config: examplesConfig, models: modelManifest, enums: enumManifest, routeManifest });

    if (getService != null) {
      builtins.push(
        createModelGetTool({
          readDocuments: (modelType, keys, auth) => getService.readDocuments(modelType, keys, auth),
          resolveIdentity: (modelType, auth) => getService.getModelIdentity(modelType, auth),
          resolveIdentityForKey: (key, auth) => getService.getModelIdentityForKey(key, auth),
          ...(modelManifest == null ? {} : { manifest: modelManifest }),
          examples
        }),
        createModelRolesTool({
          readRoleMaps: (params) => getService.readRoleMaps(params),
          resolveIdentity: (modelType, auth) => getService.getModelIdentity(modelType, auth),
          canTargetOtherUids: this.modelRolesTargetUidPredicate,
          examples
        })
      );

      // `url-models` reuses the model-get read/identity path, so it is only offered when the get
      // service is wired AND a route manifest with at least one state was loaded.
      if (routeManifest != null && routeManifest.states.length > 0) {
        builtins.push(
          createUrlModelsTool({
            routeManifest,
            readDocuments: (modelType, keys, auth) => getService.readDocuments(modelType, keys, auth),
            resolveIdentity: (modelType, auth) => getService.getModelIdentity(modelType, auth),
            examples
          })
        );
      }
    }

    if (modelManifest != null && modelManifest.length > 0) {
      builtins.push(createModelInfoTool({ manifest: modelManifest, ...(enumManifest == null ? {} : { enums: enumManifest }) }), createModelDecodeTool({ manifest: modelManifest, examples }));
    }

    // `enum-info` only needs the enum value tables — register it whenever the manifest carries a
    // non-empty `enums` block, independent of the model catalog.
    if (enumManifest != null && Object.keys(enumManifest).length > 0) {
      builtins.push(createEnumInfoTool({ enums: enumManifest, examples }));
    }

    const authManifest = this._cachedManifestAuth;

    if (authManifest != null) {
      builtins.push(createWhoamiTool({ auth: authManifest, roleReader: this.roleReader }));
    }

    if (this._isDocsOn() && this.docsService != null) {
      builtins.push(createMcpDocsReadTool({ app, docsService: this.docsService }));
    }

    return builtins;
  }

  /**
   * Builds the per-request `batch-execute` tool, or `undefined` when it should not be offered.
   *
   * Unlike the cached built-ins this is rebuilt per request, because it closes over the caller's
   * callable methods: each batched operation is authorized against exactly the callModel methods
   * this caller may invoke directly. Offered only when a storage service is wired (it reads
   * the uploaded operations file), the caller is authenticated, and the server is not in read-only
   * mode (the tool performs writes).
   *
   * @param ctx - The per-request context (auth, raw request) forwarded to dispatched operations.
   * @param callable - The method definitions this caller may run directly.
   * @returns The batch tool definition, or `undefined` when unavailable for this request.
   */
  private _resolveBatchTool(ctx: McpRequestContext, callable: Iterable<McpToolDefinition>): Maybe<McpToolDefinition> {
    let result: Maybe<McpToolDefinition>;
    const storageService = this.storageService;

    if (storageService != null && ctx.auth != null && this.mcpConfig.readOnly !== true) {
      const authorizedCoords = new Set<string>();

      for (const definition of callable) {
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
   * loop treats that as "skip scope enforcement", matching the model-api scope gate (`assertModelApiOidcScope`).
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

      if (scopes != null && filterMetadata.requiredScopeTerms != null && !oidcScopeTermsSatisfied(filterMetadata.requiredScopeTerms, scopes)) {
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
   * Resolves the wire-shape entry for a single tool, without the reason parameter.
   *
   * Hot-path short-circuit: tools without a `toolDetailsBuilder` reuse the precomputed, frozen
   * {@link McpToolDefinition.staticWireEntry} verbatim — zero allocations per request for the common case.
   *
   * Tools that opted in to {@link McpToolDetailsBuilder} get a fresh wire entry built from the builder's
   * overrides. If the builder throws, the framework falls back to the static defaults and logs a warning
   * (fail-soft, matching `_passesVisibility`). The compact `details` tool reuses this path.
   *
   * @param tool - The tool definition whose wire entry is being resolved.
   * @param ctx - The per-request context forwarded to any dynamic details builder.
   * @param scopes - The caller's granted OIDC scopes forwarded to any dynamic details builder.
   * @returns The wire-shape entry for this tool.
   */
  private _resolveToolWireEntry(tool: McpToolDefinition, ctx: McpRequestContext, scopes: Maybe<ReadonlySet<string>>): McpToolListEntry {
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

      const wire: { name: string; description: string; inputSchema: object; outputSchema?: object; annotations?: ToolAnnotations } = {
        name: tool.name,
        description,
        inputSchema: inputSchema ?? { type: 'object' }
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
   * Resolves the `tools/list` entry for a single tool: the wire entry from {@link _resolveToolWireEntry}, with the
   * auto-injected reason parameter and any `_meta` hints applied.
   *
   * When the reason parameter is enabled (the default), the entry is no longer returned frozen-verbatim: its
   * `inputSchema` is wrapped with the reason property per request (`tools/list` is low-frequency, so the allocation
   * is acceptable). Tools that already declare the parameter name, or that set `omitReasonParameter`, are reused verbatim.
   *
   * @param tool - The tool definition whose wire entry is being resolved.
   * @param request - The per-request context and OIDC scopes forwarded to any dynamic details builder.
   * @param request.ctx - The per-request context.
   * @param request.scopes - The caller's granted OIDC scopes.
   * @param meta - Optional `_meta` hints for the entry.
   * @returns The wire-shape entry to emit for this tool on `tools/list`.
   */
  private _buildToolListEntry(tool: McpToolDefinition, request: { readonly ctx: McpRequestContext; readonly scopes: Maybe<ReadonlySet<string>> }, meta?: Maybe<Record<string, unknown>>): McpToolListEntry {
    const reasonConfig = this._resolveReasonConfig();
    let result = this._resolveToolWireEntry(tool, request.ctx, request.scopes);

    if (reasonConfig.enabled && tool.omitReasonParameter !== true) {
      const reasoned = applyMcpReasonParameterToSchema(result.inputSchema, reasonConfig);

      // applyMcpReasonParameterToSchema self-skips (returns the same reference) on collision, so the
      // frozen-verbatim hot path still holds for tools that already declare the parameter name.
      if (reasoned !== result.inputSchema) {
        result = { ...result, inputSchema: reasoned };
      }
    }

    if (meta != null) {
      result = { ...result, _meta: meta };
    }

    return result;
  }

  /**
   * Central dispatch point for every MCP tool call. Runs the underlying handler — a routed compact `read` / `write`
   * call, callModel, static, or unknown-tool — then emits a single analytics event on completion so every call
   * is tracked uniformly.
   *
   * Success vs error is decided by the resolved outcome: an outcome that carries a thrown
   * error, or a response flagged `isError`, counts as a failure. The original thrown error
   * (when present) is forwarded on the event. For routed calls the event describes the executed method.
   *
   * @param request - The `tools/call` request carrying the tool name and arguments.
   * @param state - The per-request tool state (listed definitions, visible methods, context).
   * @returns The MCP tool response.
   */
  private async _handleToolCall(request: McpCallToolRequest, state: McpRequestToolState): Promise<CallToolResult> {
    const { ctx, catalog, view, definitionsByName } = state;
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
    const routerKind = definition == null ? undefined : catalog.routerKindByName.get(toolName);

    let outcome: McpToolCallOutcome;
    let executed: Maybe<McpToolDefinition> = definition;
    let routed: Maybe<McpRoutedCallResult>;

    if (definition == null) {
      outcome = { response: formatMcpToolErrorResponse(new Error(this._describeUnknownTool(toolName, catalog, view))) as CallToolResult };
    } else if (routerKind != null) {
      routed = await this._handleRoutedToolCall({ kind: routerKind, args, state });
      outcome = routed.outcome;
      executed = routed.method?.definition;
    } else if (definition.staticHandler == null) {
      outcome = await this._handleCallModelToolCall(definition, args, ctx);
    } else {
      outcome = await this._handleStaticToolCall(definition, args, ctx);
    }

    const isSuccessful = outcome.error == null && outcome.response.isError !== true;

    // Unknown tools never reached a handler; classify as 'static' since no callModel dispatch occurred.
    const toolKind: McpAnalyticsEvent['toolKind'] = executed != null && executed.staticHandler == null ? 'callModel' : 'static';

    this._emitMcpAnalytics({
      event: toolName,
      toolName,
      toolKind,
      call: executed?.dispatch.call,
      modelType: executed?.dispatch.modelType,
      specifier: executed?.dispatch.specifier,
      uid: ctx.auth?.uid,
      auth: ctx.auth,
      readOnly: this.mcpConfig.readOnly === true,
      args: routed == null ? args : routed.params,
      reason: reason ?? routed?.innerReason,
      isSuccessful,
      error: outcome.error,
      durationMs: Date.now() - startedAt,
      ...(routed == null ? undefined : { routed: true, method: routed.method?.id, ...(routed.method == null ? { requestedMethod: routed.requestedMethod } : undefined) })
    });

    return outcome.response;
  }

  /**
   * Describes an unknown tool. When the compact surface is on and the name resolves to a visible method (a stale
   * client calling a legacy per-method tool name), the message says which compact tool to call instead.
   *
   * @param toolName - The requested tool name.
   * @param catalog - The resolved catalog.
   * @param view - The caller's visible methods.
   * @returns The error message.
   */
  private _describeUnknownTool(toolName: string, catalog: McpToolCatalog, view: McpMethodView): string {
    const method = catalog.compact ? view.resolve(toolName) : undefined;
    const routerName = method == null ? undefined : catalog.compactNames[method.kind];
    return method == null ? `Unknown tool: ${toolName}` : `Unknown tool: ${toolName}. It is now a method: call \`${routerName}\` with \`method: '${method.id}'\`.`;
  }

  /**
   * Runs a call to a compact `read` / `write` / `destructive` router: validates the arguments, resolves the method in
   * the caller's visible view, checks the call's kind (the method's base kind raised by any escalating param the params
   * set) against the router, then runs it like a direct call with `params` as its arguments.
   *
   * @param input - The router kind, the reason-stripped router arguments, and the request state.
   * @param input.kind - The router's kind.
   * @param input.args - The router arguments, outer reason already stripped.
   * @param input.state - The per-request tool state.
   * @returns The outcome plus the resolved method and its params.
   */
  private async _handleRoutedToolCall(input: { readonly kind: McpMethodKind; readonly args: Record<string, unknown>; readonly state: McpRequestToolState }): Promise<McpRoutedCallResult> {
    const { kind, args, state } = input;
    const { catalog, view, ctx } = state;
    const requestedMethod = typeof args['method'] === 'string' ? args['method'] : undefined;
    const extraKeys = Object.keys(args).filter((key) => key !== 'method' && key !== 'params');
    let params: unknown = args['params'];
    let errorMessage: Maybe<string>;
    let method: Maybe<McpMethod>;
    let inner: Maybe<ReturnType<typeof extractMcpReasonFromArgs>>;

    if (typeof params === 'string') {
      try {
        params = JSON.parse(params);
      } catch {
        errorMessage = '`params` must be an object (or a JSON object string).';
      }
    }

    if (errorMessage == null) {
      if (requestedMethod == null || requestedMethod.trim().length === 0) {
        const exampleMethodId = input.state.methodExamples.methodIdByKind[kind];
        errorMessage = `\`method\` is required: pass a method id from \`${catalog.compactNames.search}\` and its \`params\`${exampleMethodId ? `, e.g. \`{ method: '${exampleMethodId}', params: { … } }\`` : ''}.`;
      } else if (extraKeys.length > 0) {
        const quoted = extraKeys.map((x) => `\`${x}\``).join(', ');
        errorMessage = `Unexpected argument(s) ${quoted}: put the method's arguments in \`params\`.`;
      } else if (params != null && (typeof params !== 'object' || Array.isArray(params))) {
        errorMessage = '`params` must be an object (or a JSON object string).';
      } else {
        method = view.resolve(requestedMethod);

        if (method == null) {
          const suggestions = suggestMcpMethods({ entries: catalog.searchEntries, view, name: requestedMethod });
          const quoted = suggestions.map((x) => `\`${x}\``).join(', ');
          const hint = suggestions.length > 0 ? ` Did you mean: ${quoted}?` : ` Use \`${catalog.compactNames.search}\` to find methods.`;
          errorMessage = `Unknown method: ${requestedMethod}.${hint}`;
        } else {
          // A stray params-level reason is used as a fallback analytics reason, unless the method owns that field.
          // Extracted before the kind check so it sees exactly the args the handler would get.
          const reasonConfig = this._resolveReasonConfig();
          const declaresOwn = mcpSchemaDeclaresProperty(method.definition.inputSchema, reasonConfig.parameterName);
          inner = extractMcpReasonFromArgs((params ?? {}) as Record<string, unknown>, reasonConfig, declaresOwn);
          const call = mcpMethodKindForCall(method, inner.args);

          if (call.kind !== kind) {
            errorMessage = describeMcpCompactRouterMismatch({ method, call, names: catalog.compactNames });
            method = undefined;
          }
        }
      }
    }

    let result: McpRoutedCallResult;

    if (method == null || inner == null) {
      result = { outcome: { response: formatMcpToolErrorResponse(new Error(errorMessage ?? `Unknown method: ${requestedMethod}`)) as CallToolResult }, requestedMethod, params: {} };
    } else {
      const target = method.definition;
      const outcome = target.staticHandler == null ? await this._handleCallModelToolCall(target, inner.args, ctx) : await this._handleStaticToolCall(target, inner.args, ctx);
      result = { outcome, method, requestedMethod, params: inner.args, innerReason: inner.reason };
    }

    return result;
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

  /**
   * Runs a statically-registered tool's handler, first checking its args against the tool's
   * `inputSchema` unless the tool opted out with `validateInput: false`. A failure returns the
   * `VALIDATION_ERROR` naming each failing field, and the handler does not run.
   *
   * @param definition - The static tool definition; its `staticHandler` must be set.
   * @param args - The call args, with the reason parameter already stripped.
   * @param ctx - The per-request context.
   * @returns The tool call outcome.
   */
  private async _handleStaticToolCall(definition: McpToolDefinition, args: Record<string, unknown>, ctx: McpRequestContext): Promise<McpToolCallOutcome> {
    const staticHandler = definition.staticHandler as McpStaticToolHandler;
    let outcome: McpToolCallOutcome;

    try {
      if (definition.validateInput !== false && definition.inputSchema != null) {
        const summary = this._toolInputValidator.validate(definition.inputSchema, args);

        if (summary != null) {
          throw firebaseServerValidationErrorForSummary(summary);
        }
      }

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
 * The `read` / `write` / `destructive` router shells, built once at boot.
 */
interface McpCompactRouterTools {
  readonly read: McpToolDefinition;
  readonly write: McpToolDefinition;
  readonly destructive: McpToolDefinition;
}

/**
 * Boot-time tool catalog, built once by `_resolveCatalog`.
 */
interface McpToolCatalog {
  readonly compact: boolean;
  readonly prefix: string;
  readonly compactNames: McpCompactToolNames;
  readonly plan: McpToolSurfacePlan;
  readonly searchEntries: McpMethodSearchEntries;
  readonly routerTools: Maybe<McpCompactRouterTools>;
  /**
   * The documentation search tool when it is listed; filtered per request to callers who can see at least one doc.
   */
  readonly docsSearchTool: Maybe<McpToolDefinition>;
  /**
   * Router tool names to their kind. Only routers are routed; every other listed tool runs directly.
   */
  readonly routerKindByName: ReadonlyMap<string, McpMethodKind>;
  /**
   * `_meta` hints per listed tool name.
   */
  readonly metaByName: ReadonlyMap<string, Record<string, unknown>>;
  /**
   * The server instructions before the compact usage block.
   */
  readonly baseInstructions: string;
  /**
   * The compact usage block input, minus the per-request examples. Undefined when compact mode is off or
   * `tools.instructions` is `false`.
   */
  readonly compactInstructionsInput: Maybe<Omit<BuildMcpCompactInstructionsInput, 'examples'>>;
  /**
   * The configured `tools.examples`.
   */
  readonly examplesConfig: Maybe<McpToolExamplesConfig | false>;
}

/**
 * Per-request state shared by the `tools/call` handler.
 */
interface McpRequestToolState {
  readonly ctx: McpRequestContext;
  readonly catalog: McpToolCatalog;
  /**
   * The caller's visible methods. Routed calls resolve only within this view.
   */
  readonly view: McpMethodView;
  readonly definitionsByName: ReadonlyMap<string, McpToolDefinition>;
  /**
   * Examples drawn from the caller's visible methods.
   */
  readonly methodExamples: McpToolMethodExamples;
}

/**
 * Result of a routed compact `read` / `write` call.
 */
interface McpRoutedCallResult {
  readonly outcome: McpToolCallOutcome;
  /**
   * The resolved method, or `undefined` when it could not be resolved or was the wrong kind.
   */
  readonly method?: McpMethod;
  readonly requestedMethod?: string;
  /**
   * The method arguments (the inner `params`, reason stripped).
   */
  readonly params: Record<string, unknown>;
  readonly innerReason?: Maybe<string>;
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
