import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { templateArchiveFromDirectory } from '../archive.js';
import { deriveSetupNaming } from '../naming.js';
import { buildSetupTokenTable } from '../tokens.js';
import { resolveSetupVersions } from '../versions.js';
import { createShellRunner } from '../shell.js';
import { moduleExpectedFiles, runModuleScaffold, type SetupContext } from '../module.js';
import { SCAFFOLDING_MODULE_IDS, SETUP_MODULES } from './index.js';
import { validateExpectedFiles, validationHasMissing } from '../validate.js';

const TEMPLATES_DIR = resolve(__dirname, '../../../../templates');

function makeContext(workspaceRoot: string): SetupContext {
  const naming = deriveSetupNaming({ firebaseProjectId: 'gethapierapp', projectName: 'gethapier', codePrefix: 'getHapier', emulatorBasePort: 9300 });
  return {
    workspaceRoot,
    archive: templateArchiveFromDirectory(TEMPLATES_DIR),
    naming,
    tokens: buildSetupTokenTable(naming),
    versions: resolveSetupVersions(),
    sourceBranch: 'develop',
    createdAt: '2026-06-13T00:00:00Z',
    dryRun: false,
    shell: createShellRunner(() => undefined),
    log: () => undefined
  };
}

describe('module scaffold → validate round-trip', () => {
  for (const id of SCAFFOLDING_MODULE_IDS) {
    it(`scaffolds ${id} so validate reports zero missing`, () => {
      const dir = mkdtempSync(join(tmpdir(), `dbxc-mod-${id}-`));
      const context = makeContext(dir);
      const module = SETUP_MODULES[id];
      runModuleScaffold(module, context);
      const result = validateExpectedFiles({ moduleId: id, expectedFiles: moduleExpectedFiles(module, context), validationRoot: dir });
      expect(result.missing).toEqual([]);
      expect(result.present.length).toBeGreaterThan(0);
    });
  }

  it('writes the firebase components barrel + test-setup with substituted names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-mod-fc-'));
    const context = makeContext(dir);
    runModuleScaffold(SETUP_MODULES['firebase-components'], context);
    expect(readFileSync(join(dir, 'components/gethapier-firebase/src/index.ts'), 'utf8')).toBe("export * from './lib'\n");
    expect(readFileSync(join(dir, 'components/gethapier-firebase/src/test-setup.ts'), 'utf8')).toBe("import '@dereekb/vitest/setup-firebase'\n");
    expect(readFileSync(join(dir, 'components/gethapier-firebase/project.json'), 'utf8')).toContain('gethapier-firebase');
  });

  it('fans out per-project .env files and writes the manifest via root + integrations', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-mod-root-'));
    const context = makeContext(dir);
    runModuleScaffold(SETUP_MODULES.root, context);
    runModuleScaffold(SETUP_MODULES.integrations, context);

    // The apps/.env template is empty, so the fanned-out .env files are created but empty (faithful to the script).
    expect(existsSync(join(dir, 'apps/gethapier-api/.env'))).toBe(true);
    expect(existsSync(join(dir, 'apps/gethapier-e2e/.env'))).toBe(true);
    expect(existsSync(join(dir, 'components/gethapier-components/.env'))).toBe(true);
    expect(existsSync(join(dir, 'components/gethapier-firebase/.env'))).toBe(true);
    expect(existsSync(join(dir, 'test-gethapier-api.sh'))).toBe(true);
    expect(existsSync(join(dir, 'dbx.setup.json'))).toBe(true);
    expect(readFileSync(join(dir, '.firebaserc'), 'utf8')).toContain('gethapierapp-staging');
  });

  it('reports missing files when nothing has been scaffolded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-mod-empty-'));
    const context = makeContext(dir);
    const results = SCAFFOLDING_MODULE_IDS.map((id) => validateExpectedFiles({ moduleId: id, expectedFiles: moduleExpectedFiles(SETUP_MODULES[id], context), validationRoot: dir }));
    expect(validationHasMissing(results)).toBe(true);
  });
});
