import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { type FirestoreModelIdentity, type OnCallTypedModelParams } from '@dereekb/firebase';
import { type FirebaseServerAuthData, type ModelApiDetailsResult } from '@dereekb/firebase-server';
import { McpServerFactoryService } from './mcp.server.factory';
import { ROUTE_MANIFEST_VERSION, type RouteManifest } from './mcp.route-manifest';
import { type McpModuleConfig } from '../mcp.config';

function makeMcpConfig(overrides: Partial<McpModuleConfig> = {}): McpModuleConfig {
  return { oidcIssuer: 'https://example.test/oidc', mcpUrl: 'https://example.test/mcp', serverName: 'test-mcp', serverVersion: '0.0.1', ...overrides } as McpModuleConfig;
}

function makeDispatchService(): unknown {
  return {
    getApiDetails: (): ModelApiDetailsResult => ({ models: {} }),
    dispatch: async (_params: OnCallTypedModelParams) => ({ ok: true })
  };
}

function makeGetService(): unknown {
  return {
    readDocuments: async () => ({ results: [], errors: [] }),
    getModelIdentity: (modelType: string): FirestoreModelIdentity => ({ type: 'root', modelType, collectionName: modelType, collectionType: modelType })
  };
}

function makeFactory(options: { config?: Partial<McpModuleConfig>; withGetService?: boolean } = {}): McpServerFactoryService {
  const getService = options.withGetService === false ? undefined : makeGetService();
  return new McpServerFactoryService(makeMcpConfig(options.config), makeDispatchService() as any, getService as any);
}

function writeRouteManifest(manifest: { version: number; states?: RouteManifest['states'] }): string {
  const dir = mkdtempSync(join(tmpdir(), 'route-manifest-'));
  const path = join(dir, 'route.manifest.json');
  writeFileSync(path, JSON.stringify({ generatedAt: '2026-01-01T00:00:00.000Z', app: { name: 'demo' }, states: [], ...manifest }));
  return path;
}

const STATES: RouteManifest['states'] = [{ name: 'guestbook.list', url: '/guestbook', fullUrl: '/guestbook', paramKeys: [], urlParamKeys: [], models: [] }];

function firebaseAuth(): FirebaseServerAuthData {
  return { uid: 'user-1', token: { uid: 'user-1' } } as unknown as FirebaseServerAuthData;
}

async function listTools(factory: McpServerFactoryService, auth?: FirebaseServerAuthData): Promise<ReadonlyArray<string>> {
  const server = factory.createServer({ rawRequest: {} as any, auth });
  const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<{ tools: ReadonlyArray<{ name: string }> }>>;
  const result = await handlers.get(ListToolsRequestSchema.shape.method.value)!({ method: 'tools/list', params: {} }, {} as any);
  return result.tools.map((t) => t.name);
}

describe('McpServerFactoryService url-models gating', () => {
  it('registers url-models when a route manifest with states + the get service are present (authenticated)', async () => {
    const path = writeRouteManifest({ version: ROUTE_MANIFEST_VERSION, states: STATES });
    const tools = await listTools(makeFactory({ config: { mcpRouteManifestPath: path } }), firebaseAuth());
    expect(tools).toContain('url-models');
  });

  it('hides url-models from unauthenticated callers', async () => {
    const path = writeRouteManifest({ version: ROUTE_MANIFEST_VERSION, states: STATES });
    const tools = await listTools(makeFactory({ config: { mcpRouteManifestPath: path } }));
    expect(tools).not.toContain('url-models');
  });

  it('does not register url-models when no route manifest path is configured', async () => {
    const tools = await listTools(makeFactory(), firebaseAuth());
    expect(tools).not.toContain('url-models');
  });

  it('does not register url-models when the get service is unavailable', async () => {
    const path = writeRouteManifest({ version: ROUTE_MANIFEST_VERSION, states: STATES });
    const tools = await listTools(makeFactory({ config: { mcpRouteManifestPath: path }, withGetService: false }), firebaseAuth());
    expect(tools).not.toContain('url-models');
  });

  it('does not register url-models when the manifest has no states', async () => {
    const path = writeRouteManifest({ version: ROUTE_MANIFEST_VERSION, states: [] });
    const tools = await listTools(makeFactory({ config: { mcpRouteManifestPath: path } }), firebaseAuth());
    expect(tools).not.toContain('url-models');
  });

  it('warns and skips when the route manifest version does not match', async () => {
    const path = writeRouteManifest({ version: 999, states: STATES });
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const tools = await listTools(makeFactory({ config: { mcpRouteManifestPath: path } }), firebaseAuth());
      expect(tools).not.toContain('url-models');
      expect(warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('version mismatch'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('warns and skips when the route manifest file is missing', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const tools = await listTools(makeFactory({ config: { mcpRouteManifestPath: join(tmpdir(), 'definitely-missing-route.manifest.json') } }), firebaseAuth());
      expect(tools).not.toContain('url-models');
      expect(warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('the file is missing'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
