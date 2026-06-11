/**
 * Runtime mirror of the build-time route manifest schema + a ported URL matcher.
 *
 * Structural mirror of `@dereekb/dbx-cli`'s `route-manifest.ts` types and the
 * pure `url-match.ts` matcher, so the firebase-server/mcp runtime can consume
 * the generated `route.manifest.json` without taking a runtime dependency on
 * the build-time CLI package. Both sides bump {@link ROUTE_MANIFEST_VERSION}
 * together when the manifest shape changes.
 */

/**
 * Version stamp embedded in `route.manifest.json`. Runtime loaders refuse
 * manifests whose `version` does not match. Mirror in `@dereekb/dbx-cli`'s
 * `ROUTE_MANIFEST_VERSION` — bump both together.
 */
export const ROUTE_MANIFEST_VERSION = 1 as const;

/**
 * Whether a route-model entry resolves to a promoted id, a full key, or a
 * keyless list. Mirror of `@dereekb/dbx-cli`'s `RouteModelKind`.
 */
export type RouteModelKind = 'id' | 'key' | 'list';

/**
 * One model an app page renders. Structural mirror of `@dereekb/dbx-cli`'s
 * `RouteManifestModelEntry`.
 */
export interface RouteManifestModelEntry {
  readonly modelType: string;
  readonly kind: RouteModelKind;
  readonly keyTemplate?: string;
  readonly description?: string;
  readonly from?: string;
}

/**
 * One UIRouter state, inheritance pre-flattened into `models`. Structural mirror
 * of `@dereekb/dbx-cli`'s `RouteManifestStateEntry`.
 */
export interface RouteManifestStateEntry {
  readonly name: string;
  readonly url?: string;
  readonly fullUrl?: string;
  readonly parentName?: string;
  readonly paramKeys: readonly string[];
  readonly urlParamKeys: readonly string[];
  readonly component?: string;
  readonly componentFile?: string;
  readonly abstract?: boolean;
  readonly redirectTo?: string;
  readonly models: readonly RouteManifestModelEntry[];
}

/**
 * The full `route.manifest.json` shape. Structural mirror of `@dereekb/dbx-cli`'s
 * `RouteManifest`.
 */
export interface RouteManifest {
  readonly version: typeof ROUTE_MANIFEST_VERSION;
  readonly generatedAt: string;
  readonly app: {
    readonly name: string;
    readonly baseUrl?: string;
  };
  readonly states: readonly RouteManifestStateEntry[];
}

// MARK: Matcher result
/**
 * A single resolved state match. `via` distinguishes a literal path match from
 * a parameterised one; `params` carries the captured `:param` / `{param}`
 * values (empty for literal matches).
 */
export interface RouteUrlMatch {
  readonly kind: 'match';
  readonly via: 'literal' | 'param';
  readonly state: RouteManifestStateEntry;
  readonly params: Readonly<Record<string, string>>;
  readonly pathname: string;
}

/**
 * More than one state matched at the same tier.
 */
export interface RouteUrlAmbiguous {
  readonly kind: 'ambiguous';
  readonly states: readonly RouteManifestStateEntry[];
  readonly pathname: string;
}

/**
 * No state matched; `candidates` holds the closest scored near-misses (top 5).
 */
export interface RouteUrlNone {
  readonly kind: 'none';
  readonly candidates: readonly RouteManifestStateEntry[];
  readonly pathname: string;
}

export type RouteUrlMatchResult = RouteUrlMatch | RouteUrlAmbiguous | RouteUrlNone;

/**
 * Input to {@link matchRouteManifestUrl}.
 */
export interface MatchRouteManifestUrlInput {
  readonly manifest: RouteManifest;
  readonly url: string;
}

/**
 * Extracts the normalized pathname from a full URL or a bare path. Strips the
 * scheme/host/port, query string, and hash; collapses an empty path to `/` and
 * trims a single trailing slash.
 *
 * @param url - A full URL (`https://app.example.co/worker/x/timesheets/list`) or bare path.
 * @returns The normalized pathname.
 *
 * @example
 * ```ts
 * parseUrlModelsPathname('https://app.hellosubs.co/worker/abc/timesheets/list/'); // => '/worker/abc/timesheets/list'
 * ```
 */
export function parseUrlModelsPathname(url: string): string {
  const trimmed = url.trim();
  let pathname: string;
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed)) {
    pathname = new URL(trimmed).pathname;
  } else {
    const hashStripped = trimmed.split('#', 1)[0];
    const pathPart = hashStripped.split('?', 1)[0];
    pathname = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  }
  return normalizePathname(pathname);
}

