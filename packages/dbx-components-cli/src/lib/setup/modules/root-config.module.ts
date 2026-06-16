/**
 * `root` module — everything at the workspace root: firebase config, docker,
 * utility `.sh` scripts, circleci, husky/commitlint/prettier, the vitest preset +
 * setups, the big `@dereekb`/npm dependency install, and the project.json /
 * tsconfig / firebase.json edits (script lines 311-613, plus the per-project
 * `.env` fan-out at 483-491).
 */

import { join } from 'node:path';
import { archiveScaffoldEntry, buildScaffoldPlan, literalScaffoldEntry, type ScaffoldPlanEntry } from '../scaffold.js';
import { applyFirebaseJsonEdits, applyTsconfigBaseEdits, editJsonFile } from '../json-edit.js';
import { DEREEKB_PACKAGES, SETUP_DEPENDENCY_VERSIONS, deriveCiDistVersionMap } from '../versions.js';
import { type SetupContext, type SetupModule } from '../module.js';

/**
 * Top-level template files scaffolded into the workspace root, with explicit dest names.
 */
const ROOT_LEVEL_FILES: readonly { readonly archivePath: string; readonly dest: string; readonly noTokens?: boolean }[] = [
  { archivePath: 'firebase.json', dest: 'firebase.json' },
  { archivePath: '.firebaserc', dest: '.firebaserc' },
  { archivePath: 'firestore.indexes.json', dest: 'firestore.indexes.json' },
  { archivePath: 'firestore.rules', dest: 'firestore.rules' },
  { archivePath: 'storage.rules', dest: 'storage.rules' },
  { archivePath: 'eslint.config.template.mjs', dest: 'eslint.config.mjs', noTokens: true },
  { archivePath: 'vitest.preset.config.mts', dest: 'vitest.preset.config.mts', noTokens: true },
  { archivePath: 'project.template.json', dest: 'project.json', noTokens: true },
  { archivePath: 'make-api-package.js', dest: 'make-api-package.js' },
  { archivePath: 'update-dbx-components.sh', dest: 'update-dbx-components.sh' },
  { archivePath: '.circleci/config.yml', dest: '.circleci/config.yml' }
];

/**
 * Builds the per-project `.env` fan-out entries (source `apps/.env`, `APP_ID`
 * substituted per destination).
 *
 * @param context - The shared setup context.
 * @returns One `.env` entry per app + component project.
 */
function buildEnvFanout(context: SetupContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, naming, tokens } = context;
  const targets: readonly { readonly folder: string; readonly appId: string }[] = [
    { folder: naming.angularAppFolder, appId: naming.angularAppName },
    { folder: naming.apiAppFolder, appId: naming.apiAppName },
    { folder: naming.e2eAppFolder, appId: naming.e2eAppName },
    { folder: naming.angularComponentsFolder, appId: naming.angularComponentsName },
    { folder: naming.firebaseComponentsFolder, appId: naming.firebaseComponentsName }
  ];
  return targets.map((target) => archiveScaffoldEntry({ archivePath: 'apps/.env', destPath: join(workspaceRoot, target.folder, '.env'), tokens, tokensOverride: [{ search: 'APP_ID', replace: target.appId }] }));
}

/**
 * Builds the root scaffold plan.
 *
 * @param context - The shared setup context.
 * @returns The plan entries.
 */
function buildPlan(context: SetupContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, naming, archive, tokens } = context;

  // The whole root/ subtree, minus the apps-demo files (owned by the app module), with the
  // test-demo-api.sh rename applied.
  const rootSubtree = buildScaffoldPlan({ archive, subtree: 'root', destRoot: workspaceRoot, tokens, pathOverrides: new Map([['root/test-demo-api.sh', `test-${naming.apiAppName}.sh`]]) }).filter((entry) => !entry.archivePath?.startsWith('root/apps-demo/'));

  const topLevel = ROOT_LEVEL_FILES.map((file) => archiveScaffoldEntry({ archivePath: file.archivePath, destPath: join(workspaceRoot, file.dest), tokens, tokensOverride: file.noTokens ? [] : undefined }));

  const literals: readonly ScaffoldPlanEntry[] = [literalScaffoldEntry({ destPath: join(workspaceRoot, '.env.local'), content: 'SECRETS=\n' }), literalScaffoldEntry({ destPath: join(workspaceRoot, '.env.prod'), content: 'PUBLIC_PROD_VARIABLES_HERE\n' }), literalScaffoldEntry({ destPath: join(workspaceRoot, '.env.staging'), content: 'PUBLIC_STAGING_VARIABLES_HERE\n' })];

  return [...rootSubtree, ...topLevel, ...literals, ...buildEnvFanout(context)];
}

