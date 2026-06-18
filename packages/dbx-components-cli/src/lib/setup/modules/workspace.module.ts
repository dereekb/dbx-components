/**
 * `workspace` module — creates the nx workspace (`create-nx-workspace`, script
 * line 220) and applies the nx.json layout / target-default / TUI edits (script
 * lines 244, 495-504). It scaffolds no template files; the angular app + cypress
 * e2e project are produced by `create-nx-workspace` itself.
 *
 * The workspace is created with `--nxCloud=skip` (the project never connects to
 * Nx Cloud). The verdaccio local-registry config that `create-nx-workspace` (and
 * the publishable-library generators that run after it) scaffold is removed later
 * by `init` once those generators have run — see `removeVerdaccioConfig`.
 */

import { dirname, join } from 'node:path';
import { applyNxJsonEdits, editJsonFile } from '../json-edit.js';
import { type SetupModule } from '../module.js';

/**
 * The workspace setup module.
 */
export const WORKSPACE_MODULE: SetupModule = {
  id: 'workspace',
  title: 'Nx workspace',
  buildScaffoldPlan: () => [],
  generate: async (context) => {
    const { naming, versions, shell, workspaceRoot, dryRun } = context;
    // create-nx-workspace runs in the parent dir and creates the project folder named after the project.
    await shell.run('npx', ['--yes', `create-nx-workspace@${versions.core.nx}`, `--name=${naming.projectName}`, `--appName=${naming.angularAppName}`, '--packageManager=npm', '--useGitHub', '--nxCloud=skip', '--interactive=false', '--style=scss', '--preset=angular-monorepo', '--workspaceType=package-based', '--unitTestRunner=vitest', '--e2eTestRunner=cypress', '--standaloneApi=true', '--ssr=false', '--routing=false'], { cwd: dirname(workspaceRoot), dryRun });
  },
  configure: async (context) => {
    const { workspaceRoot, naming, dryRun } = context;
    editJsonFile(join(workspaceRoot, 'nx.json'), (nxJson) => applyNxJsonEdits(nxJson, naming), { dryRun });
  }
};
