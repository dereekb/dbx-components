/**
 * `api` module — the deployed `<proj>-api` NestJS app (script lines 249-258,
 * 856-984). Generates a plain `@nx/node` esbuild app, installs the NestJS
 * runtime `@nx/nest` would otherwise have brought in, scaffolds the `apps/api`
 * subtree (whose `project.template.json` / `esbuild.config.template.js` /
 * `esbuild.prod.config.template.js` resolve via the per-file token map +
 * `.template` strip), and disables `esModuleInterop` + adds the `tsconfig.spec.json` project
 * reference in the generated tsconfig.
 *
 * `@nx/nest` is deliberately NOT used. It ships no executors — it is a
 * generators-only wrapper around `@nx/node:application` — and everything it adds
 * on top is either discarded here or actively unwanted:
 *
 * - it forces `bundler: 'webpack'` (`normalize-options.js`), against
 *   `@nx/node`'s own `esbuild` default, so the generated `build-base` named an
 *   executor this scaffold does not use and left a dead `webpack.config.js`
 *   behind (`@nx/node` deletes that file for every non-webpack bundler);
 * - its `updateTsConfig` writes `experimentalDecorators` /
 *   `emitDecoratorMetadata` / `target` into `tsconfig.app.json`, which the
 *   `apps/api` template overwrites wholesale — decorators come from
 *   `applyTsconfigBaseEdits` instead, and `emitDecoratorMetadata` stays off
 *   because esbuild cannot emit it and nothing reads it;
 * - its `createFiles` writes `app.controller.ts` + `app.service.ts`, which the
 *   template does not overwrite, so they survived as orphans;
 * - it defaults `e2eTestRunner` to `jest` (`@nx/node` defaults to `none`),
 *   generating an unwanted `<api>-e2e` project.
 *
 * The one thing it did that is genuinely needed is `ensureDependencies`, which
 * added the NestJS runtime to the root `package.json`. That is reproduced by the
 * `install` phase below.
 */

import { join } from 'node:path';
import { buildScaffoldPlan, type ScaffoldPlanEntry } from '../scaffold.js';
import { applyApiTsconfigEdits, editJsonFile } from '../json-edit.js';
import { SETUP_DEPENDENCY_VERSIONS } from '../versions.js';
import { type SetupContext, type SetupModule } from '../module.js';

/**
 * The NestJS runtime packages `@nx/nest`'s `ensureDependencies` used to add to the root
 * `package.json`. Pinned to the `@dereekb/firebase-server` peer range rather than `@nx/nest`'s
 * looser `^11.0.0`, so a strict install resolves.
 */
const API_NEST_RUNTIME_DEPENDENCIES: readonly string[] = ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs', 'tslib'];

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
 * Resolves a `name@version` install spec from the shared version table.
 *
 * @param name - The npm package name.
 * @returns The pinned install spec.
 */
function dependencySpec(name: string): string {
  return `${name}@${SETUP_DEPENDENCY_VERSIONS[name]}`;
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
    // `esbuild` is only an optional peer of `@nx/esbuild`, so npm will not install it on its own.
    await shell.run('npm', ['install', '-D', `@nx/node@${nx}`, `@nx/esbuild@${nx}`, `esbuild@${versions.core.esbuild}`], { cwd: workspaceRoot, dryRun });
    await shell.run('npx', ['-y', `nx@${nx}`, 'g', '@nx/node:app', `--name=${naming.apiAppName}`, `--directory=${naming.apiAppFolder}`, '--framework=none', '--bundler=esbuild', '--linter=eslint', '--unitTestRunner=none', '--e2eTestRunner=none'], { cwd: workspaceRoot, dryRun });
  },
  install: async (context) => {
    const { shell, workspaceRoot, dryRun } = context;
    await shell.run('npm', ['install', '--force', ...API_NEST_RUNTIME_DEPENDENCIES.map(dependencySpec), dependencySpec('sharp')], { cwd: workspaceRoot, dryRun });
  },
  configure: async (context) => {
    const { workspaceRoot, naming, dryRun } = context;
    editJsonFile(join(workspaceRoot, naming.apiAppFolder, 'tsconfig.json'), applyApiTsconfigEdits, { dryRun });
  }
};
