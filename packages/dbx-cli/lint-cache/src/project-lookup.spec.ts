import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findProject, listProjects } from './project-lookup.js';

describe('project-lookup', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'dbx-lint-cache-lookup-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  describe('listProjects', () => {
    it('discovers projects under non-standard top-level dirs (components/, libs/) alongside apps/packages/tools', async () => {
      await scaffoldProject({ workspaceRoot, relDir: 'apps/app-a', name: 'app-a', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'packages/pkg-b', name: 'pkg-b', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'tools/tool-c', name: 'tool-c', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'components/comp-d', name: 'comp-d', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'libs/lib-e', name: 'lib-e', lint: true });

      const projects = listProjects(workspaceRoot);

      expect(projects.map((p) => p.name)).toEqual(['app-a', 'comp-d', 'lib-e', 'pkg-b', 'tool-c']);
      const compD = projects.find((p) => p.name === 'comp-d');
      expect(compD?.projectRoot).toBe('components/comp-d');
      expect(compD?.hasLintTarget).toBe(true);
    });

    it('skips dependency/build/cache dirs and hidden dirs even when they contain a project.json', async () => {
      await scaffoldProject({ workspaceRoot, relDir: 'components/real', name: 'real', lint: true });
      // top-level dirs that must never be scanned
      await scaffoldProject({ workspaceRoot, relDir: 'node_modules/ghost-a', name: 'ghost-a', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'dist/ghost-b', name: 'ghost-b', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'coverage/ghost-c', name: 'ghost-c', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: '.nx/ghost-d', name: 'ghost-d', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: '.angular/ghost-e', name: 'ghost-e', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: '.next/ghost-f', name: 'ghost-f', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: '.hidden/ghost-g', name: 'ghost-g', lint: true });
      // skip dirs must also be honored at nested levels of the walk
      await scaffoldProject({ workspaceRoot, relDir: 'apps/app-a/node_modules/ghost-h', name: 'ghost-h', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'apps/app-a', name: 'app-a', lint: true });

      const projects = listProjects(workspaceRoot);

      expect(projects.map((p) => p.name)).toEqual(['app-a', 'real']);
    });

    it('includes the workspace-root project.json', async () => {
      await scaffoldProject({ workspaceRoot, relDir: '', name: 'root-project', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'packages/pkg-b', name: 'pkg-b', lint: true });

      const projects = listProjects(workspaceRoot);

      const root = projects.find((p) => p.name === 'root-project');
      expect(root).toBeDefined();
      expect(root?.projectRoot).toBe('.');
    });

    it('captures hasLintTarget and lintFilePatterns', async () => {
      await scaffoldProject({ workspaceRoot, relDir: 'packages/with-lint', name: 'with-lint', lint: true, lintFilePatterns: ['packages/with-lint/**/*.ts'] });
      await scaffoldProject({ workspaceRoot, relDir: 'packages/no-lint', name: 'no-lint', lint: false });

      const projects = listProjects(workspaceRoot);

      const withLint = projects.find((p) => p.name === 'with-lint');
      expect(withLint?.hasLintTarget).toBe(true);
      expect(withLint?.lintFilePatterns).toEqual(['packages/with-lint/**/*.ts']);

      const noLint = projects.find((p) => p.name === 'no-lint');
      expect(noLint?.hasLintTarget).toBe(false);
      expect(noLint?.lintFilePatterns).toBeUndefined();
    });

    it('discovers nested sub-projects (recursion through a grouping directory)', async () => {
      // mirrors this workspace's own packages/dbx-cli/lint-cache nesting
      await scaffoldProject({ workspaceRoot, relDir: 'packages/group/sub-a', name: 'sub-a', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'packages/group/sub-b', name: 'sub-b', lint: true });

      const projects = listProjects(workspaceRoot);

      expect(projects.map((p) => p.name)).toEqual(['sub-a', 'sub-b']);
      expect(projects.find((p) => p.name === 'sub-a')?.projectRoot).toBe('packages/group/sub-a');
    });

    it('returns an empty array for a workspace with no projects', async () => {
      await mkdir(join(workspaceRoot, 'apps'), { recursive: true });
      const projects = listProjects(workspaceRoot);
      expect(projects).toEqual([]);
    });
  });

  describe('findProject', () => {
    it('resolves a project under a non-standard top-level dir (components/)', async () => {
      await scaffoldProject({ workspaceRoot, relDir: 'components/comp-d', name: 'comp-d', lint: true, lintFilePatterns: ['components/comp-d/**/*.ts'] });

      const project = findProject(workspaceRoot, 'comp-d');

      expect(project?.name).toBe('comp-d');
      expect(project?.projectRoot).toBe('components/comp-d');
      expect(project?.lintFilePatterns).toEqual(['components/comp-d/**/*.ts']);
    });

    it('resolves apps/packages/tools projects (no regression)', async () => {
      await scaffoldProject({ workspaceRoot, relDir: 'apps/app-a', name: 'app-a', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'packages/pkg-b', name: 'pkg-b', lint: true });
      await scaffoldProject({ workspaceRoot, relDir: 'tools/tool-c', name: 'tool-c', lint: true });

      expect(findProject(workspaceRoot, 'app-a')?.projectRoot).toBe('apps/app-a');
      expect(findProject(workspaceRoot, 'pkg-b')?.projectRoot).toBe('packages/pkg-b');
      expect(findProject(workspaceRoot, 'tool-c')?.projectRoot).toBe('tools/tool-c');
    });

    it('falls back to the workspace-root project.json', async () => {
      await scaffoldProject({ workspaceRoot, relDir: '', name: 'root-project', lint: true });

      const project = findProject(workspaceRoot, 'root-project');

      expect(project?.name).toBe('root-project');
      expect(project?.projectRoot).toBe('.');
    });

    it('returns null for an unknown project', async () => {
      await scaffoldProject({ workspaceRoot, relDir: 'packages/pkg-b', name: 'pkg-b', lint: true });
      expect(findProject(workspaceRoot, 'does-not-exist')).toBeNull();
    });

    it('does not resolve a project hidden inside a skipped dir', async () => {
      await scaffoldProject({ workspaceRoot, relDir: 'node_modules/ghost', name: 'ghost', lint: true });
      expect(findProject(workspaceRoot, 'ghost')).toBeNull();
    });
  });
});

interface ScaffoldProjectInput {
  readonly workspaceRoot: string;
  /** Workspace-relative directory for the project; `''` places it at the workspace root. */
  readonly relDir: string;
  readonly name: string;
  readonly lint: boolean;
  readonly lintFilePatterns?: readonly string[];
}

async function scaffoldProject(input: ScaffoldProjectInput): Promise<void> {
  const dir = join(input.workspaceRoot, input.relDir);
  await mkdir(dir, { recursive: true });
  const targets: Record<string, unknown> = {};
  if (input.lint) {
    targets['lint'] = { executor: '@nx/eslint:lint', options: input.lintFilePatterns ? { lintFilePatterns: input.lintFilePatterns } : {} };
  }
  await writeFile(join(dir, 'project.json'), JSON.stringify({ name: input.name, targets }), 'utf8');
}
