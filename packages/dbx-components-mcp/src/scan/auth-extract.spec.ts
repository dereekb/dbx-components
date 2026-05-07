import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { extractAuthEntries, type AuthExtractKnownRoles } from './auth-extract.js';

const KNOWN_ROLES: AuthExtractKnownRoles = new Map([
  ['AUTH_TOS_SIGNED_ROLE', 'tos'],
  ['AUTH_ONBOARDED_ROLE', 'onboarded'],
  ['AUTH_ADMIN_ROLE', 'admin'],
  ['AUTH_USER_ROLE', 'user'],
  ['STORAGE_FILE_UPLOAD_USER_ROLE', 'uploads']
]);

function projectWith(files: Record<string, string>): Project {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const [path, contents] of Object.entries(files)) {
    project.createSourceFile(path, contents, { overwrite: true });
  }
  return project;
}

describe('extractAuthEntries', () => {
  it('extracts apps and claims from a tagged type alias + service', () => {
    const project = projectWith({
      '/demo/claims.ts': `
        import { AUTH_ADMIN_ROLE, AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE, authRoleClaimsService } from '@dereekb/util';

        /**
         * Custom claims for the demo API.
         *
         * @dbxAuthClaimsApp demo-api
         */
        export type DemoApiAuthClaims = {
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
          a: { roles: AUTH_ADMIN_ROLE, claimValue: 1 }
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });

    expect(result.warnings).toHaveLength(0);
    expect(result.apps).toHaveLength(1);
    const [app] = result.apps;
    expect(app.app).toBe('demo-api');
    expect(app.claimsInterfaceName).toBe('DemoApiAuthClaims');
    expect(app.serviceConstName).toBe('DEMO_AUTH_CLAIMS_SERVICE');
    expect(app.ownClaimKeys).toEqual(['o', 'a']);

    expect(result.claims).toHaveLength(2);
    const onboardedClaim = result.claims.find((c) => c.key === 'o');
    expect(onboardedClaim).toBeDefined();
    expect(onboardedClaim?.tags).toEqual(['onboarded', 'verified-user']);
    expect(onboardedClaim?.mapping.roles).toEqual(['tos', 'onboarded']);
    expect(onboardedClaim?.mapping.inverse).toBe(false);
    expect(onboardedClaim?.mapping.claimValue).toBe(1);

    const adminClaim = result.claims.find((c) => c.key === 'a');
    expect(adminClaim?.mapping.roles).toEqual(['admin']);
    expect(adminClaim?.tags).toEqual(['privileged']);
  });

  it('marks function-reference values as customEncodeDecode', () => {
    const project = projectWith({
      '/svc/claims.ts': `
        import { authRoleClaimsService } from '@dereekb/util';
        import { storageFileUploadUserSimpleClaimsConfiguration } from '@dereekb/firebase';

        /** @dbxAuthClaimsApp svc-api */
        export interface SvcAuthClaims {
          /** @dbxAuthClaim */
          fr?: unknown;
        }

        /** @dbxAuthClaimsService svc-api */
        export const SVC_AUTH_CLAIMS_SERVICE = authRoleClaimsService<SvcAuthClaims>({
          fr: storageFileUploadUserSimpleClaimsConfiguration
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });

    expect(result.warnings).toHaveLength(0);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].mapping.customEncodeDecode).toBe(true);
    expect(result.claims[0].mapping.roles).toEqual([]);
  });

  it('captures inverseRoles via inverse mapping form', () => {
    const project = projectWith({
      '/inv/claims.ts': `
        import { authRoleClaimsService } from '@dereekb/util';

        /** @dbxAuthClaimsApp inv-api */
        export interface InvAuthClaims {
          /** @dbxAuthClaim */
          x?: 1;
        }

        /** @dbxAuthClaimsService inv-api */
        export const INV_AUTH_CLAIMS_SERVICE = authRoleClaimsService<InvAuthClaims>({
          x: { inverseRoles: ['custom-role'], inverseMode: 'all' }
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });
    expect(result.warnings).toHaveLength(0);
    expect(result.claims[0].mapping.inverse).toBe(true);
    expect(result.claims[0].mapping.inverseMode).toBe('all');
    expect(result.claims[0].mapping.roles).toEqual(['custom-role']);
  });

  it('records inheritance from intersected interface names', () => {
    const project = projectWith({
      '/ext/claims.ts': `
        /** @dbxAuthClaimsApp ext-api */
        export type ExtAuthClaims = StorageFileUploadUserClaims & {
          /** @dbxAuthClaim */
          q?: 1;
        };
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });
    expect(result.apps[0].inheritedInterfaceNames).toContain('StorageFileUploadUserClaims');
    expect(result.apps[0].ownClaimKeys).toEqual(['q']);
  });

  it('emits warnings for missing service slug and unknown role consts', () => {
    const project = projectWith({
      '/warn/claims.ts': `
        import { authRoleClaimsService } from '@dereekb/util';

        /** @dbxAuthClaimsApp warn-api */
        export interface WarnAuthClaims {
          /** @dbxAuthClaim */
          z?: 1;
        }

        /**
         * @dbxAuthClaimsService
         */
        export const ORPHAN_SERVICE = authRoleClaimsService<WarnAuthClaims>({
          z: { roles: [SOMETHING_UNKNOWN] }
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });
    const kinds = result.warnings.map((w) => w.kind).sort();
    expect(kinds).toContain('service-missing-slug');
    expect(kinds).toContain('claim-missing-mapping');
  });

  it('does not extract from interfaces lacking the app marker', () => {
    const project = projectWith({
      '/none/claims.ts': `
        export interface PlainClaims {
          /** @dbxAuthClaim */
          a?: 1;
        }
      `
    });
    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });
    expect(result.apps).toHaveLength(0);
    expect(result.claims).toHaveLength(0);
  });
});
