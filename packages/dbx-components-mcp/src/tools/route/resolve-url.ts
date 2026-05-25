/**
 * `dbx_route_resolve_url` pipeline.
 *
 * Maps a dev-server URL (`http://localhost:9010/doc/interaction/upload`) or a
 * bare pathname (`/doc/interaction/upload`) to the UIRouter state that owns
 * it, by chaining `app-port-map` → `loadRouteContext` → URL match → import
 * scan for the rendered component's source file.
 *
 * Returns a discriminated union so the tool handler can render each outcome
 * (single match, multiple matches, not-found, error) without rethrowing.
 */

import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { loadAppPortMap, type AppEntry } from './app-port-map.js';
import { loadRouteContext, type RouteContextInput } from './load-context.js';
import type { RouteTreeNode } from './types.js';

export interface ResolveUrlInput {
  readonly url: string;
  readonly app: string | undefined;
  readonly cwd: string | undefined;
  /**
   * When true, the result includes sibling states (peers under the same
   * parent). Off by default — siblings are useful context when adding a new
   * page next to the matched one, but otherwise noise.
   */
  readonly includeSiblings: boolean;
}

export interface ResolvedComponentFile {
  readonly path: string;
  readonly moduleSpecifier: string;
}

export interface ResolveUrlMatch {
  readonly kind: 'match';
  readonly app: AppEntry;
  readonly via: 'literal' | 'param';
  readonly node: RouteTreeNode;
  /**
   * Composed `node.fullUrl` value used in the comparison (literal path).
   */
  readonly matchedFullUrl: string;
  /**
   * Pathname extracted from the input URL, after stripping host/port.
   */
  readonly pathname: string;
  /**
   * Param values captured from the URL when matched via `param`. Empty for
   * literal matches.
   */
  readonly params: Readonly<Record<string, string>>;
  /**
   * Search parameters from the URL (e.g. `?tab=settings`). Always present;
   * empty when the URL has no query string.
   */
  readonly search: Readonly<Record<string, string>>;
  /**
   * Resolved source file for the rendered component (relative to the cwd
   * the tool was invoked against). `undefined` if the component class can't
   * be traced to a relative import — e.g., declared in the same file or
   * imported from a node-module/barrel path.
   */
  readonly componentFile: ResolvedComponentFile | undefined;
  /**
   * Walked ancestor chain (root → self, inclusive).
   */
  readonly ancestors: readonly RouteTreeNode[];
  /**
   * Sibling states sharing the same parent (excluding the matched node).
   * `undefined` when the caller didn't ask for siblings — distinguishes
   * "not requested" from "no siblings present".
   */
  readonly siblings: readonly RouteTreeNode[] | undefined;
  /**
   * Param names declared inline in the composed URL — `:name`, `{name}`,
   * `{name:type}`, `{name:regex}`. Walks the full ancestor chain via
   * `node.fullUrl`, so a child like `/users/:userId` under a parent
   * `/{orgId}` surfaces both `orgId` and `userId`. Distinct from
   * `RouteNode.paramKeys`, which captures only the `params: { ... }`
   * object literal on the state declaration.
   */
  readonly urlParamKeys: readonly string[];
}

export interface ResolveUrlMultiple {
  readonly kind: 'multiple';
  readonly app: AppEntry;
  readonly pathname: string;
  readonly nodes: readonly RouteTreeNode[];
}

export interface ResolveUrlNotFound {
  readonly kind: 'not_found';
  readonly app: AppEntry;
  readonly pathname: string;
  readonly candidates: readonly RouteTreeNode[];
}

export interface ResolveUrlError {
  readonly kind: 'error';
  readonly message: string;
}

export type ResolveUrlResult = ResolveUrlMatch | ResolveUrlMultiple | ResolveUrlNotFound | ResolveUrlError;

interface ParsedUrlInput {
  readonly pathname: string;
  readonly port: number | undefined;
  readonly search: Readonly<Record<string, string>>;
}

/**
 * Resolves a URL or pathname to the owning UIRouter state. Composes app
 * discovery, route-tree extraction, and component import resolution into a
 * single discriminated-union result.
 *
 * @param input - The URL plus optional `app` override and `cwd`.
 * @returns A discriminated union of the resolution outcome.
 */
