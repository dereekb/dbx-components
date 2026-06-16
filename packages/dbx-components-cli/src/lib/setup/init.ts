/**
 * Full `setup init` orchestration: the ordered phase sequence that reproduces
 * `setup-project.sh`. Generators + installs + git checkpoints shell out (the
 * environment-dependent boundary); the scaffold phases are deterministic.
 *
 * Git checkpoint messages reuse the script's exact wording. A few of the
 * script's finer-grained checkpoints (Docker files / semver / vitest / circleci)
 * are folded into the surrounding root-config checkpoints, since this port
 * scaffolds the root config as one unit.
 */

import { runModuleScaffold, runModulePhases, type SetupContext } from './module.js';
import { API_MODULE, APP_COMPONENTS_MODULE, APP_MODULE, FIREBASE_COMPONENTS_MODULE, INTEGRATIONS_MODULE, ROOT_MODULE, WORKSPACE_MODULE } from './modules/index.js';

/**
 * Phase-skipping flags for `setup init`.
 */
export interface SetupInitFlags {
  /**
   * Interactive firebase init (vs scaffolding rules from templates).
   */
  readonly manual: boolean;
  /**
   * Run only the deterministic scaffold phases.
   */
  readonly templatesOnly: boolean;
  readonly skipInstall: boolean;
  readonly skipGenerate: boolean;
  readonly skipGit: boolean;
  readonly skipFirebaseInit: boolean;
  readonly skipFinal: boolean;
}

/**
 * Result of an `init` run.
 */
export interface SetupInitResult {
  readonly text: string;
  /**
   * Ordered log of the phases that ran.
   */
  readonly steps: readonly string[];
}

/**
 * Runs the full ordered setup sequence.
 *
 * @param context - The resolved setup context.
 * @param flags - Phase-skipping flags.
 * @returns The run summary + ordered step log.
 */
