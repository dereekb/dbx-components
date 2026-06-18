/**
 * Specs for the add-on registry + the subtle pure logic: the `mcp` dependency on
 * `oidc`, and the manifest-aware OIDC-module token flip (re-running `oidc` after
 * `mcp` must keep the MCP resource-server config).
 */

import { describe, expect, it } from 'vitest';
import { deriveSetupNaming } from '../naming.js';
import { buildSetupTokenTable } from '../tokens.js';
import { buildSetupManifest, withInstalledAddon, type DbxSetupManifest } from '../manifest.js';
import { DEFAULT_SETUP_CORE_VERSIONS } from '../versions.js';
import { unmetAddonDependencies, type AddonContext } from '../addon.js';
import { SETUP_ADDONS, SETUP_ADDON_IDS } from './index.js';
import { buildOidcTokens } from './oidc.addon.js';

const NAMING = deriveSetupNaming({ firebaseProjectId: 'testproj', projectName: 'testproj', codePrefix: 'testApp', emulatorBasePort: 9300 });
const BASE_MANIFEST = buildSetupManifest({ naming: NAMING, versions: DEFAULT_SETUP_CORE_VERSIONS, sourceBranch: 'develop', createdAt: '2026-06-13T00:00:00Z' });

// Empty archive stub: scaffold plans resolve to no files, so addonInstalledOnDisk is false.
const STUB_ARCHIVE = { listSubtree: () => [], readEntry: () => undefined };

function contextWith(manifest: DbxSetupManifest): AddonContext {
  // Only the fields the pure helpers under test read are populated.
  return { workspaceRoot: '/tmp/none', archive: STUB_ARCHIVE, naming: NAMING, tokens: buildSetupTokenTable(NAMING), manifest, dryRun: true } as unknown as AddonContext;
}

function oidcTokenValue(manifest: DbxSetupManifest, search: string): string | undefined {
  return buildOidcTokens(contextWith(manifest)).global.find((token) => token.search === search)?.replace;
}

describe('add-on registry', () => {
  it('exposes oidc + mcp + dbx-claude, with mcp depending on oidc', () => {
    expect(SETUP_ADDON_IDS).toEqual(['oidc', 'mcp', 'dbx-claude']);
    expect(SETUP_ADDONS.oidc.id).toBe('oidc');
    expect(SETUP_ADDONS.mcp.dependsOn).toEqual(['oidc']);
    expect(SETUP_ADDONS.oidc.dependsOn).toBeUndefined();
    expect(SETUP_ADDONS['dbx-claude'].dependsOn).toBeUndefined();
  });
});

describe('dbx-claude add-on', () => {
  it('scaffolds the .dbx-claude/dbx-claude.json marker with the project name and no configure edits', () => {
    const addon = SETUP_ADDONS['dbx-claude'];
    const plan = addon.buildScaffoldPlan(contextWith(BASE_MANIFEST));
    expect(plan).toHaveLength(1);
    expect(plan[0].destPath).toBe('/tmp/none/.dbx-claude/dbx-claude.json');
    const marker = JSON.parse(plan[0].literal as string) as { kind: string; project: string; capabilities: string[] };
    expect(marker.kind).toBe('dbx-components');
    expect(marker.project).toBe('testproj');
    expect(marker.capabilities).toEqual(['audit', 'dbx-components']);
    expect(addon.configure(contextWith(BASE_MANIFEST))).toEqual({ injections: [], fileEdits: [] });
  });
});

describe('unmetAddonDependencies', () => {
  it('reports oidc as unmet for mcp when neither recorded nor on disk', () => {
    const unmet = unmetAddonDependencies({ addon: SETUP_ADDONS.mcp, context: contextWith(BASE_MANIFEST), resolve: (id) => SETUP_ADDONS[id] });
    expect(unmet).toEqual(['oidc']);
  });

  it('is satisfied once oidc is recorded in the manifest', () => {
    const withOidc = withInstalledAddon(BASE_MANIFEST, 'oidc', '2026-06-13T00:00:00Z');
    const unmet = unmetAddonDependencies({ addon: SETUP_ADDONS.mcp, context: contextWith(withOidc), resolve: (id) => SETUP_ADDONS[id] });
    expect(unmet).toEqual([]);
  });
});

describe('buildOidcTokens (manifest-aware MCP flip)', () => {
  it('uses OIDC-only values when mcp is not installed', () => {
    expect(oidcTokenValue(BASE_MANIFEST, 'OIDC_CONFIGURE_MCP_RESOURCE_SERVER')).toBe('false');
    expect(oidcTokenValue(BASE_MANIFEST, 'OIDC_PROTECTED_PATHS')).toBe("'/api/model'");
  });

  it('uses MCP-enabled values when mcp is already installed', () => {
    const withMcp = withInstalledAddon(BASE_MANIFEST, 'mcp', '2026-06-13T00:00:00Z');
    expect(oidcTokenValue(withMcp, 'OIDC_CONFIGURE_MCP_RESOURCE_SERVER')).toBe('true');
    expect(oidcTokenValue(withMcp, 'OIDC_PROTECTED_PATHS')).toBe("'/api/model', '/mcp'");
  });
});
