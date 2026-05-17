import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const TOP_LEVEL_DIRS: readonly string[] = ['apps', 'packages', 'tools'];
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', 'coverage', '.nx', '.angular', '.next']);

export interface ProjectInfo {
  readonly name: string;
  readonly projectRoot: string;
  readonly absoluteRoot: string;
  readonly lintFilePatterns: readonly string[] | undefined;
  readonly hasLintTarget: boolean;
}

/**
 * Locates an Nx project by name by scanning known top-level directories
 * (apps/, packages/, tools/) and the workspace-root project.json. Returns the
 * project's workspace-relative root and its `lint.options.lintFilePatterns` if
 * one was declared.
 */
export function findProject(workspaceRoot: string, projectName: string): ProjectInfo | null {
  let result: ProjectInfo | null = null;

  for (const dir of TOP_LEVEL_DIRS) {
    if (result) break;
    const base = join(workspaceRoot, dir);
    if (!existsSync(base)) continue;
    result = walkForProject(workspaceRoot, base, projectName);
  }

  if (!result) {
    const rootProject = readProjectJson(join(workspaceRoot, 'project.json'));
    if (rootProject && rootProject.name === projectName) {
      result = toProjectInfo(workspaceRoot, workspaceRoot, rootProject);
    }
  }

  return result;
}

function walkForProject(workspaceRoot: string, dir: string, projectName: string): ProjectInfo | null {
  let found: ProjectInfo | null = null;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (found) break;
    if (!e.isDirectory()) continue;
    if (SKIP_DIR_NAMES.has(e.name) || e.name.startsWith('.')) continue;
    const childDir = join(dir, e.name);
    const pjPath = join(childDir, 'project.json');
    if (existsSync(pjPath)) {
      const pj = readProjectJson(pjPath);
      if (pj && pj.name === projectName) {
        found = toProjectInfo(workspaceRoot, childDir, pj);
        continue;
      }
    }
    found = walkForProject(workspaceRoot, childDir, projectName);
  }
  return found;
}

/**
 * Walks the workspace and returns every project. Filtering by `hasLintTarget`
 * is left to the caller so this stays useful for future inspection commands
 * that do not care whether `lint` is wired up.
 */
export function listProjects(workspaceRoot: string): readonly ProjectInfo[] {
  const out: ProjectInfo[] = [];

  for (const dir of TOP_LEVEL_DIRS) {
    const base = join(workspaceRoot, dir);
    if (!existsSync(base)) continue;
    collectProjects(workspaceRoot, base, out);
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

function readProjectJson(path: string): RawProjectJson | null {
  let parsed: RawProjectJson | null;
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
