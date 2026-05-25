import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type Request } from 'express';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { getOidcScopesFromRequest } from '@dereekb/firebase-server/oidc';
import { authRolesSetHasRoles, type AuthClaims, type AuthRoleSet, type Maybe } from '@dereekb/util';
import { ModelApiCallModelDispatchService, type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { McpModuleConfig, DEFAULT_MCP_SERVER_NAME, MCP_AUTH_ROLE_READER, type McpAuthRoleReader } from '../mcp.config';
import { formatMcpToolErrorResponse, formatMcpToolResponse } from './mcp.response-formatter';
import { generateMcpToolDefinitions, type McpToolDefinition, type McpToolGenerationResult } from './mcp.tool-generator';

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
  private _loggedSkips = false;
  private _warnedMissingRoleReader = false;

  constructor(
    @Inject(McpModuleConfig) private readonly mcpConfig: McpModuleConfig,
    @Inject(ModelApiCallModelDispatchService) private readonly dispatchService: ModelApiCallModelDispatchService,
    @Optional() @Inject(MCP_AUTH_ROLE_READER) private readonly roleReader?: McpAuthRoleReader
  ) {}

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
        instructions: 'Model-bound RPC tools generated from the callModel _apiDetails tree.'
      }
    );

    server.server.registerCapabilities({ tools: {} });

    const toolGeneration = this._resolveToolDefinitions();
    const scopes = this._resolveScopes(ctx);
    const authRoles = this._resolveAuthRoles(ctx);
    const visibleTools = this._filterToolsForRequest(toolGeneration.tools, { ctx, scopes, authRoles });
    const definitionsByName = new Map<string, McpToolDefinition>(visibleTools.map((tool) => [tool.name, tool]));

    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: visibleTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema ?? { type: 'object' }
      }))
    }));

    server.server.setRequestHandler(CallToolRequestSchema, async (request) => this._handleToolCall(request, definitionsByName, ctx));

    return server;
  }

  /**
   * Reads cached tool definitions, regenerating + logging skips on first call.
   *
   * The underlying call model `_apiDetails` is built at boot and doesn't change at runtime,
   * so the generation result is safe to cache for the lifetime of the process.
   */
  private _resolveToolDefinitions(): McpToolGenerationResult {
    let result = this._cachedTools;

    if (result == null) {
      const apiDetails = this.dispatchService.getApiDetails();

      if (apiDetails == null) {
        result = { tools: [], neverVisibleTools: [], skipped: [] };
      } else {
        result = generateMcpToolDefinitions(apiDetails);
      }

      this._cachedTools = result;
    }

    if (!this._loggedSkips && result.skipped.length > 0) {
      this._loggedSkips = true;
      for (const skip of result.skipped) {
        this._logger.warn(`Skipped MCP tool ${skip.toolName} (${skip.reason})${skip.error ? `: ${skip.error.message}` : ''}`);
      }
    }

    return result;
  }

  /**
   * Reads the caller's OIDC scopes from the raw Express request via the auth context.
   *
   * Synthesizes the same `{ auth: { token } }` shape that `getOidcScopesFromRequest`
   * expects post-dispatch, so the upstream helper stays the single source of scope parsing.
   * Returns `undefined` for non-OIDC callers (no `oidcValidatedToken.scope`) — the filter
   * loop treats that as "skip scope enforcement", matching `oidcCallModelScopePreAssert`.
   */
  private _resolveScopes(ctx: McpRequestContext): Maybe<ReadonlySet<string>> {
    const oidcValidatedToken = (ctx.auth as { oidcValidatedToken?: unknown } | undefined)?.oidcValidatedToken;
    const result = oidcValidatedToken == null ? undefined : getOidcScopesFromRequest({ auth: { token: oidcValidatedToken } });
    return result;
  }

  /**
   * Maps the caller's Firebase custom claims through the optional role reader.
   * Emits one boot-time warning when a declarative `requiredRoles` rule will be checked
   * but no reader is wired — that path will fail closed.
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

      if (!this._passesVisibility(tool, ctx, scopes, authRoles)) {
        continue;
      }

      visible.push(tool);
    }

    return visible;
  }

  private _passesVisibility(tool: McpToolDefinition, ctx: McpRequestContext, scopes: Maybe<ReadonlySet<string>>, authRoles: Maybe<AuthRoleSet>): boolean {
    const { filterMetadata } = tool;
    let result: boolean;

    if (filterMetadata.visibilityKind === 'declarative') {
      result = this._checkDeclarativeVisibility(filterMetadata.rule!, ctx, authRoles);
    } else if (filterMetadata.visibilityKind === 'dynamic') {
      try {
        result = filterMetadata.visibilityFn!({ auth: ctx.auth, scopes: scopes ?? undefined, tool: tool.dispatch }) === true;
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

  private async _handleToolCall(request: { params: { name: string; arguments?: Record<string, unknown> } }, definitionsByName: Map<string, McpToolDefinition>, ctx: McpRequestContext): Promise<CallToolResult> {
    const definition = definitionsByName.get(request.params.name);
    let response: CallToolResult;

    if (definition == null) {
      response = formatMcpToolErrorResponse(new Error(`Unknown tool: ${request.params.name}`)) as CallToolResult;
    } else {
      const params: OnCallTypedModelParams = {
        call: definition.dispatch.call,
        modelType: definition.dispatch.modelType,
        specifier: definition.dispatch.specifier,
        data: request.params.arguments ?? {}
      };

      try {
        const result = await this.dispatchService.dispatch(params, ctx.auth, ctx.rawRequest);
        response = formatMcpToolResponse(result, params, definition.details) as CallToolResult;
      } catch (error) {
        response = formatMcpToolErrorResponse(error) as CallToolResult;
      }
    }

    return response;
  }
}
