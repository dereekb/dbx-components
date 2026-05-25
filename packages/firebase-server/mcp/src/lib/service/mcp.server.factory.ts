import { Injectable, Inject, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type Request } from 'express';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { ModelApiCallModelDispatchService } from '@dereekb/firebase-server';
import { McpModuleConfig, DEFAULT_MCP_SERVER_NAME } from '../mcp.config';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
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

  constructor(
    @Inject(McpModuleConfig) private readonly mcpConfig: McpModuleConfig,
    @Inject(ModelApiCallModelDispatchService) private readonly dispatchService: ModelApiCallModelDispatchService
  ) {}

  /**
   * Builds a configured MCP server with tool listing + dispatch handlers wired up.
   *
   * @param ctx - The per-request context (auth, raw request) used when forwarding tool calls.
   * @returns A configured MCP server ready to be `connect()`-ed to a transport.
   */
  createServer(ctx: McpRequestContext): McpServer {
    const server = new McpServer(
      {
        name: this.mcpConfig.serverName ?? DEFAULT_MCP_SERVER_NAME,
        version: this.mcpConfig.serverVersion ?? '0.0.0'
      },
      {
        instructions: 'Model-bound RPC tools generated from the callModel _apiDetails tree.'
      }
    );

    server.server.registerCapabilities({ tools: {} });

    const toolGeneration = this._resolveToolDefinitions();
    const definitionsByName = new Map<string, McpToolDefinition>(toolGeneration.tools.map((tool) => [tool.name, tool]));

    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolGeneration.tools.map((tool) => ({
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
