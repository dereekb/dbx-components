import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveSetupNaming } from './naming.js';
import { DEFAULT_SETUP_CORE_VERSIONS } from './versions.js';
import { buildSetupManifest, readManifest, setupNamingInputsFromManifest, writeManifest } from './manifest.js';

const NAMING = deriveSetupNaming({ firebaseProjectId: 'gethapierapp', projectName: 'gethapier', codePrefix: 'getHapier', emulatorBasePort: 9300 });
const CREATED_AT = '2026-06-13T00:00:00Z';

describe('buildSetupManifest', () => {
  it('produces the dbx.setup.json shape from naming + versions', () => {
    const manifest = buildSetupManifest({ naming: NAMING, versions: DEFAULT_SETUP_CORE_VERSIONS, sourceBranch: 'develop', createdAt: CREATED_AT });
    expect(manifest.schema).toBe(1);
    expect(manifest.createdAt).toBe(CREATED_AT);
    expect(manifest.projectName).toBe('gethapier');
    expect(manifest.appCodePrefix).toBe('getHapier');
    expect(manifest.firebase).toEqual({ projectId: 'gethapierapp', stagingProjectId: 'gethapierapp-staging' });
    expect(manifest.apps).toEqual({ angular: 'gethapier', api: 'gethapier-api', e2e: 'gethapier-e2e' });
    expect(manifest.components).toEqual({ angular: 'gethapier-components', firebase: 'gethapier-firebase' });
    expect(manifest.ports).toEqual({ firebaseEmulatorBase: 9300, angularApp: 9310 });
    expect(manifest.versions.dbxComponents).toBe(DEFAULT_SETUP_CORE_VERSIONS.dbxComponents);
  });
});

describe('manifest round-trip', () => {
  it('writes, reads, and re-derives the same naming inputs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-manifest-'));
    const manifest = buildSetupManifest({ naming: NAMING, versions: DEFAULT_SETUP_CORE_VERSIONS, sourceBranch: 'develop', createdAt: CREATED_AT });
    writeManifest(dir, manifest);

    const read = readManifest(dir);
    expect(read).toEqual(manifest);

    const reInputs = setupNamingInputsFromManifest(read ?? manifest);
    const reNaming = deriveSetupNaming(reInputs);
    expect(reNaming).toEqual(NAMING);
  });

  it('does not write under dryRun', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-manifest-dry-'));
    const manifest = buildSetupManifest({ naming: NAMING, versions: DEFAULT_SETUP_CORE_VERSIONS, sourceBranch: 'develop', createdAt: CREATED_AT });
    writeManifest(dir, manifest, { dryRun: true });
    expect(readManifest(dir)).toBeUndefined();
  });
});
