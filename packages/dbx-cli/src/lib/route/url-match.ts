/**
 * Pure URL ↔ route matcher, shared by the dev-server `dbx_route_resolve_url`
 * tool and (mirrored, not imported) by the firebase-server/mcp `url-models`
 * runtime tool.
 *
 * No ts-morph, no node:fs — operates on a flat list of candidates each carrying
 * a composed `fullUrl` and an opaque `value`. Matching mirrors UIRouter's
 * literal-then-param preference: a literal segment-for-segment match wins over a
 * parameterised one, and ties at either tier collapse to an `ambiguous` result.
 */

/**
 * One candidate fed to {@link matchUrlAgainstEntries}: a composed URL pattern
 * plus the opaque payload to return when it matches.
 */
export interface UrlMatchEntry<T> {
  readonly fullUrl: string | undefined;
  readonly value: T;
}

/**
 * A single resolved match. `via` distinguishes a literal path match from a
 * parameterised one; `params` carries the captured `:param` / `{param}` values
 * (empty for literal matches).
 */
export interface UrlMatchMatch<T> {
  readonly kind: 'match';
  readonly via: 'literal' | 'param';
  readonly value: T;
  readonly matchedFullUrl: string;
  readonly params: Readonly<Record<string, string>>;
}

/**
 * More than one candidate matched at the same tier; the caller must
 * disambiguate (or report the tie).
 */
export interface UrlMatchAmbiguous<T> {
  readonly kind: 'ambiguous';
  readonly values: readonly T[];
}

/**
 * No candidate matched. `candidates` holds the closest scored near-misses
 * (top 5) for a "did you mean" style hint.
 */
export interface UrlMatchNone<T> {
  readonly kind: 'none';
  readonly candidates: readonly T[];
}

export type UrlMatchResult<T> = UrlMatchMatch<T> | UrlMatchAmbiguous<T> | UrlMatchNone<T>;

/**
 * Input to {@link matchUrlAgainstEntries}.
 */
export interface MatchUrlAgainstEntriesInput<T> {
  readonly entries: readonly UrlMatchEntry<T>[];
  readonly pathname: string;
}

/**
 * Collapses an empty pathname to `/` and strips a single trailing slash so
 * `/a/b/` and `/a/b` compare equal.
 *
 * @param pathname - The raw pathname to normalize.
 * @returns The normalized pathname.
 */
