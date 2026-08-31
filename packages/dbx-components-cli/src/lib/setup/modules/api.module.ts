/**
 * `api` module — the deployed `<proj>-api` NestJS app (script lines 249-258,
 * 856-984). Generates the nest app, scaffolds the `apps/api` subtree (whose
 * `project.template.json` / `esbuild.config.template.js` /
 * `esbuild.prod.config.template.js` resolve via the per-file token map +
 * `.template` strip), drops the generator's leftover `webpack.config.js`, and
 * disables `esModuleInterop` in the generated tsconfig.
 */

import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildScaffoldPlan, type ScaffoldPlanEntry } from '../scaffold.js';
import { applyApiTsconfigEdits, editJsonFile } from '../json-edit.js';
import { type SetupContext, type SetupModule } from '../module.js';

/**
 * Builds the api scaffold plan.
 *
 * @param context - The shared setup context.
 * @returns The plan entries.
 */
function buildPlan(context: SetupContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, naming, archive, tokens } = context;
  const destRoot = join(workspaceRoot, naming.apiAppFolder);
  return buildScaffoldPlan({ archive, subtree: 'apps/api', destRoot, tokens });
}

/**
 * The api setup module.
 */
export const API_MODULE: SetupModule = {
  id: 'api',
  title: 'NestJS API app',
  buildScaffoldPlan: buildPlan,
  generate: async (context) => {
    const { naming, versions, shell, workspaceRoot, dryRun } = context;
    const nx = versions.core.nx;
    // `@nx/nest`'s normalize-options hardcodes `bundler: 'webpack'`, so the generated project would
    // reference an executor the workspace does not own — the scaffolded `project.json` replaces the
    // target with `@nx/esbuild:esbuild`, so install that bundler alongside it.
    await shell.run('npm', ['install', '-D', `@nx/nest@${nx}`, `@nx/esbuild@${nx}`, `esbuild@${versions.core.esbuild}`], { cwd: workspaceRoot, dryRun });
    await shell.run('npx', ['-y', `nx@${nx}`, 'g', '@nx/nest:app', `--name=${naming.apiAppName}`, `--directory=${naming.apiAppFolder}`, '--linter=eslint', '--unitTestRunner=none'], { cwd: workspaceRoot, dryRun });
  },
  install: async (context) => {
    const { shell, workspaceRoot, dryRun } = context;
    await shell.run('npm', ['install', '--force', 'sharp@^0.34.5'], { cwd: workspaceRoot, dryRun });
  },
  configure: async (context) => {
    const { workspaceRoot, naming, dryRun, log } = context;
    const apiAppFolder = join(workspaceRoot, naming.apiAppFolder);
    // `@nx/node`'s application generator only deletes its `webpack.config.js` when the bundler is
    // not webpack, and `@nx/nest` hardcodes webpack — so the scaffolded esbuild `build-base` leaves
    // it behind as dead config (script line 599's `rm`).
    const generatedWebpackConfig = join(apiAppFolder, 'webpack.config.js');

    if (existsSync(generatedWebpackConfig)) {
      log(`removing generator leftover: ${generatedWebpackConfig}`);

      if (!dryRun) {
        rmSync(generatedWebpackConfig);
      }
    }

    editJsonFile(join(apiAppFolder, 'tsconfig.json'), applyApiTsconfigEdits, { dryRun });
  }
};