export async function resolveUrlToState(input: ResolveUrlInput): Promise<ResolveUrlResult> {
  let parsed: ParsedUrlInput | undefined;
  let parseError: string | undefined;
  try {
    parsed = parseInputUrl(input.url);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }
  if (!parsed) {
    return { kind: 'error', message: parseError ?? `Could not parse URL: ${input.url}` };
  }

  const portMap = await loadAppPortMap(input.cwd);
  const appResolution = pickApp({ portMap, appOverride: input.app, port: parsed.port });
  if (appResolution.kind === 'error') {
    return appResolution;
  }
  const app = appResolution.app;

  const contextInput: RouteContextInput = {
    sources: undefined,
    paths: undefined,
    glob: `${app.projectRoot}/src/**/*.ts`,
    cwd: input.cwd
  };
  const ctx = await loadRouteContext(contextInput);
  if (ctx.kind === 'error') {
    const message = ctx.result.content.map((c) => c.text).join('\n');
    return { kind: 'error', message: `Failed to load routes for \`${app.name}\`: ${message}` };
  }

  const { tree } = ctx;
  const literal = matchLiteralUrl(tree.byName, parsed.pathname);
  if (literal.length === 1) {
    const node = literal[0];
    return buildMatch({
      app,
      via: 'literal',
      node,
      parsed,
      params: {},
      cwd: input.cwd,
      includeSiblings: input.includeSiblings
    });
  }
  if (literal.length > 1) {
    return { kind: 'multiple', app, pathname: parsed.pathname, nodes: literal };
  }

  const paramMatch = matchParamUrl(tree.byName, parsed.pathname);
  if (paramMatch?.nodes.length === 1) {
    return buildMatch({
      app,
      via: 'param',
      node: paramMatch.nodes[0],
      parsed,
      params: paramMatch.params,
      cwd: input.cwd,
      includeSiblings: input.includeSiblings
    });
  }
  if (paramMatch && paramMatch.nodes.length > 1) {
    return { kind: 'multiple', app, pathname: parsed.pathname, nodes: paramMatch.nodes };
  }

  const candidates = pickCandidates(tree.byName, parsed.pathname);
  return { kind: 'not_found', app, pathname: parsed.pathname, candidates };
}

