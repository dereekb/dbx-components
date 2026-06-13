/**
 * `workspace` module — creates the nx workspace (`create-nx-workspace`, script
 * line 220) and applies the nx.json layout / target-default / TUI edits (script
 * lines 244, 495-504). It scaffolds no template files; the angular app + cypress
 * e2e project are produced by `create-nx-workspace` itself.
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
    const nxCloud = versions.isCiTest ? 'skip' : 'yes';
    // create-nx-workspace runs in the parent dir and creates the project folder named after the project.
    await shell.run('npx', ['--yes', `create-nx-workspace@${versions.core.nx}`, `--name=${naming.projectName}`, `--appName=${naming.angularAppName}`, '--packageManager=npm', '--useGitHub', `--nxCloud=${nxCloud}`, '--interactive=false', '--style=scss', '--preset=angular-monorepo', '--workspaceType=package-based', '--unitTestRunner=vitest', '--e2eTestRunner=cypress', '--standaloneApi=true', '--ssr=false', '--routing=false'], { cwd: dirname(workspaceRoot), dryRun });
  },
  configure: async (context) => {
    const { workspaceRoot, naming, dryRun } = context;
    editJsonFile(join(workspaceRoot, 'nx.json'), (nxJson) => applyNxJsonEdits(nxJson, naming), { dryRun });
  }
};
