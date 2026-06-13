/**
 * `firebase-components` module — the shared `<proj>-firebase` `@nx/node` library
 * (script lines 276-281, 680-754). Generates the library, then scaffolds the
 * `components/firebase` template subtree plus the two literal barrel/test-setup
 * files the script `echo`s.
 */

import { join } from 'node:path';
import { buildScaffoldPlan, literalScaffoldEntry, type ScaffoldPlanEntry } from '../scaffold.js';
import { type SetupContext, type SetupModule } from '../module.js';

/**
 * Builds the firebase-components scaffold plan.
 *
 * @param context - The shared setup context.
 * @returns The plan entries.
 */
function buildPlan(context: SetupContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, naming, archive, tokens } = context;
  const destRoot = join(workspaceRoot, naming.firebaseComponentsFolder);
  return [...buildScaffoldPlan({ archive, subtree: 'components/firebase', destRoot, tokens }), literalScaffoldEntry({ destPath: join(destRoot, 'src/index.ts'), content: "export * from './lib'\n" }), literalScaffoldEntry({ destPath: join(destRoot, 'src/test-setup.ts'), content: "import '@dereekb/vitest/setup-firebase'\n" })];
}

/**
 * The firebase-components setup module.
 */
export const FIREBASE_COMPONENTS_MODULE: SetupModule = {
  id: 'firebase-components',
  title: 'Firebase components library',
  buildScaffoldPlan: buildPlan,
  generate: async (context) => {
    const { naming, versions, shell, workspaceRoot, dryRun } = context;
    const nx = versions.core.nx;
    await shell.run('npm', ['install', '-D', `@nx/node@${nx}`], { cwd: workspaceRoot, dryRun });
    await shell.run('npx', ['-y', `nx@${nx}`, 'g', '@nx/node:library', `--name=${naming.firebaseComponentsName}`, `--directory=${naming.firebaseComponentsFolder}`, '--buildable', '--publishable', '--importPath', naming.firebaseComponentsName, '--linter=eslint', '--unitTestRunner=none'], { cwd: workspaceRoot, dryRun });
  },
  install: async (context) => {
    const { versions, shell, workspaceRoot, dryRun } = context;
    await shell.run('npm', ['install', '-D', `firebase-tools@${versions.core.firebaseTools}`], { cwd: workspaceRoot, dryRun });
  }
};
