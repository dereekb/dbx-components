import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { templateArchiveFromDirectory } from './archive.js';
import { deriveSetupNaming } from './naming.js';
import { buildSetupTokenTable } from './tokens.js';
import { resolveSetupVersions } from './versions.js';
import { type ShellRunner } from './shell.js';
import { type SetupContext } from './module.js';
import { runSetupInit, type SetupInitFlags } from './init.js';

const TEMPLATES_DIR = resolve(__dirname, '../../../templates');

function recordingShell(): { readonly runner: ShellRunner; readonly commands: string[] } {
  const commands: string[] = [];
  return {
    commands,
    runner: {
      run: async (command, args) => {
        commands.push([command, ...args].join(' '));
      }
    }
  };
}

function makeContext(shell: ShellRunner, isCiTest: boolean): SetupContext {
  const naming = deriveSetupNaming({ firebaseProjectId: 'gethapierapp', projectName: 'gethapier', codePrefix: 'getHapier', emulatorBasePort: 9300 });
  return {
    workspaceRoot: '/tmp/dbxc-init-test',
    archive: templateArchiveFromDirectory(TEMPLATES_DIR),
    naming,
    tokens: buildSetupTokenTable(naming),
    versions: resolveSetupVersions({ isCiTest }),
    sourceBranch: 'develop',
    createdAt: '2026-06-13T00:00:00Z',
    dryRun: true,
    shell,
    log: () => undefined
  };
}

const FULL_FLAGS: SetupInitFlags = { manual: false, templatesOnly: false, skipInstall: false, skipGenerate: false, skipGit: false, skipFirebaseInit: false, skipFinal: false };

describe('runSetupInit', () => {
  it('runs the ordered phases with the script checkpoint messages', async () => {
    const shell = recordingShell();
    const result = await runSetupInit(makeContext(shell.runner, false), FULL_FLAGS);

    expect(result.steps).toContain('commit: checkpoint: updated nx to latest version');
    expect(result.steps).toContain('commit: checkpoint: added nest app');
    expect(result.steps).toContain('commit: checkpoint: setup app components');
    expect(result.steps).toContain('commit: checkpoint: setup api');

    const joined = shell.commands.join('\n');
    expect(joined).toContain('create-nx-workspace@23.0.0');
    expect(joined).toContain('@nx/nest:app');
    expect(joined).toContain('git commit --no-verify -m checkpoint: updated nx to latest version');
    expect(joined).toContain('git reset');
    // Late steps: verdaccio cleanup + dependency alignment + a final reconcile install.
    expect(result.steps).toContain('finalize: verdaccio cleanup + dependency alignment');
    expect(result.steps).toContain('install: reconcile node_modules');
    expect(shell.commands).toContain('npm install --legacy-peer-deps');
  });

  it('skips login + final phases in ci-test mode', async () => {
    const shell = recordingShell();
    await runSetupInit(makeContext(shell.runner, true), FULL_FLAGS);
    const joined = shell.commands.join('\n');
    expect(joined).not.toContain('firebase login');
    expect(joined).not.toContain('test-all.sh');
    // CI dist install path is used for @dereekb packages.
    expect(joined).toContain('file:~/code/dist/packages/util');
  });

  it('runs only scaffold-relevant work under templatesOnly (no shell-outs, no git)', async () => {
    const shell = recordingShell();
    const result = await runSetupInit(makeContext(shell.runner, false), { ...FULL_FLAGS, templatesOnly: true });
    expect(shell.commands).toEqual([]);
    expect(result.steps.some((step) => step.startsWith('commit:'))).toBe(false);
  });
});