// MARK: URL parsing
function parseInputUrl(raw: string): ParsedUrlInput {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('URL is empty.');
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const search: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      search[key] = value;
    });
    const port = url.port === '' ? undefined : Number(url.port);
    const result: ParsedUrlInput = {
      pathname: normalizePathname(url.pathname),
      port: port !== undefined && Number.isFinite(port) ? port : undefined,
      search
    };
    return result;
  }
  // Treat as a bare path. Strip any trailing `?query` so we still capture search.
  const hashStripped = trimmed.split('#', 1)[0];
  const [pathPart, queryPart] = hashStripped.split('?', 2);
  const search: Record<string, string> = {};
  if (queryPart !== undefined && queryPart.length > 0) {
    for (const pair of queryPart.split('&')) {
      if (pair.length === 0) continue;
      const [k, v = ''] = pair.split('=', 2);
      search[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  const pathname = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const result: ParsedUrlInput = {
    pathname: normalizePathname(pathname),
    port: undefined,
    search
  };
  return result;
}

function normalizePathname(pathname: string): string {
  if (pathname.length === 0) {
    return '/';
  }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

// MARK: App resolution
type AppResolution = { readonly kind: 'ok'; readonly app: AppEntry } | ResolveUrlError;

interface PickAppInput {
  readonly portMap: { readonly byPort: ReadonlyMap<number, AppEntry>; readonly byName: ReadonlyMap<string, AppEntry>; readonly entries: readonly AppEntry[] };
  readonly appOverride: string | undefined;
  readonly port: number | undefined;
}

function pickApp(input: PickAppInput): AppResolution {
  const { portMap, appOverride, port } = input;
  if (appOverride) {
    const direct = portMap.byName.get(appOverride);
    if (direct) {
      return { kind: 'ok', app: direct };
    }
    return { kind: 'error', message: `Unknown app \`${appOverride}\`. Known apps: ${listAppNames(portMap.entries)}.` };
  }
  if (port !== undefined) {
    const hit = portMap.byPort.get(port);
    if (hit) {
      return { kind: 'ok', app: hit };
    }
    return { kind: 'error', message: `No app found for port \`${port}\`. Known apps: ${listAppsWithPorts(portMap.entries)}.` };
  }
  return {
    kind: 'error',
    message: `URL has no port and no \`app\` override was given. Pass \`app\` (one of: ${listAppNames(portMap.entries)}) when the input is a bare pathname.`
  };
}

function listAppNames(entries: readonly AppEntry[]): string {
  if (entries.length === 0) {
    return '(no apps discovered)';
  }
  return entries.map((e) => e.name).join(', ');
}

function listAppsWithPorts(entries: readonly AppEntry[]): string {
  const withPorts = entries.filter((e) => e.ports.length > 0);
  if (withPorts.length === 0) {
    return '(no apps with declared ports)';
  }
  return withPorts.map((e) => `${e.name}=${e.ports.join('|')}`).join(', ');
}

// MARK: URL matching
function matchLiteralUrl(byName: ReadonlyMap<string, RouteTreeNode>, pathname: string): readonly RouteTreeNode[] {
  const out: RouteTreeNode[] = [];
  for (const node of byName.values()) {
    if (node.fullUrl !== undefined && normalizePathname(node.fullUrl) === pathname) {
      out.push(node);
    }
  }
  return out;
}

interface ParamMatch {
  readonly nodes: readonly RouteTreeNode[];
  readonly params: Readonly<Record<string, string>>;
}

function matchParamUrl(byName: ReadonlyMap<string, RouteTreeNode>, pathname: string): ParamMatch | undefined {
  const inputSegments = splitSegments(pathname);
  let best: { readonly node: RouteTreeNode; readonly params: Readonly<Record<string, string>> } | undefined;
  const competing: RouteTreeNode[] = [];
  for (const node of byName.values()) {
    if (node.fullUrl === undefined) {
      continue;
    }
    if (!hasParamSegment(node.fullUrl)) {
      continue;
    }
    const routeSegments = splitSegments(node.fullUrl);
    const params = tryMatchSegments(routeSegments, inputSegments);
    if (params) {
      if (best) {
        competing.push(node);
      } else {
        best = { node, params };
      }
    }
  }
  if (!best) {
    return undefined;
  }
  if (competing.length === 0) {
    const result: ParamMatch = { nodes: [best.node], params: best.params };
    return result;
  }
  const all: RouteTreeNode[] = [best.node, ...competing];
  const result: ParamMatch = { nodes: all, params: {} };
  return result;
}

function splitSegments(path: string): readonly string[] {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  if (normalized.length === 0) {
    return [];
  }
  return normalized.split('/');
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

// MARK: Candidates / fuzzy
function pickCandidates(byName: ReadonlyMap<string, RouteTreeNode>, pathname: string): readonly RouteTreeNode[] {
  const segments = splitSegments(pathname);
  const scored: { readonly node: RouteTreeNode; readonly score: number }[] = [];
  for (const node of byName.values()) {
    if (node.fullUrl === undefined) {
      continue;
    }
    const candidateSegments = splitSegments(node.fullUrl);
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
      scored.push({ node, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.node);
}

// MARK: Match builder + ancestor/sibling walk
interface BuildMatchInput {
  readonly app: AppEntry;
  readonly via: 'literal' | 'param';
  readonly node: RouteTreeNode;
  readonly parsed: ParsedUrlInput;
  readonly params: Readonly<Record<string, string>>;
  readonly cwd: string | undefined;
  readonly includeSiblings: boolean;
}

async function buildMatch(input: BuildMatchInput): Promise<ResolveUrlMatch> {
  const { app, via, node, parsed, params, cwd, includeSiblings } = input;
  const ancestors = collectAncestors(node);
  const siblings = includeSiblings ? collectSiblings(node) : undefined;
  const componentFile = node.data.component ? await resolveComponentFile({ routerFile: node.data.file, component: node.data.component, cwd }) : undefined;
  const urlParamKeys = extractUrlParamKeys(node.fullUrl);
  const result: ResolveUrlMatch = {
    kind: 'match',
    app,
    via,
    node,
    matchedFullUrl: node.fullUrl ?? parsed.pathname,
    pathname: parsed.pathname,
    params,
    search: parsed.search,
    componentFile,
    ancestors,
    siblings,
    urlParamKeys
  };
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
function extractUrlParamKeys(fullUrl: string | undefined): readonly string[] {
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

function collectAncestors(node: RouteTreeNode): readonly RouteTreeNode[] {
  const chain: RouteTreeNode[] = [];
  let cursor: RouteTreeNode | undefined = node;
  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parent;
  }
  return chain;
}

function collectSiblings(node: RouteTreeNode): readonly RouteTreeNode[] {
  return node.parent ? node.parent.children.filter((c) => c.data.name !== node.data.name) : [];
}

// MARK: Component file resolution
interface ResolveComponentFileInput {
  readonly routerFile: string;
  readonly component: string;
  readonly cwd: string | undefined;
}

const TRY_EXTENSIONS: readonly string[] = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

async function resolveComponentFile(input: ResolveComponentFileInput): Promise<ResolvedComponentFile | undefined> {
  const cwdResolved = input.cwd ? resolve(process.cwd(), input.cwd) : process.cwd();
  const routerAbsolute = isAbsolute(input.routerFile) ? input.routerFile : resolve(cwdResolved, input.routerFile);
  let text: string | undefined;
  try {
    text = await readFile(routerAbsolute, 'utf8');
  } catch {
    text = undefined;
  }
  let result: ResolvedComponentFile | undefined;
  if (text !== undefined) {
    const specifier = findImportSpecifier(text, input.component);
    if (specifier !== undefined) {
      result = await resolveSpecifierToFile({ specifier, routerAbsolute, cwdResolved });
    }
  }
  return result;
}

interface ResolveSpecifierInput {
  readonly specifier: string;
  readonly routerAbsolute: string;
  readonly cwdResolved: string;
}

async function resolveSpecifierToFile(input: ResolveSpecifierInput): Promise<ResolvedComponentFile> {
  const { specifier, routerAbsolute, cwdResolved } = input;
  if (!specifier.startsWith('.')) {
    return { path: specifier, moduleSpecifier: specifier };
  }
  const fromDir = dirname(routerAbsolute);
  const baseAbsolute = resolve(fromDir, specifier);
  const cwdPrefix = cwdResolved.endsWith(sep) ? cwdResolved : cwdResolved + sep;
  let resolved: string | undefined;
  for (const ext of TRY_EXTENSIONS) {
    const candidate = baseAbsolute + ext;
    if (!candidate.startsWith(cwdPrefix) && candidate !== cwdResolved) {
      continue;
    }
    if (await fileExists(candidate)) {
      resolved = candidate;
      break;
    }
  }
  const relativePath = relativizePath(resolved, specifier, cwdPrefix);
  const result: ResolvedComponentFile = { path: relativePath, moduleSpecifier: specifier };
  return result;
}

function relativizePath(resolved: string | undefined, specifier: string, cwdPrefix: string): string {
  if (resolved === undefined) {
    return specifier;
  }
  return resolved.startsWith(cwdPrefix) ? resolved.slice(cwdPrefix.length) : resolved;
}

function findImportSpecifier(text: string, component: string): string | undefined {
  const importRegex = /import\s+[^'"]+from\s+['"]([^'"]+)['"]/gu;
  let result: string | undefined;
  let match = importRegex.exec(text);
  while (match !== null) {
    const fullMatch = match[0];
    const specifier = match[1];
    if (containsImportedSymbol(fullMatch, component)) {
      result = specifier;
      break;
    }
    match = importRegex.exec(text);
  }
  return result;
}

function containsImportedSymbol(importStatement: string, symbol: string): boolean {
  const braceStart = importStatement.indexOf('{');
  const braceEnd = importStatement.indexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    const inside = importStatement.slice(braceStart + 1, braceEnd);
    for (const raw of inside.split(',')) {
      const cleaned = raw.replace(/\s+as\s+\w+/u, '').trim();
      if (cleaned === symbol) {
        return true;
      }
    }
  }
  const defaultRegex = new RegExp(String.raw`^import\s+(?:type\s+)?(${symbol})\s+from\s+`, 'u');
  return defaultRegex.test(importStatement);
}

async function fileExists(path: string): Promise<boolean> {
  let result: boolean;
  try {
    const info = await stat(path);
    result = info.isFile();
  } catch {
    result = false;
  }
  return result;
}
