/**
 * Discovers the directories the `*.api.ts` walker should crawl when
 * validating a firebase-component package against its paired API app.
 *
 * Some CRUD declarations live outside the component itself — e.g. the
 * notification, OIDC, and storage-file model groups are declared in
 * `@dereekb/firebase` (`packages/firebase/src/lib/model/...`) and pulled
 * into a downstream component through its `functions.ts` aggregator. To
 * reconcile them against the app's handler map we need to follow the
 * component's `@dereekb/*` dependencies and walk those packages too.
 */

import type { Maybe } from '@dereekb/util';
import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const TSCONFIG_BASE = 'tsconfig.base.json';
const COMPONENT_PACKAGE_JSON = 'package.json';
const SRC_LIB_SUBPATH = 'src/lib';
const DBX_COMPONENTS_BASE_SCOPE = '@dereekb/';
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

export interface ApiSourceRoot {
  /**
   * Absolute directory to walk for `*.api.ts` files (typically `<pkg>/src/lib`).
   */
  readonly absDir: string;
  /**
   * Human-readable label identifying the contributing package (used for diagnostics).
   */
  readonly packageLabel: string;
}

export interface ResolveSourceRootsInput {
  readonly componentAbs: string;
  readonly workspaceRoot: string | undefined;
}

export interface ResolveSourceRootsResult {
  readonly roots: readonly ApiSourceRoot[];
  readonly workspaceRoot: string | undefined;
}

/**
 * Resolves the absolute directories the declaration walker should crawl.
 *
 * Always includes the component's own `src/lib`. When a workspace root is
 * resolvable (via `tsconfig.base.json`), additionally inspects the
 * component's `package.json` for `@dereekb/*` dependencies and includes
 * each upstream package's `src/lib` so its `*.api.ts` files contribute
 * declarations.
 *
 * @param input - The component path and (optional) cached workspace root.
 * @returns The resolved source roots and detected workspace root.
 */
export async function resolveApiSourceRoots(input: ResolveSourceRootsInput): Promise<ResolveSourceRootsResult> {
  const workspaceRoot = input.workspaceRoot ?? (await findWorkspaceRoot(input.componentAbs));
  const componentLib = join(input.componentAbs, SRC_LIB_SUBPATH);
  const seen = new Set<string>();
  const roots: ApiSourceRoot[] = [];

  if (await isDirectory(componentLib)) {
    seen.add(componentLib);
    roots.push({ absDir: componentLib, packageLabel: workspaceRoot ? toWorkspaceRel(workspaceRoot, input.componentAbs) : input.componentAbs });
  }

  if (workspaceRoot) {
    const upstream = await resolveUpstreamRoots({ componentAbs: input.componentAbs, workspaceRoot });
    for (const root of upstream) {
      if (seen.has(root.absDir)) continue;
      seen.add(root.absDir);
      roots.push(root);
    }
  }

  return { roots, workspaceRoot };
}

/**
 * Walks upward from `startAbs` looking for the workspace root, identified by a `tsconfig.base.json` file.
 *
 * @param startAbs - Absolute directory to start the search from.
 * @returns The workspace root absolute path, or `undefined` when no `tsconfig.base.json` is found.
 */
