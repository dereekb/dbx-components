import { describe, expect, it } from 'vitest';
import { type CliArtifactPackage, cliBuildDriftDescription, inspectCliBuildDrift, readCliArtifactPackage } from './build-stamp';

const ARTIFACT: CliArtifactPackage = {
  path: '/repo/dist/apps/demo-cli/package.json',
  name: '@demo/demo-cli',
  version: '0.44.0',
  frameworkVersions: { '@dereekb/dbx-cli': '13.38.0', '@dereekb/firebase': '13.38.0', '@dereekb/util': '13.38.0' }
};

/**
 * The observed failure: an artifact built against 13.38.0 running against a `node_modules`
 * reinstalled at 13.42.0.
 */
const RESOLVED_13_42 = () => '13.42.0';
const RESOLVED_13_38 = () => '13.38.0';

describe('inspectCliBuildDrift()', () => {
  it('reports every framework package whose runtime version moved', () => {
    const report = inspectCliBuildDrift({ artifactPackage: ARTIFACT, resolveVersion: RESOLVED_13_42 });

    expect(report.ok).toBe(false);
    expect(report.checked).toBe(3);
    expect(report.drift).toHaveLength(3);
    expect(report.drift.map((x) => x.packageName).sort()).toEqual(['@dereekb/dbx-cli', '@dereekb/firebase', '@dereekb/util']);
    expect(report.drift[0]?.builtAgainst).toBe('13.38.0');
    expect(report.drift[0]?.resolved).toBe('13.42.0');
    expect(report.artifactPackagePath).toBe(ARTIFACT.path);
    expect(report.artifactVersion).toBe('0.44.0');
  });

  it('passes when the artifact matches the installed tree', () => {
    const report = inspectCliBuildDrift({ artifactPackage: ARTIFACT, resolveVersion: RESOLVED_13_38 });

    expect(report.ok).toBe(true);
    expect(report.drift).toEqual([]);
    expect(cliBuildDriftDescription(report)).toBeUndefined();
  });

  it('reports a declared framework package that is not installed at all', () => {
    const report = inspectCliBuildDrift({ artifactPackage: ARTIFACT, resolveVersion: (name) => (name === '@dereekb/util' ? undefined : '13.38.0') });

    expect(report.ok).toBe(false);
    expect(report.drift).toHaveLength(1);
    expect(report.drift[0]?.packageName).toBe('@dereekb/util');
    expect(report.drift[0]?.resolved).toBeUndefined();
    expect(cliBuildDriftDescription(report)).toContain('not installed');
  });

  it('flags manifests emitted by a different generator than the one running them', () => {
    // the half the peer comparison cannot see: peers bumped and the bundle rebuilt, but the
    // generators never re-run, so the committed manifests silently lack fields the runtime reads
    const report = inspectCliBuildDrift({ artifactPackage: ARTIFACT, resolveVersion: RESOLVED_13_38, manifestGeneratorVersion: '13.20.0' });

    expect(report.ok).toBe(false);
    expect(report.drift).toEqual([]);
    expect(report.manifestGeneratorDrift).toBe(true);
    expect(report.manifestGeneratorVersion).toBe('13.20.0');
    expect(report.resolvedDbxCliVersion).toBe('13.38.0');
    expect(cliBuildDriftDescription(report)).toContain('generated manifests were emitted by');
  });

  it('passes when the manifest generator matches the running framework', () => {
    const report = inspectCliBuildDrift({ artifactPackage: ARTIFACT, resolveVersion: RESOLVED_13_38, manifestGeneratorVersion: '13.38.0' });

    expect(report.ok).toBe(true);
    expect(report.manifestGeneratorDrift).toBe(false);
  });

  it('stays green when the framework resolves from source rather than node_modules', () => {
    // a monorepo dev run: `@dereekb/*` resolve through tsconfig paths, so nothing is installed to
    // drift from. Calling that "3 packages not installed" would make the check red by default, and a
    // check that is red by default is a check nobody reads.
    const report = inspectCliBuildDrift({ artifactPackage: ARTIFACT, resolveVersion: () => undefined });

    expect(report.ok).toBe(true);
    expect(report.reason).toBe('framework-not-resolvable');
    expect(cliBuildDriftDescription(report)).toBeUndefined();
  });

  it('still reports drift when only SOME of the framework is unresolvable', () => {
    const report = inspectCliBuildDrift({ artifactPackage: ARTIFACT, resolveVersion: (name) => (name === '@dereekb/util' ? undefined : '13.42.0') });

    expect(report.ok).toBe(false);
    expect(report.reason).toBeUndefined();
    expect(report.drift).toHaveLength(3);
  });

  it('stays green when nothing comparable was declared', () => {
    // a check that cried wolf on every source-run CLI would be turned off, and then be useless on the
    // day it mattered
    const report = inspectCliBuildDrift({ artifactPackage: { path: '/repo/package.json', frameworkVersions: {} }, resolveVersion: RESOLVED_13_42 });

    expect(report.ok).toBe(true);
    expect(report.checked).toBe(0);
    expect(report.reason).toBe('no-framework-versions-declared');
  });

  it('stays green when no artifact package could be found', () => {
    const report = inspectCliBuildDrift({ entryPath: '/definitely/not/a/real/path/index.js', artifactPackage: null, resolveVersion: RESOLVED_13_42 });

    expect(report.ok).toBe(true);
    expect(report.reason).toBe('no-artifact-package');
  });
});

describe('readCliArtifactPackage()', () => {
  it('reads THIS package as the nearest package.json above the spec file', () => {
    const artifact = readCliArtifactPackage(import.meta.filename);

    expect(artifact?.path.endsWith('packages/dbx-cli/package.json')).toBe(true);
    expect(artifact?.name).toBe('@dereekb/dbx-cli');
  });

  it('reads only exact-pinned @dereekb/* versions, skipping ranges', () => {
    // `firebase: ^12.12.1` is a range, and a range carries no build stamp to compare
    const artifact = readCliArtifactPackage(import.meta.filename);

    expect(Object.keys(artifact?.frameworkVersions ?? {}).every((x) => x.startsWith('@dereekb/'))).toBe(true);
    expect(Object.values(artifact?.frameworkVersions ?? {}).every((x) => /^\d+\.\d+\.\d+/.test(x))).toBe(true);
  });

  it('returns undefined when no package.json exists above the path', () => {
    expect(readCliArtifactPackage('/index.js')).toBeUndefined();
  });
});
