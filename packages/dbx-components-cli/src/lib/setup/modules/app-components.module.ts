/**
 * `app-components` module — the shared `<proj>-components` `@nx/angular` library
 * (script lines 260-273, 632-674). Generates the library (after the pinned
 * Angular reinstall), then scaffolds the `components/app` subtree plus the
 * literal barrel file.
 */

import { join } from 'node:path';
import { buildScaffoldPlan, literalScaffoldEntry, type ScaffoldPlanEntry } from '../scaffold.js';
import { type SetupContext, type SetupModule } from '../module.js';

/**
 * Builds the app-components scaffold plan.
 *
 * @param context - The shared setup context.
 * @returns The plan entries.
 */
function buildPlan(context: SetupContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, naming, archive, tokens } = context;
  const destRoot = join(workspaceRoot, naming.angularComponentsFolder);
  return [...buildScaffoldPlan({ archive, subtree: 'components/app', destRoot, tokens }), literalScaffoldEntry({ destPath: join(destRoot, 'src/index.ts'), content: "export * from './lib'\n" })];
}

/**
 * The app-components setup module.
 */
export const APP_COMPONENTS_MODULE: SetupModule = {
  id: 'app-components',
  title: 'Angular components library',
  buildScaffoldPlan: buildPlan,
  generate: async (context) => {
    const { naming, versions, shell, workspaceRoot, dryRun } = context;
    const nx = versions.core.nx;
    await shell.run('npx', ['-y', `nx@${nx}`, 'g', '@nx/angular:library', `--name=${naming.angularComponentsName}`, `--directory=${naming.angularComponentsFolder}`, '--buildable', '--publishable', '--importPath', naming.angularComponentsName, '--standalone=true', '--changeDetection=OnPush', '--linter=eslint', '--unitTestRunner=vitest-angular'], { cwd: workspaceRoot, dryRun });
  }
};
