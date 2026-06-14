import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveSetupNaming } from './naming.js';
import { DEFAULT_SETUP_CORE_VERSIONS } from './versions.js';
import { assertManifestFields, buildSetupManifest, getManifestField, manifestHasAddon, readManifest, requireManifestFields, setupNamingInputsFromManifest, withInstalledAddon, writeManifest } from './manifest.js';

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

describe('manifest field validation', () => {
  const manifest = buildSetupManifest({ naming: NAMING, versions: DEFAULT_SETUP_CORE_VERSIONS, sourceBranch: 'develop', createdAt: CREATED_AT });

  it('reads dotted fields', () => {
    expect(getManifestField(manifest, 'firebase.stagingProjectId')).toBe('gethapierapp-staging');
    expect(getManifestField(manifest, 'ports.angularApp')).toBe(9310);
    expect(getManifestField(manifest, 'firebase.missing')).toBeUndefined();
    expect(getManifestField(manifest, 'nope.deeper')).toBeUndefined();
  });

  it('reports missing required fields', () => {
    expect(requireManifestFields(manifest, ['projectName', 'firebase.projectId']).missing).toEqual([]);
    expect(requireManifestFields(manifest, ['firebase.absent', 'ports.absent']).missing).toEqual(['firebase.absent', 'ports.absent']);
  });

  it('assertManifestFields throws naming the missing fields', () => {
    expect(() => assertManifestFields(manifest, ['projectName'], 'setup addon oidc')).not.toThrow();
    expect(() => assertManifestFields(manifest, ['firebase.absent', 'x.y'], 'setup addon oidc')).toThrow(/setup addon oidc: dbx\.setup\.json is missing required field\(s\): firebase\.absent, x\.y/);
  });
});

describe('manifest add-on registry', () => {
  const base = buildSetupManifest({ naming: NAMING, versions: DEFAULT_SETUP_CORE_VERSIONS, sourceBranch: 'develop', createdAt: CREATED_AT });

  it('records and detects installed add-ons (idempotently)', () => {
    expect(manifestHasAddon(base, 'oidc')).toBe(false);

    const withOidc = withInstalledAddon(base, 'oidc', CREATED_AT);
    expect(manifestHasAddon(withOidc, 'oidc')).toBe(true);
    expect(withOidc.addons).toEqual([{ id: 'oidc', installedAt: CREATED_AT }]);

    // re-recording the same add-on is a no-op (same reference, original timestamp kept).
    expect(withInstalledAddon(withOidc, 'oidc', '2099-01-01T00:00:00Z')).toBe(withOidc);

    const withBoth = withInstalledAddon(withOidc, 'mcp', CREATED_AT);
    expect(withBoth.addons?.map((addon) => addon.id)).toEqual(['oidc', 'mcp']);
  });
});
