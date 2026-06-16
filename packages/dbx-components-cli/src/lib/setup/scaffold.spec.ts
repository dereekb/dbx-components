import { mkdtempSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { templateArchiveFromDirectory } from './archive.js';
import { deriveSetupNaming } from './naming.js';
import { buildSetupTokenTable } from './tokens.js';
import { buildScaffoldPlan, applyScaffoldPlan } from './scaffold.js';

const TEMPLATES_DIR = resolve(__dirname, '../../../templates');
const ARCHIVE = templateArchiveFromDirectory(TEMPLATES_DIR);
const NAMING = deriveSetupNaming({ firebaseProjectId: 'gethapierapp', projectName: 'gethapier', codePrefix: 'getHapier', emulatorBasePort: 9300 });
const TOKENS = buildSetupTokenTable(NAMING);

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'dbxc-scaffold-'));
}

describe('buildScaffoldPlan', () => {
  it('strips the .template infix from project.template.json', () => {
    const dest = '/out/components/gethapier-firebase';
    const plan = buildScaffoldPlan({ archive: ARCHIVE, subtree: 'components/firebase', destRoot: dest, tokens: TOKENS });
    const projectEntry = plan.find((entry) => entry.archivePath === 'components/firebase/project.template.json');
    expect(projectEntry?.destPath).toBe(join(dest, 'project.json'));
    expect(projectEntry?.mode).toBe('text');
  });

  it('selects the per-file token list for config templates and the global list for source files', () => {
    const plan = buildScaffoldPlan({ archive: ARCHIVE, subtree: 'components/firebase', destRoot: '/out', tokens: TOKENS });
    const projectEntry = plan.find((entry) => entry.archivePath === 'components/firebase/project.template.json');
    const sourceEntry = plan.find((entry) => entry.archivePath === 'components/firebase/src/lib/index.ts');
    expect(projectEntry?.tokens).toBe(TOKENS.perFile.get('components/firebase/project.template.json'));
    expect(sourceEntry?.tokens).toBe(TOKENS.global);
  });

  it('classifies binary, exec, and text entries', () => {
    const plan = buildScaffoldPlan({ archive: ARCHIVE, subtree: 'root', destRoot: '/out', tokens: TOKENS });
    expect(plan.find((entry) => entry.archivePath === 'root/apps-demo/src/assets/brand/icon.png')?.mode).toBe('binary');
    expect(plan.find((entry) => entry.archivePath === 'root/exec-with-emulator.sh')?.mode).toBe('exec');
    expect(plan.find((entry) => entry.archivePath === 'root/.husky/commit-msg')?.mode).toBe('exec');
    expect(plan.find((entry) => entry.archivePath === 'root/.commitlintrc.json')?.mode).toBe('text');
  });

  it('honors path overrides', () => {
    const plan = buildScaffoldPlan({ archive: ARCHIVE, subtree: 'root', destRoot: '/out', tokens: TOKENS, pathOverrides: new Map([['root/test-demo-api.sh', 'test-gethapier-api.sh']]) });
    const entry = plan.find((p) => p.archivePath === 'root/test-demo-api.sh');
    expect(entry?.destPath).toBe(join('/out', 'test-gethapier-api.sh'));
  });
});

describe('applyScaffoldPlan', () => {
  it('writes token-substituted text, raw binary, and executable scripts', () => {
    const dest = tempDir();
    const plan = buildScaffoldPlan({ archive: ARCHIVE, subtree: 'components/firebase', destRoot: dest, tokens: TOKENS });
    applyScaffoldPlan({ archive: ARCHIVE, plan });

    const projectJson = readFileSync(join(dest, 'project.json'), 'utf8');
    expect(projectJson).toContain('gethapier-firebase');
    expect(projectJson).not.toContain('FIREBASE_COMPONENTS_NAME');

    expect(existsSync(join(dest, 'src/lib/index.ts'))).toBe(true);
  });

  it('copies binary assets byte-for-byte and marks .sh files executable', () => {
    const dest = tempDir();
    const plan = buildScaffoldPlan({ archive: ARCHIVE, subtree: 'root', destRoot: dest, tokens: TOKENS });
    applyScaffoldPlan({ archive: ARCHIVE, plan });

    const iconSrc = ARCHIVE.readEntry('root/apps-demo/src/assets/brand/icon.png');
    const iconOut = readFileSync(join(dest, 'apps-demo/src/assets/brand/icon.png'));
    expect(iconOut.equals(iconSrc ?? Buffer.alloc(0))).toBe(true);

    const execMode = statSync(join(dest, 'exec-with-emulator.sh')).mode;
    expect(execMode & 0o111).toBeGreaterThan(0);
  });

  it('does not touch disk under dryRun', () => {
    const dest = tempDir();
    const plan = buildScaffoldPlan({ archive: ARCHIVE, subtree: 'components/firebase', destRoot: dest, tokens: TOKENS });
    const results = applyScaffoldPlan({ archive: ARCHIVE, plan, dryRun: true });
    expect(results.every((result) => result.skipped)).toBe(true);
    expect(existsSync(join(dest, 'project.json'))).toBe(false);
  });
});