/**
 * Matches a URL against the manifest's states, preferring a literal match over
 * a parameterised one. A tie at either tier collapses to `ambiguous`; otherwise
 * the closest near-misses are scored and returned in a `none` result.
 *
 * @param input - The manifest and the URL (or pathname) to resolve.
 * @returns A discriminated match / ambiguous / none result.
 */
export function matchRouteManifestUrl(input: MatchRouteManifestUrlInput): RouteUrlMatchResult {
  const pathname = parseUrlModelsPathname(input.url);
  const states = input.manifest.states;

  const literal = states.filter((s) => s.fullUrl !== undefined && normalizePathname(s.fullUrl) === pathname);
  let result: RouteUrlMatchResult;

  if (literal.length === 1) {
    result = { kind: 'match', via: 'literal', state: literal[0], params: {}, pathname };
  } else if (literal.length > 1) {
    result = { kind: 'ambiguous', states: literal, pathname };
  } else {
    result = matchParamOrNone(states, pathname);
  }

  return result;
}

interface ParamHit {
  readonly state: RouteManifestStateEntry;
  readonly params: Readonly<Record<string, string>>;
}

function matchParamOrNone(states: readonly RouteManifestStateEntry[], pathname: string): RouteUrlMatchResult {
  const inputSegments = splitSegments(pathname);
  const hits: ParamHit[] = [];
  for (const state of states) {
    if (state.fullUrl === undefined || !hasParamSegment(state.fullUrl)) {
      continue;
    }
    const params = tryMatchSegments(splitSegments(state.fullUrl), inputSegments);
    if (params) {
      hits.push({ state, params });
    }
  }

  let result: RouteUrlMatchResult;
  if (hits.length === 1) {
    result = { kind: 'match', via: 'param', state: hits[0].state, params: hits[0].params, pathname };
  } else if (hits.length > 1) {
    result = { kind: 'ambiguous', states: hits.map((h) => h.state), pathname };
  } else {
    result = { kind: 'none', candidates: scoreCandidates(states, pathname), pathname };
  }
  return result;
}

// MARK: Pure URL helpers (mirror of @dereekb/dbx-cli url-match.ts)
function normalizePathname(pathname: string): string {
  let result: string;
  if (pathname.length === 0) {
    result = '/';
  } else if (pathname.length > 1 && pathname.endsWith('/')) {
    result = pathname.slice(0, -1);
  } else {
    result = pathname;
  }
  return result;
}

function splitSegments(path: string): readonly string[] {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return normalized.length === 0 ? [] : normalized.split('/');
}

function hasParamSegment(path: string): boolean {
  return path.includes(':') || path.includes('{');
}

function tryMatchSegments(route: readonly string[], input: readonly string[]): Readonly<Record<string, string>> | undefined {
  if (route.length !== input.length) {
    return undefined;
  }
  const params: Record<string, string> = {};
  let result: Readonly<Record<string, string>> | undefined = params;
  for (const [i, r] of route.entries()) {
    const v = input[i];
    if (r.startsWith(':')) {
      params[r.slice(1)] = decodeURIComponent(v);
    } else if (r.startsWith('{') && r.endsWith('}')) {
      const inner = r.slice(1, -1);
      const colonIdx = inner.indexOf(':');
      const key = colonIdx >= 0 ? inner.slice(0, colonIdx) : inner;
      params[key] = decodeURIComponent(v);
    } else if (r !== v) {
      result = undefined;
      break;
    }
  }
  return result;
}

function scoreCandidates(states: readonly RouteManifestStateEntry[], pathname: string): readonly RouteManifestStateEntry[] {
  const segments = splitSegments(pathname);
  const scored: { readonly state: RouteManifestStateEntry; readonly score: number }[] = [];
  for (const state of states) {
    if (state.fullUrl === undefined) {
      continue;
    }
    const candidateSegments = splitSegments(state.fullUrl);
    let score = 0;
    const maxIndex = Math.min(segments.length, candidateSegments.length);
    for (let i = 0; i < maxIndex; i += 1) {
      if (segments[i] === candidateSegments[i]) {
        score += 2;
      } else if (candidateSegments[i].startsWith(':') || candidateSegments[i].startsWith('{')) {
        score += 1;
      } else {
        break;
      }
    }
    if (score > 0) {
      scored.push({ state, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.state);
}
