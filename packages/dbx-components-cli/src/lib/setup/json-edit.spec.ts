import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveSetupNaming } from './naming.js';
import { applyApiTsconfigEdits, applyFirebaseJsonEdits, applyNxJsonEdits, applyTsconfigBaseEdits, editJsonFile, type JsonObject } from './json-edit.js';

const NAMING = deriveSetupNaming({ firebaseProjectId: 'gethapierapp', projectName: 'gethapier', codePrefix: 'getHapier', emulatorBasePort: 9300 });

describe('applyNxJsonEdits', () => {
  it('sets workspaceLayout, target defaults, and disables the TUI', () => {
    const result = applyNxJsonEdits({ targetDefaults: { existing: { cache: false } } }, NAMING);
    expect(result.workspaceLayout).toEqual({ appsDir: 'apps', libsDir: 'components' });
    expect(result.tui).toEqual({ enabled: false });
    const targetDefaults = result.targetDefaults as JsonObject;
    expect(targetDefaults['build-base']).toEqual({ cache: true });
    expect(targetDefaults['build']).toEqual({ dependsOn: ['^build'], inputs: ['production', '^production'], cache: true });
    expect(targetDefaults['existing']).toEqual({ cache: false });
    expect((targetDefaults['@nx/vitest:test'] as JsonObject).configurations).toEqual({ ci: { ci: true, codeCoverage: true } });
  });
});

describe('applyFirebaseJsonEdits', () => {
  it('rewrites functions, firestore, and emulators with derived ports', () => {
    const result = applyFirebaseJsonEdits({}, NAMING, '24');
    expect(result.functions).toEqual({ source: 'dist/apps/gethapier-api', runtime: 'nodejs24', engines: { node: '24' }, ignore: ['firebase.json', '**/.*', '**/node_modules/**'] });
    expect(result.firestore).toEqual({ rules: 'firestore.rules', indexes: 'firestore.indexes.json' });
    const emulators = result.emulators as JsonObject;
    expect((emulators.ui as JsonObject).port).toBe(9300);
    expect((emulators.firestore as JsonObject).websocketPort).toBe(9308);
    expect((emulators.storage as JsonObject).port).toBe(9306);
  });
});

describe('applyTsconfigBaseEdits / applyApiTsconfigEdits', () => {
  it('merges the base compiler options', () => {
    const result = applyTsconfigBaseEdits({ compilerOptions: { rootDir: '.' } });
    const opts = result.compilerOptions as JsonObject;
    expect(opts.rootDir).toBe('.');
    expect(opts.strict).toBe(true);
    expect(opts.moduleResolution).toBe('bundler');
  });

  it('disables esModuleInterop for the api tsconfig', () => {
    const result = applyApiTsconfigEdits({ compilerOptions: { strict: true } });
    expect((result.compilerOptions as JsonObject).esModuleInterop).toBe(false);
    expect((result.compilerOptions as JsonObject).strict).toBe(true);
  });
});

describe('editJsonFile', () => {
  it('reads, transforms, and writes a JSON file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-jsonedit-'));
    const path = join(dir, 'nx.json');
    writeFileSync(path, JSON.stringify({ targetDefaults: {} }));
    editJsonFile(path, (current) => applyNxJsonEdits(current, NAMING));
    const written = JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
    expect(written.tui).toEqual({ enabled: false });
  });

  it('returns undefined for a missing file', () => {
    expect(editJsonFile('/no/such/file.json', (current) => current)).toBeUndefined();
  });
});