export async function findWorkspaceRoot(startAbs: string): Promise<string | undefined> {
  let current = resolve(startAbs);
  for (;;) {
    const candidate = join(current, TSCONFIG_BASE);
    try {
      const s = await stat(candidate);
      if (s.isFile()) return current;
    } catch {
      /* not here */
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

interface ResolveUpstreamInput {
  readonly componentAbs: string;
  readonly workspaceRoot: string;
}

async function resolveUpstreamRoots(input: ResolveUpstreamInput): Promise<readonly ApiSourceRoot[]> {
  const deps = await readComponentDereekbDeps(input.componentAbs);
  if (deps.length === 0) return [];
  const paths = await readTsconfigPaths(input.workspaceRoot);
  if (!paths) return [];
  const seen = new Set<string>();
  const out: ApiSourceRoot[] = [];
  for (const dep of deps) {
    const pkgRoot = resolvePackageRoot({ packageName: dep, paths, workspaceRoot: input.workspaceRoot });
    if (!pkgRoot) continue;
    const libDir = join(pkgRoot, SRC_LIB_SUBPATH);
    if (seen.has(libDir)) continue;
    if (!(await isDirectory(libDir))) continue;
    seen.add(libDir);
    out.push({ absDir: libDir, packageLabel: dep });
  }
  return out;
}

async function readComponentDereekbDeps(componentAbs: string): Promise<readonly string[]> {
  const json = await readJsonFileSafe(join(componentAbs, COMPONENT_PACKAGE_JSON));
  const out = new Set<string>();
  if (isRecord(json)) {
    for (const field of DEPENDENCY_FIELDS) {
      addScopedDependencyNames(json[field], out);
    }
  }
  return [...out];
}

/**
 * Adds every `@dereekb/*`-scoped key of one `package.json` dependency map
 * to `out`. Non-object fields are ignored.
 *
 * @param field - The raw value of a `dependencies`/`devDependencies`/`peerDependencies` entry.
 * @param out - The accumulating set of scoped dependency names.
 */
function addScopedDependencyNames(field: unknown, out: Set<string>): void {
  if (isRecord(field)) {
    for (const name of Object.keys(field)) {
      if (name.startsWith(DBX_COMPONENTS_BASE_SCOPE)) out.add(name);
    }
  }
}

/**
 * Reads and parses a JSON file, returning `undefined` on any read or parse
 * failure rather than throwing. An optional `preprocess` step transforms the
 * raw text before parsing (e.g. stripping comments from JSON-with-comments).
 *
 * @param path - Absolute path of the JSON file.
 * @param preprocess - Optional transform applied to the raw text before `JSON.parse`.
 * @returns The parsed value, or `undefined` when the file is missing or malformed.
 */
async function readJsonFileSafe(path: string, preprocess?: (raw: string) => string): Promise<unknown> {
  let raw: string | undefined;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    raw = undefined;
  }
  let json: unknown;
  if (raw !== undefined) {
    try {
      json = JSON.parse(preprocess ? preprocess(raw) : raw);
    } catch {
      json = undefined;
    }
  }
  return json;
}

interface PackagePathsMap {
  readonly entries: ReadonlyMap<string, string>;
}

async function readTsconfigPaths(workspaceRoot: string): Promise<PackagePathsMap | undefined> {
  const tsconfigPath = join(workspaceRoot, TSCONFIG_BASE);
  const json = await readJsonFileSafe(tsconfigPath, stripJsonComments);
  let result: PackagePathsMap | undefined;
  if (isRecord(json) && isRecord(json.compilerOptions) && isRecord(json.compilerOptions.paths)) {
    const entries = new Map<string, string>();
    for (const [alias, target] of Object.entries(json.compilerOptions.paths)) {
      if (!Array.isArray(target) || target.length === 0) continue;
      const first = target[0];
      if (typeof first !== 'string') continue;
      entries.set(alias, first);
    }
    result = { entries };
  }
  return result;
}

interface ResolvePackageRootInput {
  readonly packageName: string;
  readonly paths: PackagePathsMap;
  readonly workspaceRoot: string;
}

/**
 * Resolves a `@dereekb/*` package name to its absolute root directory.
 *
 * Uses the workspace's `tsconfig.base.json` `paths` mapping for the bare
 * package name and treats the package root as the directory two segments
 * above the resolved `src/index.ts` target.
 *
 * @param input - Package name, parsed paths map, and workspace root.
 * @returns The absolute package root, or `undefined` when no mapping is found.
 */
function resolvePackageRoot(input: ResolvePackageRootInput): string | undefined {
  const target = input.paths.entries.get(input.packageName);
  if (!target) return undefined;
  const targetAbs = isAbsolute(target) ? target : resolve(input.workspaceRoot, target);
  // Path mappings point at `<pkg>/src/index.ts`; the package root is two segments up.
  return dirname(dirname(targetAbs));
}

async function isDirectory(path: string): Promise<boolean> {
  let result = false;
  try {
    const s = await stat(path);
    result = s.isDirectory();
  } catch {
    result = false;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toWorkspaceRel(workspaceRoot: string, abs: string): string {
  const rel = relative(workspaceRoot, abs);
  return rel.split(sep).join('/');
}

/**
 * Strips `//` line comments and `/* *\/` block comments from a JSON-with-comments string.
 *
 * Necessary because some workspaces' `tsconfig.base.json` files contain
 * comments that would otherwise break `JSON.parse`.
 *
 * @param value - The JSON-with-comments source.
 * @returns The same source with comments replaced by whitespace.
 */
function stripJsonComments(value: string): string {
  const state: StripJsonState = { value, out: '', i: 0, inString: null };
  while (state.i < value.length) {
    if (state.inString) {
      consumeStringChar(state);
      continue;
    }
    if (tryEnterString(state)) continue;
    if (tryConsumeLineComment(state)) continue;
    if (tryConsumeBlockComment(state)) continue;
    state.out += value[state.i];
    state.i += 1;
  }
  return state.out;
}

interface StripJsonState {
  readonly value: string;
  out: string;
  i: number;
  inString: Maybe<'"' | "'">;
}

function consumeStringChar(state: StripJsonState): void {
  const { value, i } = state;
  const ch = value[i];
  state.out += ch;
  if (ch === '\\' && i + 1 < value.length) {
    state.out += value[i + 1];
    state.i = i + 2;
    return;
  }
  if (ch === state.inString) state.inString = null;
  state.i = i + 1;
}

function tryEnterString(state: StripJsonState): boolean {
  const ch = state.value[state.i];
  if (ch !== '"' && ch !== "'") return false;
  state.inString = ch;
  state.out += ch;
  state.i += 1;
  return true;
}

function tryConsumeLineComment(state: StripJsonState): boolean {
  const { value, i } = state;
  if (value[i] !== '/' || value[i + 1] !== '/') return false;
  let j = i;
  while (j < value.length && value[j] !== '\n') j += 1;
  state.i = j;
  return true;
}

function tryConsumeBlockComment(state: StripJsonState): boolean {
  const { value, i } = state;
  if (value[i] !== '/' || value[i + 1] !== '*') return false;
  let j = i + 2;
  while (j < value.length && !(value[j] === '*' && value[j + 1] === '/')) j += 1;
  state.i = j + 2;
  return true;
}
