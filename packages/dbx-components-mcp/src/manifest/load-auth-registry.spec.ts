import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { loadAuthRegistry } from './load-auth-registry.js';
import type { ScanReadFile } from '../../../dbx-cli/src/lib/scan-helpers/scan-io.js';
import { WORKSPACE_AUTH_APPS, WORKSPACE_AUTH_CLAIMS } from '../registry/auth-builtin.js';

function readFromMap(map: Map<string, string>): ScanReadFile {
  return async (absolutePath) => {
    const value = map.get(absolutePath);
    if (value === undefined) throw new Error(`unknown path ${absolutePath}`);
    return value;
  };
}

const DEMO_CLAIMS_SOURCE = `
  import { AUTH_ADMIN_ROLE, AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE, authRoleClaimsService } from '@dereekb/util';
  import { STORAGE_FILE_UPLOAD_USER_SIMPLE_CLAIMS_CONFIGURATION, type StorageFileUploadUserClaims } from '@dereekb/firebase';

  /**
   * @dbxAuthClaimsApp demo-api
   */
  export type DemoApiAuthClaims = StorageFileUploadUserClaims & {
    /**
     * Onboarded flag.
     *
     * @dbxAuthClaim
     * @dbxAuthRoleTag onboarded
     * @dbxAuthRoleTag verified-user
     */
    o?: 1;
    /**
     * Admin role.
     *
     * @dbxAuthClaim
     * @dbxAuthRoleTag privileged
     */
    a?: 1;
  };

  /**
   * @dbxAuthClaimsService demo-api
   */
  export const DEMO_AUTH_CLAIMS_SERVICE = authRoleClaimsService<DemoApiAuthClaims>({
    o: { roles: [AUTH_TOS_SIGNED_ROLE, AUTH_ONBOARDED_ROLE], claimValue: 1 },
    a: { roles: AUTH_ADMIN_ROLE, claimValue: 1 },
    fr: STORAGE_FILE_UPLOAD_USER_SIMPLE_CLAIMS_CONFIGURATION
  });
`;

describe('loadAuthRegistry', () => {
  it('extracts a downstream claims module via extraFiles + injected reader', async () => {
    const map = new Map<string, string>();
    map.set('/workspace/components/demo-firebase/src/lib/auth/claims.ts', DEMO_CLAIMS_SOURCE);

    const result = await loadAuthRegistry({
      cwd: '/workspace',
      readFile: readFromMap(map),
      extraFiles: ['components/demo-firebase/src/lib/auth/claims.ts']
    });

    expect(result.fileWarnings).toHaveLength(0);
    expect(result.extractWarnings).toHaveLength(0);
    expect(result.scannedFiles).toEqual(['components/demo-firebase/src/lib/auth/claims.ts']);
    expect(result.extractedAppCount).toBe(1);
    expect(result.extractedClaimCount).toBe(2);

    const { registry } = result;
    const demoApp = registry.findApp('demo-api');
    expect(demoApp).toBeDefined();
    expect(demoApp?.claimsInterfaceName).toBe('DemoApiAuthClaims');
    expect(demoApp?.serviceConstName).toBe('DEMO_AUTH_CLAIMS_SERVICE');
    expect(demoApp?.claimKeys).toEqual(['o', 'a', 'fr']); // own + inherited

    const oClaim = registry.findClaim('o', 'demo-api');
    expect(oClaim).toBeDefined();
    expect(oClaim?.mapping.roles).toEqual(['tos', 'onboarded']);
    expect(oClaim?.tags).toEqual(['onboarded', 'verified-user']);
    expect(oClaim?.sourcePath).toBe('components/demo-firebase/src/lib/auth/claims.ts');

    const fr = registry.findClaim('fr');
    expect(fr).toBeDefined();
    expect(fr?.mapping.inverse).toBe(true);

    expect(registry.scopes.length).toBeGreaterThan(0);
    expect(registry.findScope('model.read')).toBeDefined();

    expect(registry.loadedSources).toContain('builtin:@dereekb/util');
    expect(registry.loadedSources).toContain('workspace:components/demo-firebase/src/lib/auth/claims.ts');
  });

  it('returns the bundled built-ins when no claims files are discovered', async () => {
    const result = await loadAuthRegistry({
      cwd: '/empty-workspace-root-for-test',
      readFile: async () => {
        throw new Error('should not be called');
      },
      extraFiles: []
    });

    expect(result.scannedFiles).toEqual([]);
    expect(result.extractedAppCount).toBe(0);
    expect(result.extractedClaimCount).toBe(0);
    expect(result.registry.apps).toHaveLength(0);
    expect(result.registry.claims.length).toBeGreaterThan(0); // `fr` built-in
    expect(result.registry.findClaim('fr')).toBeDefined();
  });

  it('records read-failed warnings when a discovered file is unreadable', async () => {
    const result = await loadAuthRegistry({
      cwd: '/workspace',
      readFile: async () => {
        throw new Error('disk gone');
      },
      extraFiles: ['components/x-firebase/src/lib/auth/claims.ts']
    });
    expect(result.fileWarnings).toHaveLength(1);
    expect(result.fileWarnings[0].kind).toBe('read-failed');
  });

  it('extracts the workspace demo claims module and matches the hand-curated WORKSPACE constants', async () => {
    const workspaceRoot = resolve(__dirname, '../../../..');
    const result = await loadAuthRegistry({ cwd: workspaceRoot });

    expect(result.scannedFiles).toContain('components/demo-firebase/src/lib/auth/claims.ts');
    expect(result.extractedAppCount).toBeGreaterThanOrEqual(1);

    const demoApp = result.registry.findApp('demo-api');
    expect(demoApp).toBeDefined();
    expect(demoApp?.claimsInterfaceName).toBe('DemoApiAuthClaims');

    const expectedDemo = WORKSPACE_AUTH_APPS.find((a) => a.app === 'demo-api');
    expect(expectedDemo).toBeDefined();
    expect(demoApp?.serviceConstName).toBe(expectedDemo?.serviceConstName);
    expect(demoApp?.claimKeys).toEqual(expectedDemo?.claimKeys);

    const oExpected = WORKSPACE_AUTH_CLAIMS.find((c) => c.key === 'o' && c.app === 'demo-api');
    const oExtracted = result.registry.findClaim('o', 'demo-api');
    expect(oExtracted?.mapping.roles).toEqual(oExpected?.mapping.roles);
    expect(oExtracted?.tags).toEqual(oExpected?.tags);
  });

  it('skips files without auth markers without warning', async () => {
    const map = new Map<string, string>();
    map.set('/workspace/components/x-firebase/src/lib/auth/claims.ts', '// nothing relevant');
    const result = await loadAuthRegistry({
      cwd: '/workspace',
      readFile: readFromMap(map),
      extraFiles: ['components/x-firebase/src/lib/auth/claims.ts']
    });
    expect(result.fileWarnings).toHaveLength(0);
    expect(result.scannedFiles).toEqual([]);
  });
});
