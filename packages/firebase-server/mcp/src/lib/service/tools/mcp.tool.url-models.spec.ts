import { type FirestoreModelIdentity } from '@dereekb/firebase';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createUrlModelsTool, URL_MODELS_TOOL_NAME, type CreateUrlModelsToolDeps } from './mcp.tool.url-models';
import { ROUTE_MANIFEST_VERSION, type RouteManifest } from '../mcp.route-manifest';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';

function makeIdentity(modelType: string, collectionName: string, type: 'root' | 'nested' = 'root'): FirestoreModelIdentity {
  return {
    type,
    modelType,
    collectionName,
    collectionType: type === 'root' ? collectionName : `parent/${collectionName}`
  };
}

function makeCtx(uid?: string): McpStaticToolHandlerContext {
  return { rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'], ...(uid === undefined ? {} : { auth: { uid } as McpStaticToolHandlerContext['auth'] }) };
}

const IDENTITIES: Record<string, FirestoreModelIdentity | undefined> = {
  profile: makeIdentity('profile', 'pr'),
  account: makeIdentity('account', 'ac'),
  entries: makeIdentity('entries', 'en', 'nested'),
  ghost: undefined
};

function manifest(): RouteManifest {
  return {
    version: ROUTE_MANIFEST_VERSION,
    generatedAt: '2026-01-01T00:00:00.000Z',
    app: { name: 'demo' },
    states: [
      {
        name: 'worker.user',
        url: '/:uid',
        fullUrl: '/worker/:uid',
        paramKeys: [],
        urlParamKeys: ['uid'],
        component: 'WorkerComponent',
        componentFile: 'apps/x/src/worker.component.ts',
        models: [
          { modelType: 'profile', kind: 'id', keyTemplate: ':uid', description: 'The profile' },
          { modelType: 'account', kind: 'id', keyTemplate: '{authUid}' },
          { modelType: 'worker', kind: 'key', keyTemplate: 'wkr/:uid', from: 'worker' },
          { modelType: 'entries', kind: 'id', keyTemplate: ':uid' },
          { modelType: 'ghost', kind: 'id', keyTemplate: ':uid' },
          { modelType: 'weird', kind: 'id', keyTemplate: ':other' },
          { modelType: 'things', kind: 'list' }
        ]
      },
      { name: 'guestbook.list', url: '/guestbook', fullUrl: '/guestbook', paramKeys: [], urlParamKeys: [], models: [] }
    ]
  };
}

function makeDeps(overrides: Partial<CreateUrlModelsToolDeps> = {}): CreateUrlModelsToolDeps {
  return {
    routeManifest: manifest(),
    readDocuments: async (modelType, keys) => ({ results: keys.map((key) => ({ key, data: { modelType } })), errors: [] }),
    resolveIdentity: (modelType) => IDENTITIES[modelType],
    ...overrides
  };
}

interface MatchedPayload {
  readonly matched: {
    readonly state: { readonly name: string; readonly componentFile: string };
    readonly via: string;
    readonly params: Record<string, string>;
    readonly models: ReadonlyArray<{ readonly modelType: string; readonly kind: string; readonly key?: string; readonly description?: string; readonly from?: string; readonly unresolved?: { readonly reason: string } }>;
    readonly loaded?: ReadonlyArray<{ readonly modelType: string; readonly results: ReadonlyArray<{ key: string }> }>;
  } | null;
  readonly candidates?: ReadonlyArray<{ readonly name: string }>;
  readonly ambiguous?: ReadonlyArray<{ readonly name: string }>;
}

function payload(result: CallToolResult): MatchedPayload {
  return result.structuredContent as unknown as MatchedPayload;
}

function modelOf(p: MatchedPayload, modelType: string) {
  const found = p.matched?.models.find((m) => m.modelType === modelType);
  if (found == null) {
    throw new Error(`model ${modelType} not found`);
  }
  return found;
}

describe('createUrlModelsTool', () => {
  it('exposes the static tool with the expected metadata', () => {
    const tool = createUrlModelsTool(makeDeps());
    expect(tool.name).toBe(URL_MODELS_TOOL_NAME);
    expect(tool.dispatch).toEqual({ call: 'url-models', modelType: 'route' });
    expect(tool.filterMetadata.effectiveReadOnly).toBe(true);
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(tool.staticWireEntry.annotations).toEqual({ readOnlyHint: true });
    expect(tool.filterMetadata.visibilityKind).toBe('declarative');
    if (tool.filterMetadata.visibilityKind === 'declarative') {
      expect(tool.filterMetadata.rule.requireAuthenticated).toBe(true);
    }
  });

  it('resolves id, key, authUid, list, and unresolved bindings for a matched page', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: 'https://app.demo.co/worker/abc' }, makeCtx('user-1'));
    const p = payload(result);

    expect(result.isError).toBeUndefined();
    expect(p.matched?.state.name).toBe('worker.user');
    expect(p.matched?.via).toBe('param');
    expect(p.matched?.params).toEqual({ uid: 'abc' });

    expect(modelOf(p, 'profile').key).toBe('pr/abc');
    expect(modelOf(p, 'account').key).toBe('ac/user-1');
    expect(modelOf(p, 'worker').key).toBe('wkr/abc');
    expect(modelOf(p, 'entries').unresolved?.reason).toBe('subcollection-requires-key-template');
    expect(modelOf(p, 'ghost').unresolved?.reason).toBe('unknown-model-type');
    expect(modelOf(p, 'weird').unresolved?.reason).toBe('missing-param');
    const things = modelOf(p, 'things');
    expect(things.kind).toBe('list');
    expect(things.key).toBeUndefined();
  });

  it('reports auth-required when {authUid} is needed but the caller is unauthenticated', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: '/worker/abc' }, makeCtx());
    expect(modelOf(payload(result), 'account').unresolved?.reason).toBe('auth-required');
  });

  it('overrides {authUid} with currentUserUid to preview another user (route params unaffected)', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: '/worker/abc', currentUserUid: 'user-2' }, makeCtx('user-1'));
    const p = payload(result);
    // `{authUid}` resolves to the supplied user-2, not the caller user-1.
    expect(modelOf(p, 'account').key).toBe('ac/user-2');
    // The `:uid` route param is captured from the URL, so it is unchanged.
    expect(modelOf(p, 'profile').key).toBe('pr/abc');
  });

  it('rejects an empty currentUserUid', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: '/worker/abc', currentUserUid: '' }, makeCtx('user-1'));
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('currentUserUid');
  });

  it('filters to the requested model types', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: '/worker/abc', models: ['profile'] }, makeCtx('user-1'));
    const p = payload(result);
    expect(p.matched?.models.map((m) => m.modelType)).toEqual(['profile']);
  });

  it('drops descriptions and from in keysOnly mode', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: '/worker/abc', keysOnly: true }, makeCtx('user-1'));
    const profile = modelOf(payload(result), 'profile');
    expect(profile.key).toBe('pr/abc');
    expect(profile.description).toBeUndefined();
    const worker = modelOf(payload(result), 'worker');
    expect(worker.from).toBeUndefined();
  });

  it('loads resolved documents grouped by model type when load=true', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: '/worker/abc', load: true }, makeCtx('user-1'));
    const loaded = payload(result).matched?.loaded;
    expect(loaded?.map((g) => g.modelType).sort((a, b) => a.localeCompare(b))).toEqual(['account', 'profile', 'worker']);
    expect(loaded?.find((g) => g.modelType === 'profile')?.results[0].key).toBe('pr/abc');
  });

  it('errors when load and keysOnly are combined', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: '/worker/abc', load: true, keysOnly: true }, makeCtx('user-1'));
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('cannot be combined');
  });

  it('returns matched:null with candidates (not an error) when nothing matches', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({ url: '/worker/abc/extra/deep' }, makeCtx('user-1'));
    const p = payload(result);
    expect(result.isError).toBeUndefined();
    expect(p.matched).toBeNull();
    expect(p.candidates?.some((c) => c.name === 'worker.user')).toBe(true);
  });

  it('errors on missing url', async () => {
    const tool = createUrlModelsTool(makeDeps());
    const result = await tool.staticHandler!({}, makeCtx('user-1'));
    expect(result.isError).toBe(true);
  });
});