/**
 * Builds the versioned `@dereekb/*` install specs (npm vs CI dist folder).
 *
 * @param context - The shared setup context.
 * @returns The `name@version` install specs for every `@dereekb/*` package.
 */
function buildDereekbSpecs(context: SetupContext): readonly string[] {
  const { versions } = context;
  const ciMap = versions.isCiTest ? deriveCiDistVersionMap() : undefined;
  return DEREEKB_PACKAGES.map((pkg) => `${pkg}@${ciMap ? ciMap[pkg] : versions.core.dbxComponents}`);
}

/**
 * The root setup module.
 */
export const ROOT_MODULE: SetupModule = {
  id: 'root',
  title: 'Root config + dependencies',
  buildScaffoldPlan: buildPlan,
  install: async (context) => {
    const { shell, workspaceRoot, dryRun, versions } = context;
    const dep = (name: keyof typeof SETUP_DEPENDENCY_VERSIONS): string => `${String(name)}@${SETUP_DEPENDENCY_VERSIONS[name]}`;
    const nx = versions.core.nx;

    // husky / commitlint / prettier (script line 451) + husky init (457)
    await shell.run('npm', ['install', '-D', 'husky', dep('prettier'), dep('pretty-quick'), '@commitlint/cli', '@commitlint/config-angular', dep('eslint-plugin-import-x'), dep('eslint-plugin-unused-imports'), dep('eslint-config-prettier'), dep('eslint-plugin-jsdoc'), dep('eslint-plugin-sonarjs'), dep('eslint-plugin-unicorn')], { cwd: workspaceRoot, dryRun });
    await shell.run('npx', ['husky', 'init'], { cwd: workspaceRoot, dryRun });

    // vitest (script line 473)
    await shell.run('npm', ['install', '-D', `@nx/vitest@${nx}`, `@nx/vite@${nx}`, dep('@analogjs/vite-plugin-angular')], { cwd: workspaceRoot, dryRun });

    // @dereekb + firebase deps (script line 511)
    await shell.run('npm', ['install', '--force', dep('mailgun.js'), dep('rxjs'), dep('firebase'), dep('firebase-admin'), dep('firebase-functions'), ...buildDereekbSpecs(context)], { cwd: workspaceRoot, dryRun });

    // mapbox deps (script line 514)
    await shell.run('npm', ['install', '--force', dep('mapbox-gl'), dep('ngx-mapbox-gl'), dep('@ng-web-apis/geolocation'), dep('@ng-web-apis/common')], { cwd: workspaceRoot, dryRun });

    // dev deps (script lines 553-554)
    await shell.run('npm', ['install', '--force', '-D', `firebase-tools@${versions.core.firebaseTools}`, dep('firebase-functions-test'), dep('@firebase/rules-unit-testing'), 'envfile', 'env-cmd'], { cwd: workspaceRoot, dryRun });
    await shell.run('npm', ['install', '--force', '-D', dep('@types/segment-analytics'), dep('@ngrx/store-devtools')], { cwd: workspaceRoot, dryRun });
  },
  configure: async (context) => {
    const { workspaceRoot, naming, versions, dryRun } = context;
    editJsonFile(join(workspaceRoot, 'firebase.json'), (firebaseJson) => applyFirebaseJsonEdits(firebaseJson, naming, versions.core.node), { dryRun });
    editJsonFile(join(workspaceRoot, 'tsconfig.base.json'), applyTsconfigBaseEdits, { dryRun });
  }
};
