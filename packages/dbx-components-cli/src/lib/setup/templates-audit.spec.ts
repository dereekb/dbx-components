/**
 * Holds the shipped scaffold templates to the same workspace-convention audit
 * the downstream projects run.
 *
 * This is the mechanism that keeps convention consistent across projects. The
 * convention does not live in a document that each project is expected to
 * mirror — it lives in `dbx_workspace_validate`, and the template is just
 * another subject of the check. Without this spec the template is the one
 * workspace nobody audits, so a defect in it is silently inherited by every
 * project scaffolded afterwards.
 *
 * That is not hypothetical. The app template shipped
 * `ci-deploy-prod → build-base:prod` against a target declaring `production`,
 * and `ci-deploy-staging → build-base:staging` with no `staging`
 * configuration at all, for the entire life of the scaffold. Nx substitutes
 * `defaultConfiguration` for an unknown configuration name without a warning,
 * so both "worked" — hellosubs, advisorey, and joinfoodflip each inherited the
 * bug and patched a different subset of it.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Imported by relative path rather than through `@dereekb/dbx-cli/validate`. That
// barrel transitively reaches `@dereekb/dbx-cli/manifest-extract`, which imports the
// bare `@dereekb/dbx-cli` specifier — and `packages/dbx-cli/package.json` declares no
// root export, so it does not resolve under this project's vitest. (The same chain is
// why `src/cli.spec.ts` currently fails to load.) The `workspace-validate` cluster
// itself depends on nothing outside `_core`, so reaching it directly is sound.
import { inspectWorkspace, validateWorkspace, type ValidationResult } from '../../../../dbx-cli/validate/src/lib/workspace-validate/index.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { templateArchiveFromDirectory } from './archive.js';
import { deriveSetupNaming } from './naming.js';
import { applyScaffoldPlan, archiveScaffoldEntry, buildScaffoldPlan } from './scaffold.js';
import { buildSetupTokenTable } from './tokens.js';

const PACKAGE_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const TEMPLATES_DIR = join(PACKAGE_ROOT, 'templates');

/**
 * Template subtrees materialized into the fixture workspace, paired with the
 * naming field that supplies their destination folder.
 */
const SCAFFOLDED_SUBTREES: readonly { readonly subtree: string; readonly destKey: 'angularAppFolder' | 'apiAppFolder' }[] = [
  { subtree: 'apps/app', destKey: 'angularAppFolder' },
  { subtree: 'apps/api', destKey: 'apiAppFolder' }
];

describe('scaffold templates — workspace convention audit', () => {
  let workspaceRoot: string;
  let result: ValidationResult;
  let inspection: Awaited<ReturnType<typeof inspectWorkspace>>;

  beforeAll(async () => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'dbx-templates-audit-'));
    const naming = deriveSetupNaming({ firebaseProjectId: 'demoapp', projectName: 'demo', codePrefix: 'demo', emulatorBasePort: 9100 });
    const tokens = buildSetupTokenTable(naming);
    const archive = templateArchiveFromDirectory(TEMPLATES_DIR);

    for (const { subtree, destKey } of SCAFFOLDED_SUBTREES) {
      applyScaffoldPlan({ archive, plan: buildScaffoldPlan({ archive, subtree, destRoot: join(workspaceRoot, naming[destKey]), tokens }) });
    }
    // The root project + firebase.json come from the `root` module rather than a
    // subtree, so they are named explicitly. firebase.json in particular has to
    // land, or the `hosting:<target>` rule silently checks nothing.
    applyScaffoldPlan({
      archive,
      plan: [archiveScaffoldEntry({ archivePath: 'project.template.json', destPath: join(workspaceRoot, 'project.json'), tokens }), archiveScaffoldEntry({ archivePath: 'firebase.json', destPath: join(workspaceRoot, 'firebase.json'), tokens })]
    });
    writeFileSync(join(workspaceRoot, 'nx.json'), JSON.stringify({ workspaceLayout: { appsDir: 'apps', libsDir: 'components' } }, null, 2));

    inspection = await inspectWorkspace({ workspaceRoot });
    result = validateWorkspace({ inspection });
  });

  afterAll(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('materializes the app, api, and root projects with firebase.json', () => {
    // Asserted by name rather than by count: a silently-unwritten root or
    // firebase.json would make the hosting-target rule pass vacuously.
    expect([...inspection.projects].map((project) => project.name).sort()).toEqual(['demo', 'demo-api', 'workspace']);
    expect(inspection.firebase).toMatchObject({ present: true, hostingTargets: ['staging', 'prod'] });
    expect(result.referencesChecked).toBeGreaterThan(0);
  });

  it('has no error-severity convention violations', () => {
    const errors = result.violations.filter((violation) => violation.severity === 'error');
    expect(errors.map((violation) => `${violation.code} — ${violation.message}`)).toEqual([]);
  });

  it('has no warning-severity convention violations', () => {
    const warnings = result.violations.filter((violation) => violation.severity === 'warning');
    expect(warnings.map((violation) => `${violation.code} — ${violation.message}`)).toEqual([]);
  });

  it('gives every deploy lane a build configuration that exists', () => {
    // The specific regression the audit exists to prevent.
    expect(result.violations.filter((violation) => violation.code === 'WORKSPACE_TARGET_REF_CONFIGURATION_MISSING')).toEqual([]);
  });

  it('gives every deploy lane an environment selection', () => {
    expect(result.violations.filter((violation) => violation.code === 'WORKSPACE_DEPLOY_LANE_NO_ENVIRONMENT_SELECTION')).toEqual([]);
  });
});
