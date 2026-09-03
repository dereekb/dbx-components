import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Maybe } from '@dereekb/util';
import { join, relative } from 'node:path';

import { DEFAULT_LINT_CACHE_LINTER, LINT_CACHE_LINTER_TARGET_NAMES } from './types';

/**
 * The Nx target consulted when a caller does not name one.
 */
const DEFAULT_TARGET_NAME = LINT_CACHE_LINTER_TARGET_NAMES[DEFAULT_LINT_CACHE_LINTER];

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
 * Project names that declare a given target in the Nx *project graph*, cached per
 * `(workspaceRoot, targetName)` for the life of the process.
 *
 * Needed because an **inferred** target — the kind `@nx/oxlint` produces — exists
 * only in the graph and is never written to `project.json`, so the disk scan below
 * cannot see it. Reading the graph costs a subprocess, so it is consulted lazily
 * and only when the disk scan comes up empty (see {@link listProjects}).
 */
const graphTargetCache = new Map<string, ReadonlySet<string>>();

/**
 * Asks Nx which projects have a given target, including targets contributed by
 * inference plugins rather than declared in `project.json`.
 *
 * Failure is non-fatal and yields an empty set: callers fall back to the disk scan,
 * which is the correct answer for every explicitly-declared target.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @param targetName - The target to look for, e.g. `oxlint`.
 * @returns The set of project names Nx reports as having that target.
 */
export function projectNamesWithTarget(workspaceRoot: string, targetName: string): ReadonlySet<string> {
  const key = `${workspaceRoot}\u0000${targetName}`;
  let cached = graphTargetCache.get(key);

  if (!cached) {
    let names: readonly string[];
    try {
      const stdout = execFileSync('npx', ['nx', 'show', 'projects', `--with-target=${targetName}`, '--json'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const parsed = JSON.parse(stdout) as unknown;
      names = Array.isArray(parsed) ? (parsed.filter((n) => typeof n === 'string') as readonly string[]) : [];
    } catch {
      names = [];
    }
    cached = new Set(names);
    graphTargetCache.set(key, cached);
  }

  return cached;
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
 * @param targetName - The lint target to report on via `hasLintTarget`. Defaults to `lint`.
 * @returns The matched project info, or `null` if no project with that name was found.
 */
export function findProject(workspaceRoot: string, projectName: string, targetName: string = DEFAULT_TARGET_NAME): Maybe<ProjectInfo> {
  let result: Maybe<ProjectInfo> = null;

  for (const dir of discoverTopLevelDirs(workspaceRoot)) {
    if (result) break;
    result = walkForProject({ workspaceRoot, dir: join(workspaceRoot, dir), projectName, targetName });
  }

  if (!result) {
    const rootProject = readProjectJson(join(workspaceRoot, 'project.json'));
    if (rootProject?.name === projectName) {
      result = toProjectInfo({ workspaceRoot, projectRoot: workspaceRoot, pj: rootProject, targetName });
    }
  }

  return result;
}

interface WalkForProjectInput {
  readonly workspaceRoot: string;
  readonly dir: string;
  readonly projectName: string;
  readonly targetName: string;
}

function walkForProject(input: WalkForProjectInput): Maybe<ProjectInfo> {
  const { workspaceRoot, dir, projectName, targetName } = input;
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
        found = toProjectInfo({ workspaceRoot, projectRoot: childDir, pj, targetName });
        continue;
      }
    }
    found = walkForProject({ workspaceRoot, dir: childDir, projectName, targetName });
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
 * An **inferred** target (one contributed by an Nx plugin, e.g. the `oxlint` target
 * `@nx/oxlint` produces) never appears in `project.json`, so the disk scan alone
 * reports `hasLintTarget: false` for every project. Pass
 * `options.resolveInferredTargets` for those targets and the flag is recomputed
 * from the Nx project graph instead. It is opt-in rather than inferred from an
 * empty disk scan so a declared target never pays for the subprocess, and so an
 * empty or non-Nx directory does not silently shell out.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @param targetName - The lint target to report on via `hasLintTarget`. Defaults to `lint`.
 * @param options - Set `resolveInferredTargets` when the target comes from an Nx inference plugin.
 * @returns Every discovered project, sorted by name.
 */
export function listProjects(workspaceRoot: string, targetName: string = DEFAULT_TARGET_NAME, options: ListProjectsOptions = {}): readonly ProjectInfo[] {
  const out: ProjectInfo[] = [];

  for (const dir of discoverTopLevelDirs(workspaceRoot)) {
    collectProjects({ workspaceRoot, dir: join(workspaceRoot, dir), out, targetName });
  }

  const rootProject = readProjectJson(join(workspaceRoot, 'project.json'));
  if (rootProject) out.push(toProjectInfo({ workspaceRoot, projectRoot: workspaceRoot, pj: rootProject, targetName }));

  out.sort((a, b) => a.name.localeCompare(b.name));

  return options.resolveInferredTargets ? withInferredTarget(workspaceRoot, targetName, out) : out;
}

export interface ListProjectsOptions {
  /**
   * Resolve `hasLintTarget` from the Nx project graph rather than from
   * `project.json`. Required for targets contributed by an inference plugin.
   */
  readonly resolveInferredTargets?: boolean;
}

/**
 * Recomputes `hasLintTarget` from the Nx project graph, for the case where the
 * target is inferred rather than declared in any `project.json`.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @param targetName - The inferred target to look up in the graph.
 * @param projects - The projects discovered by the disk scan.
 * @returns The same projects, with `hasLintTarget` set from the graph.
 */
function withInferredTarget(workspaceRoot: string, targetName: string, projects: readonly ProjectInfo[]): readonly ProjectInfo[] {
  const names = projectNamesWithTarget(workspaceRoot, targetName);
  return projects.map((p) => ({ ...p, hasLintTarget: names.has(p.name) }));
}

interface CollectProjectsInput {
  readonly workspaceRoot: string;
  readonly dir: string;
  readonly out: ProjectInfo[];
  readonly targetName: string;
}

function collectProjects(input: CollectProjectsInput): void {
  const { workspaceRoot, dir, out, targetName } = input;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP_DIR_NAMES.has(e.name) || e.name.startsWith('.') || e.name === 'src') continue;
    const childDir = join(dir, e.name);
    const pjPath = join(childDir, 'project.json');
    if (existsSync(pjPath)) {
      const pj = readProjectJson(pjPath);
      if (pj) out.push(toProjectInfo({ workspaceRoot, projectRoot: childDir, pj, targetName }));
    }
    // Keep recursing — this workspace nests sub-projects (e.g. packages/dbx-cli/lint-cache).
    collectProjects({ workspaceRoot, dir: childDir, out, targetName });
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

interface ToProjectInfoInput {
  readonly workspaceRoot: string;
  readonly projectRoot: string;
  readonly pj: RawProjectJson;
  readonly targetName: string;
}

function toProjectInfo(input: ToProjectInfoInput): ProjectInfo {
  const { workspaceRoot, projectRoot, pj, targetName } = input;
  const lintTarget = pj.targets?.[targetName];
  const lintPatterns = lintTarget?.options?.lintFilePatterns;
  return {
    name: pj.name ?? '',
    projectRoot: relative(workspaceRoot, projectRoot) || '.',
    absoluteRoot: projectRoot,
    lintFilePatterns: Array.isArray(lintPatterns) && lintPatterns.length > 0 ? lintPatterns : undefined,
    hasLintTarget: lintTarget != null
  };
}
