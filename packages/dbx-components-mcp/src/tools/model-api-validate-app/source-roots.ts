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

import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const TSCONFIG_BASE = 'tsconfig.base.json';
const COMPONENT_PACKAGE_JSON = 'package.json';
const SRC_LIB_SUBPATH = 'src/lib';
const DBX_COMPONENTS_BASE_SCOPE = '@dereekb/';

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
 * @param input - the component path and (optional) cached workspace root.
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
  const pkgPath = join(componentAbs, COMPONENT_PACKAGE_JSON);
  let raw: string;
  try {
    raw = await readFile(pkgPath, 'utf8');
  } catch {
    return [];
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(json)) return [];
  const out = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const map = json[field];
    if (!isRecord(map)) continue;
    for (const name of Object.keys(map)) {
      if (name.startsWith(DBX_COMPONENTS_BASE_SCOPE)) out.add(name);
    }
  }
  return [...out];
}

interface PackagePathsMap {
  readonly entries: ReadonlyMap<string, string>;
}

async function readTsconfigPaths(workspaceRoot: string): Promise<PackagePathsMap | undefined> {
  const tsconfigPath = join(workspaceRoot, TSCONFIG_BASE);
  let raw: string;
  try {
    raw = await readFile(tsconfigPath, 'utf8');
  } catch {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(stripJsonComments(raw));
  } catch {
    return undefined;
  }
  if (!isRecord(json)) return undefined;
  const compilerOptions = json.compilerOptions;
  if (!isRecord(compilerOptions)) return undefined;
  const paths = compilerOptions.paths;
  if (!isRecord(paths)) return undefined;
  const entries = new Map<string, string>();
  for (const [alias, target] of Object.entries(paths)) {
    if (!Array.isArray(target) || target.length === 0) continue;
    const first = target[0];
    if (typeof first !== 'string') continue;
    entries.set(alias, first);
  }
  return { entries };
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
 * @param input - package name, parsed paths map, and workspace root.
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
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
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
  let out = '';
  let i = 0;
  let inString: '"' | "'" | null = null;
  while (i < value.length) {
    const ch = value[i];
    const next = value[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < value.length) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < value.length && value[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < value.length && !(value[i] === '*' && value[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}
