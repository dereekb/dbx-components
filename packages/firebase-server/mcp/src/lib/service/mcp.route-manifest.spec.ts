import { matchRouteManifestUrl, parseUrlModelsPathname, ROUTE_MANIFEST_VERSION, type RouteManifest } from './mcp.route-manifest';

function manifest(states: RouteManifest['states']): RouteManifest {
  return { version: ROUTE_MANIFEST_VERSION, generatedAt: '2026-01-01T00:00:00.000Z', app: { name: 'hellosubs' }, states };
}

const WORKER_MANIFEST = manifest([
  { name: 'worker', url: '/worker', fullUrl: '/worker', abstract: true, paramKeys: [], urlParamKeys: [], models: [] },
  { name: 'worker.user', url: '/:uid', fullUrl: '/worker/:uid', paramKeys: [], urlParamKeys: ['uid'], models: [{ modelType: 'profile', kind: 'id', keyTemplate: ':uid' }] },
  { name: 'worker.user.timesheets.list', url: '/list', fullUrl: '/worker/:uid/timesheets/list', paramKeys: [], urlParamKeys: ['uid'], models: [{ modelType: 'jobWorkerTimesheet', kind: 'list' }] },
  { name: 'guestbook.list', url: '/guestbook', fullUrl: '/guestbook', paramKeys: [], urlParamKeys: [], models: [] }
]);

describe('parseUrlModelsPathname', () => {
  it('extracts the pathname from a full URL', () => {
    expect(parseUrlModelsPathname('https://app.hellosubs.co/worker/abc/timesheets/list')).toBe('/worker/abc/timesheets/list');
  });

  it('strips a trailing slash and a query string', () => {
    expect(parseUrlModelsPathname('https://app.hellosubs.co/worker/abc/timesheets/list/?tab=x')).toBe('/worker/abc/timesheets/list');
  });

  it('accepts a bare path', () => {
    expect(parseUrlModelsPathname('/guestbook')).toBe('/guestbook');
    expect(parseUrlModelsPathname('guestbook')).toBe('/guestbook');
  });
});

describe('matchRouteManifestUrl', () => {
  it('matches a literal URL', () => {
    const result = matchRouteManifestUrl({ manifest: WORKER_MANIFEST, url: 'https://app.hellosubs.co/guestbook' });
    expect(result.kind).toBe('match');
    if (result.kind === 'match') {
      expect(result.via).toBe('literal');
      expect(result.state.name).toBe('guestbook.list');
      expect(result.params).toEqual({});
    }
  });

  it('matches a parameterised URL and captures the route params', () => {
    const result = matchRouteManifestUrl({ manifest: WORKER_MANIFEST, url: 'https://app.hellosubs.co/worker/abc123/timesheets/list' });
    expect(result.kind).toBe('match');
    if (result.kind === 'match') {
      expect(result.via).toBe('param');
      expect(result.state.name).toBe('worker.user.timesheets.list');
      expect(result.params).toEqual({ uid: 'abc123' });
    }
  });

  it('returns scored candidates when nothing matches', () => {
    const result = matchRouteManifestUrl({ manifest: WORKER_MANIFEST, url: '/worker/abc/nope' });
    expect(result.kind).toBe('none');
    if (result.kind === 'none') {
      expect(result.candidates.map((s) => s.name)).toContain('worker.user');
    }
  });

  it('returns ambiguous when two states share a composed URL', () => {
    const dup = manifest([
      { name: 'a', url: '/x', fullUrl: '/x', paramKeys: [], urlParamKeys: [], models: [] },
      { name: 'b', url: '/x', fullUrl: '/x', paramKeys: [], urlParamKeys: [], models: [] }
    ]);
    const result = matchRouteManifestUrl({ manifest: dup, url: '/x' });
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.states.map((s) => s.name).sort((m, n) => m.localeCompare(n))).toEqual(['a', 'b']);
    }
  });
});
