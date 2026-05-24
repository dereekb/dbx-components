import { McpServerFactoryService } from './mcp.server.factory';
import { McpModuleConfig } from '../mcp.config';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { type ModelApiDetailsResult } from '@dereekb/firebase-server';

function makeSchemaRef(name: string) {
  return {
    toJsonSchema: () => ({ type: 'object', title: name })
  };
}

function makeMcpConfig(): McpModuleConfig {
  return {
    oidcIssuer: 'https://example.test/oidc',
    mcpUrl: 'https://example.test/mcp',
    serverName: 'test-mcp',
    serverVersion: '0.0.1'
  };
}

function makeDispatchService(apiDetails: ModelApiDetailsResult, dispatch: (params: OnCallTypedModelParams) => unknown) {
  return {
    getApiDetails: () => apiDetails,
    dispatch: async (params: OnCallTypedModelParams) => dispatch(params)
  } as any;
}

describe('McpServerFactoryService.createServer', () => {
  it('registers tools/list and returns one tool per generated definition', async () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        storageFile: {
          calls: {
            invoke: {
              isSpecifier: true,
              specifiers: {
                recomputeChecksums: { inputType: makeSchemaRef('RecomputeChecksumsParams') }
              }
            }
          }
        }
      }
    };

    const factory = new McpServerFactoryService(
      makeMcpConfig(),
      makeDispatchService(apiDetails, () => ({ ran: true }))
    );
    const server = factory.createServer({ rawRequest: {} as any });

    const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
    const listHandler = handlers.get(ListToolsRequestSchema.shape.method.value);
    expect(listHandler).toBeDefined();

    const listResult = (await listHandler!({ method: 'tools/list', params: {} }, {} as any)) as { tools: ReadonlyArray<{ name: string }> };
    expect(listResult.tools.map((t) => t.name)).toEqual(['storageFile-invoke-recomputeChecksums']);
  });

  it('routes tools/call back through the dispatch service with the right params', async () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        storageFile: {
          calls: {
            invoke: {
              isSpecifier: true,
              specifiers: {
                recomputeChecksums: { inputType: makeSchemaRef('RecomputeChecksumsParams') }
              }
            }
          }
        }
      }
    };

    let receivedParams: OnCallTypedModelParams | undefined;
    const factory = new McpServerFactoryService(
      makeMcpConfig(),
      makeDispatchService(apiDetails, (params) => {
        receivedParams = params;
        return { ran: true };
      })
    );

    const server = factory.createServer({ rawRequest: {} as any });
    const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
    const callHandler = handlers.get(CallToolRequestSchema.shape.method.value);
    expect(callHandler).toBeDefined();

    const callResult = (await callHandler!(
      {
        method: 'tools/call',
        params: {
          name: 'storageFile-invoke-recomputeChecksums',
          arguments: { foo: 1 }
        }
      },
      {} as any
    )) as { isError?: boolean; structuredContent?: unknown };

    expect(callResult.isError).toBeUndefined();
    expect(callResult.structuredContent).toEqual({ ran: true });
    expect(receivedParams).toEqual({
      call: 'invoke',
      modelType: 'storageFile',
      specifier: 'recomputeChecksums',
      data: { foo: 1 }
    });
  });

  it('returns an isError response when the tool name is unknown', async () => {
    const factory = new McpServerFactoryService(
      makeMcpConfig(),
      makeDispatchService({ models: {} }, () => undefined)
    );
    const server = factory.createServer({ rawRequest: {} as any });

    const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
    const callHandler = handlers.get(CallToolRequestSchema.shape.method.value);

    const result = (await callHandler!({ method: 'tools/call', params: { name: 'missing-tool', arguments: {} } }, {} as any)) as { isError?: boolean; content: ReadonlyArray<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Unknown tool');
  });
});
