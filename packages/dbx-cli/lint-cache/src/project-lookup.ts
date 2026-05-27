import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Maybe } from '@dereekb/util';
import { join, relative } from 'node:path';

/**
 * Directory names that are never descended into during project discovery:
 * dependency installs, build output, and tool caches. Any directory whose name
 * starts with `.` (hidden, e.g. `.git`, `.nx`, `.angular`, `.next`) is skipped
 * too. Applied both when picking top-level dirs to scan and at every level of
 * the recursive walk.
 */
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', 'coverage', '.nx', '.angular', '.next']);

export interface ProjectInfo {
  readonly name: string;
  readonly projectRoot: string;
  readonly absoluteRoot: string;
  readonly lintFilePatterns: Maybe<readonly string[]>;
  readonly hasLintTarget: boolean;
}

/**
 * Enumerates the workspace root's immediate child directories that are eligible
 * to contain Nx projects. Every visible directory is returned except the
 * dependency/build/cache directories in {@link SKIP_DIR_NAMES} and any hidden
 * directory (leading `.`). Replacing a fixed allowlist with this scan makes
 * discovery agnostic to where a workspace keeps its projects — `apps/`,
 * `packages/`, `tools/`, `components/`, `libs/`, or anything else — which honors
 * the "every project with a lint target" contract of `build-many` / `list-projects`.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @returns The scannable top-level directory names, sorted for a deterministic walk order.
 */
function discoverTopLevelDirs(workspaceRoot: string): readonly string[] {
  let dirs: readonly string[];
  try {
    dirs = readdirSync(workspaceRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !SKIP_DIR_NAMES.has(e.name) && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    dirs = [];
  }
  return dirs;
}

/**
 * Locates an Nx project by name. Auto-scans every top-level directory of the
 * workspace (skipping the dependency/build/cache and hidden dirs filtered by
 * {@link discoverTopLevelDirs}), so the project is found regardless of which
 * top-level directory holds it (`apps/`, `packages/`, `tools/`, `components/`,
 * `libs/`, …). Falls back to the workspace-root project.json. Returns the
 * project's workspace-relative root and its `lint.options.lintFilePatterns` if
 * one was declared.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @param projectName - The Nx project name to locate (matches against the `name` field in project.json).
 * @returns The matched project info, or `null` if no project with that name was found.
 */
export function findProject(workspaceRoot: string, projectName: string): Maybe<ProjectInfo> {
  let result: Maybe<ProjectInfo> = null;

  for (const dir of discoverTopLevelDirs(workspaceRoot)) {
    if (result) break;
    result = walkForProject(workspaceRoot, join(workspaceRoot, dir), projectName);
  }

  if (!result) {
    const rootProject = readProjectJson(join(workspaceRoot, 'project.json'));
    if (rootProject?.name === projectName) {
      result = toProjectInfo(workspaceRoot, workspaceRoot, rootProject);
    }
  }

  return result;
}

function walkForProject(workspaceRoot: string, dir: string, projectName: string): Maybe<ProjectInfo> {
  let found: Maybe<ProjectInfo> = null;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (found) break;
    if (!e.isDirectory()) continue;
    if (SKIP_DIR_NAMES.has(e.name) || e.name.startsWith('.')) continue;
    const childDir = join(dir, e.name);
    const pjPath = join(childDir, 'project.json');
    if (existsSync(pjPath)) {
      const pj = readProjectJson(pjPath);
      if (pj?.name === projectName) {
        found = toProjectInfo(workspaceRoot, childDir, pj);
        continue;
      }
    }
    found = walkForProject(workspaceRoot, childDir, projectName);
  }
  return found;
}

/**
 * Walks the workspace and returns every project. Auto-scans every top-level
 * directory (skipping the dependency/build/cache and hidden dirs filtered by
 * {@link discoverTopLevelDirs}), so projects are found wherever a workspace
 * keeps them — not just under `apps/`, `packages/`, or `tools/`. Filtering by
 * `hasLintTarget` is left to the caller so this stays useful for future
 * inspection commands that do not care whether `lint` is wired up.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @returns Every discovered project, sorted by name.
 */
export function listProjects(workspaceRoot: string): readonly ProjectInfo[] {
  const out: ProjectInfo[] = [];

  for (const dir of discoverTopLevelDirs(workspaceRoot)) {
    collectProjects(workspaceRoot, join(workspaceRoot, dir), out);
  }

  const rootProject = readProjectJson(join(workspaceRoot, 'project.json'));
  if (rootProject) out.push(toProjectInfo(workspaceRoot, workspaceRoot, rootProject));

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function collectProjects(workspaceRoot: string, dir: string, out: ProjectInfo[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP_DIR_NAMES.has(e.name) || e.name.startsWith('.') || e.name === 'src') continue;
    const childDir = join(dir, e.name);
    const pjPath = join(childDir, 'project.json');
    if (existsSync(pjPath)) {
      const pj = readProjectJson(pjPath);
      if (pj) out.push(toProjectInfo(workspaceRoot, childDir, pj));
    }
    // Keep recursing — this workspace nests sub-projects (e.g. packages/dbx-cli/lint-cache).
    collectProjects(workspaceRoot, childDir, out);
  }
}

interface RawProjectJson {
  readonly name?: string;
  readonly targets?: Record<string, { readonly executor?: string; readonly options?: { readonly lintFilePatterns?: readonly string[] } }>;
}

function readProjectJson(path: string): Maybe<RawProjectJson> {
  let parsed: Maybe<RawProjectJson>;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as RawProjectJson;
  } catch {
    parsed = null;
  }
  return parsed;
}

function toProjectInfo(workspaceRoot: string, projectRoot: string, pj: RawProjectJson): ProjectInfo {
  const lintTarget = pj.targets?.['lint'];
  const lintPatterns = lintTarget?.options?.lintFilePatterns;
  return {
    name: pj.name ?? '',
    projectRoot: relative(workspaceRoot, projectRoot) || '.',
    absoluteRoot: projectRoot,
    lintFilePatterns: Array.isArray(lintPatterns) && lintPatterns.length > 0 ? lintPatterns : undefined,
    hasLintTarget: lintTarget != null
  };
}