export function normalizePathname(pathname: string): string {
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

/**
 * Splits a path into its non-empty segments (the leading slash is dropped).
 *
 * @param path - The path or URL pattern to split.
 * @returns The ordered segment list, empty for `/`.
 */
export function splitSegments(path: string): readonly string[] {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return normalized.length === 0 ? [] : normalized.split('/');
}

/**
 * Whether a composed URL contains at least one `:param` or `{param}` segment.
 *
 * @param path - The composed URL pattern.
 * @returns `true` when the pattern declares a parameter.
 */
export function hasParamSegment(path: string): boolean {
  return path.includes(':') || path.includes('{');
}

/**
 * Attempts a segment-for-segment match of a route pattern against concrete
 * input segments. `:name` and `{name}` / `{name:type}` segments capture the
 * input value (URL-decoded); literal segments must match exactly.
 *
 * @param route - The route pattern's segments.
 * @param input - The concrete URL's segments.
 * @returns The captured params when every segment matches, else `undefined`.
 */
export function tryMatchSegments(route: readonly string[], input: readonly string[]): Readonly<Record<string, string>> | undefined {
  if (route.length !== input.length) {
    return undefined;
  }
  const params: Record<string, string> = {};
  let result: Readonly<Record<string, string>> | undefined = params;
  for (const [i, r] of route.entries()) {
    const v = input[i];
    if (r.startsWith(':')) {
      const key = r.slice(1);
      params[key] = decodeURIComponent(v);
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

/**
 * Extracts param-name segments from a composed UIRouter URL. Recognises:
 * - `:name` (Express-style)
 * - `{name}` (UIRouter type-less)
 * - `{name:type}` and `{name:regex}` (UIRouter typed / regex)
 * Order is preserved; duplicates are de-duplicated by first occurrence.
 *
 * @param fullUrl - Composed URL (e.g. `/{orgId}/users/:userId`) or undefined.
 * @returns The param key list in declaration order, or an empty array.
 */
export function extractUrlParamKeys(fullUrl: string | undefined): readonly string[] {
  if (fullUrl === undefined || fullUrl.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const segment of fullUrl.split('/')) {
    const key = extractParamKeyFromSegment(segment);
    if (key !== undefined && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

function extractParamKeyFromSegment(segment: string): string | undefined {
  if (segment.startsWith(':')) {
    const key = segment.slice(1);
    return key.length > 0 ? key : undefined;
  }
  if (segment.startsWith('{') && segment.endsWith('}')) {
    const inner = segment.slice(1, -1);
    const colonIdx = inner.indexOf(':');
    const rawKey = colonIdx >= 0 ? inner.slice(0, colonIdx) : inner;
    const key = rawKey.trim();
    return key.length > 0 ? key : undefined;
  }
  return undefined;
}

/**
 * Matches a pathname against a flat candidate list, preferring a literal
 * (exact composed-URL) match over a parameterised one. A tie at either tier
 * collapses to `ambiguous`; otherwise the closest near-misses are scored and
 * returned in a `none` result.
 *
 * @param input - The candidate entries and the pathname to resolve.
 * @returns A discriminated match / ambiguous / none result.
 */
export function matchUrlAgainstEntries<T>(input: MatchUrlAgainstEntriesInput<T>): UrlMatchResult<T> {
  const pathname = normalizePathname(input.pathname);
  const literal = matchLiteral(input.entries, pathname);
  let result: UrlMatchResult<T>;

  if (literal.length === 1) {
    result = { kind: 'match', via: 'literal', value: literal[0].value, matchedFullUrl: normalizePathname(literal[0].fullUrl ?? pathname), params: {} };
  } else if (literal.length > 1) {
    result = { kind: 'ambiguous', values: literal.map((e) => e.value) };
  } else {
    result = matchParamOrNone(input.entries, pathname);
  }

  return result;
}

function matchLiteral<T>(entries: readonly UrlMatchEntry<T>[], pathname: string): readonly UrlMatchEntry<T>[] {
  const out: UrlMatchEntry<T>[] = [];
  for (const entry of entries) {
    if (entry.fullUrl !== undefined && normalizePathname(entry.fullUrl) === pathname) {
      out.push(entry);
    }
  }
  return out;
}

interface ParamHit<T> {
  readonly entry: UrlMatchEntry<T>;
  readonly params: Readonly<Record<string, string>>;
}

function matchParamOrNone<T>(entries: readonly UrlMatchEntry<T>[], pathname: string): UrlMatchResult<T> {
  const inputSegments = splitSegments(pathname);
  const hits: ParamHit<T>[] = [];
  for (const entry of entries) {
    if (entry.fullUrl === undefined || !hasParamSegment(entry.fullUrl)) {
      continue;
    }
    const params = tryMatchSegments(splitSegments(entry.fullUrl), inputSegments);
    if (params) {
      hits.push({ entry, params });
    }
  }

  let result: UrlMatchResult<T>;
  if (hits.length === 1) {
    result = { kind: 'match', via: 'param', value: hits[0].entry.value, matchedFullUrl: normalizePathname(hits[0].entry.fullUrl ?? pathname), params: hits[0].params };
  } else if (hits.length > 1) {
    result = { kind: 'ambiguous', values: hits.map((h) => h.entry.value) };
  } else {
    result = { kind: 'none', candidates: scoreCandidates(entries, pathname) };
  }
  return result;
}

/**
 * Scores every candidate by shared leading segments (literal segment = 2,
 * param segment = 1, mismatch stops scoring) and returns the top 5 values.
 *
 * @param entries - The candidate entries to score.
 * @param pathname - The pathname being resolved.
 * @returns Up to five closest candidate values, best first.
 */
export function scoreCandidates<T>(entries: readonly UrlMatchEntry<T>[], pathname: string): readonly T[] {
  const segments = splitSegments(normalizePathname(pathname));
  const scored: { readonly value: T; readonly score: number }[] = [];
  for (const entry of entries) {
    if (entry.fullUrl === undefined) {
      continue;
    }
    const candidateSegments = splitSegments(entry.fullUrl);
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
      scored.push({ value: entry.value, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.value);
}