export async function runSetupInit(context: SetupContext, flags: SetupInitFlags): Promise<SetupInitResult> {
  const { shell, workspaceRoot, dryRun, versions } = context;
  const cwd = workspaceRoot;
  const steps: string[] = [];

  const record = (step: string): void => {
    steps.push(step);
    context.log(`▶ ${step}`);
  };

  const commit = async (message: string): Promise<void> => {
    if (flags.templatesOnly || flags.skipGit) {
      return;
    }
    await shell.run('git', ['add', '--all'], { cwd, dryRun });
    await shell.run('git', ['commit', '--no-verify', '-m', message], { cwd, dryRun });
    record(`commit: ${message}`);
  };

  // 1. Firebase login (skipped in ci-test / templates-only / when disabled).
  if (!flags.templatesOnly && !flags.skipFirebaseInit && !versions.isCiTest) {
    record('firebase login');
    await shell.run('npx', ['firebase', 'login'], { cwd, dryRun });
  }

  // 2. Workspace (create-nx-workspace + nx.json layout/target-defaults/tui).
  record('workspace: create-nx-workspace + nx.json');
  await runModulePhases(WORKSPACE_MODULE, context, { skipGenerate: flags.templatesOnly || flags.skipGenerate, skipInstall: true, skipScaffold: true, skipConfigure: flags.templatesOnly });
  await commit('checkpoint: updated nx to latest version');

  // 3. NestJS API generate + sharp install.
  record('api: generate + sharp');
  await runModulePhases(API_MODULE, context, { skipGenerate: flags.templatesOnly || flags.skipGenerate, skipInstall: flags.templatesOnly || flags.skipInstall, skipScaffold: true, skipConfigure: true });
  await commit('checkpoint: added nest app');

  // 4. Angular components library generate.
  record('app-components: generate');
  await runModulePhases(APP_COMPONENTS_MODULE, context, { skipGenerate: flags.templatesOnly || flags.skipGenerate, skipInstall: true, skipScaffold: true, skipConfigure: true });
  await commit('checkpoint: added angular components package');

  // 5. Firebase components library generate + firebase-tools install.
  record('firebase-components: generate');
  await runModulePhases(FIREBASE_COMPONENTS_MODULE, context, { skipGenerate: flags.templatesOnly || flags.skipGenerate, skipInstall: flags.templatesOnly || flags.skipInstall, skipScaffold: true, skipConfigure: true });
  await commit('checkpoint: added firebase components package');

  // 6-7. Root config scaffold (firebase config, docker, utility scripts, husky hooks, vitest preset,
  //      per-project .env, circleci, root project.json). Folds the script's separate docker checkpoint.
  record('root: scaffold config + docker + scripts');
  runModuleScaffold(ROOT_MODULE, context);
  await commit('checkpoint: added firebase configuration');

  // 8-10. Root installs (husky/commitlint/prettier, vitest, @dereekb + npm deps).
  if (!flags.templatesOnly && !flags.skipInstall) {
    record('root: install dependencies');
    await runModulePhases(ROOT_MODULE, context, { skipGenerate: true, skipInstall: false, skipScaffold: true, skipConfigure: true });
  }
  await commit('checkpoint: added @dereekb dependencies');

  // 12. Project configuration edits (firebase.json json-edits, tsconfig.base, api tsconfig esModuleInterop).
  if (!flags.templatesOnly) {
    record('configure: firebase.json + tsconfig edits');
    await runModulePhases(ROOT_MODULE, context, { skipGenerate: true, skipInstall: true, skipScaffold: true, skipConfigure: false });
    await runModulePhases(API_MODULE, context, { skipGenerate: true, skipInstall: true, skipScaffold: true, skipConfigure: false });
  }
  await commit('checkpoint: added project configurations');

  // 13. App components scaffold.
  record('app-components: scaffold');
  runModuleScaffold(APP_COMPONENTS_MODULE, context);
  await commit('checkpoint: setup app components');

  // 14. Firebase components scaffold.
  record('firebase-components: scaffold');
  runModuleScaffold(FIREBASE_COMPONENTS_MODULE, context);
  await commit('checkpoint: setup api components');

  // 15. Angular app scaffold.
  record('app: scaffold');
  runModuleScaffold(APP_MODULE, context);
  await commit('checkpoint: setup app');

  // 16. API scaffold.
  record('api: scaffold');
  runModuleScaffold(API_MODULE, context);

  // 17-18. Integrations (zoho scripts) + dbx.setup.json manifest.
  record('integrations: scaffold + manifest');
  runModuleScaffold(INTEGRATIONS_MODULE, context);
  await commit('checkpoint: setup api');

  // 19. Final builds / tests / docker reset (skipped in ci-test / templates-only / when disabled).
  if (!flags.templatesOnly && !flags.skipFinal && !versions.isCiTest) {
    record('final: build + test + docker reset');
    await shell.run('npx', ['-y', `nx@${versions.core.nx}`, 'build', context.naming.angularAppName], { cwd, dryRun });
    await shell.run('npx', ['-y', `nx@${versions.core.nx}`, 'build', context.naming.apiAppName], { cwd, dryRun });
    await shell.run('npx', ['-y', `nx@${versions.core.nx}`, 'test', context.naming.angularAppName], { cwd, dryRun });
    await shell.run('sh', ['./down.sh'], { cwd, dryRun });
    await shell.run('sh', ['./reset.sh'], { cwd, dryRun });
    await shell.run('sh', ['./test-all.sh'], { cwd, dryRun });
  }

  // 20. Squash all checkpoints into a single orphan commit.
  if (!flags.templatesOnly && !flags.skipGit) {
    record('git: squash into started dbx-components project');
    await shell.run('bash', ['-c', 'git reset "$(git commit-tree HEAD^{tree} -m "started dbx-components project")"'], { cwd, dryRun });
  }

  const mode = flags.templatesOnly ? 'scaffolded templates' : 'ran full setup';
  const stepLines = steps.map((step) => `  - ${step}`).join('\n');
  const text = `setup init: ${mode} for "${context.naming.projectName}" in ${workspaceRoot}\n${stepLines}`;
  return { text, steps };
}
