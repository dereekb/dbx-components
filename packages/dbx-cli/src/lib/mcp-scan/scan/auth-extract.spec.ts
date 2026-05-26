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
        import { STORAGE_FILE_UPLOAD_USER_SIMPLE_CLAIMS_CONFIGURATION } from '@dereekb/firebase';

        /** @dbxAuthClaimsApp svc-api */
        export interface SvcAuthClaims {
          /** @dbxAuthClaim */
          fr?: unknown;
        }

        /** @dbxAuthClaimsService svc-api */
        export const SVC_AUTH_CLAIMS_SERVICE = authRoleClaimsService<SvcAuthClaims>({
          fr: STORAGE_FILE_UPLOAD_USER_SIMPLE_CLAIMS_CONFIGURATION
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
    const kinds = result.warnings.map((w) => w.kind).sort((a, b) => a.localeCompare(b));
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

  it('resolves project-local string-literal role constants without warning', () => {
    const project = projectWith({
      '/app/claims.ts': `
        import { authRoleClaimsService } from '@dereekb/util';

        export const APP_WORKER_ROLE = 'worker';
        export const APP_INVITE_ROLE = 'has_invite';

        /** @dbxAuthClaimsApp app-api */
        export interface AppAuthClaims {
          /** @dbxAuthClaim */
          w?: 1;
          /** @dbxAuthClaim */
          i?: 1;
        }

        /** @dbxAuthClaimsService app-api */
        export const APP_AUTH_CLAIMS_SERVICE = authRoleClaimsService<AppAuthClaims>({
          w: { roles: [APP_WORKER_ROLE] },
          i: { roles: APP_INVITE_ROLE }
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });

    expect(result.warnings).toHaveLength(0);
    expect(result.claims.find((c) => c.key === 'w')?.mapping.roles).toEqual(['worker']);
    expect(result.claims.find((c) => c.key === 'i')?.mapping.roles).toEqual(['has_invite']);
  });

  it('lets built-in roles win over a same-named project-local const', () => {
    const project = projectWith({
      '/conflict/claims.ts': `
        import { authRoleClaimsService } from '@dereekb/util';

        // A downstream file must never be able to shadow the built-in 'admin'.
        export const AUTH_ADMIN_ROLE = 'downstream-admin';

        /** @dbxAuthClaimsApp conflict-api */
        export interface ConflictAuthClaims {
          /** @dbxAuthClaim */
          a?: 1;
        }

        /** @dbxAuthClaimsService conflict-api */
        export const CONFLICT_AUTH_CLAIMS_SERVICE = authRoleClaimsService<ConflictAuthClaims>({
          a: { roles: [AUTH_ADMIN_ROLE] }
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });

    expect(result.warnings).toHaveLength(0);
    expect(result.claims.find((c) => c.key === 'a')?.mapping.roles).toEqual(['admin']);
  });

  it('flattens project-local array-aggregate role constants', () => {
    const project = projectWith({
      '/agg/claims.ts': `
        import { AUTH_ADMIN_ROLE, authRoleClaimsService } from '@dereekb/util';

        export const APP_SUPERVISOR_ROLE = 'supervisor';
        export const APP_EXTRA_ADMIN_ROLES = ['auditor'];
        export const ALL_APP_ADMIN_ROLES = [AUTH_ADMIN_ROLE, APP_SUPERVISOR_ROLE, 'root', ...APP_EXTRA_ADMIN_ROLES];

        /** @dbxAuthClaimsApp agg-api */
        export interface AggAuthClaims {
          /** @dbxAuthClaim */
          a?: 1;
        }

        /** @dbxAuthClaimsService agg-api */
        export const AGG_AUTH_CLAIMS_SERVICE = authRoleClaimsService<AggAuthClaims>({
          a: { roles: ALL_APP_ADMIN_ROLES }
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });

    expect(result.warnings).toHaveLength(0);
    expect(result.claims.find((c) => c.key === 'a')?.mapping.roles).toEqual(['admin', 'supervisor', 'root', 'auditor']);
  });

  it('flattens an array-aggregate spread inside a roles array literal', () => {
    const project = projectWith({
      '/spread/claims.ts': `
        import { AUTH_ADMIN_ROLE, authRoleClaimsService } from '@dereekb/util';

        export const APP_WORKER_ROLE = 'worker';
        export const ALL_APP_ADMIN_ROLES = [AUTH_ADMIN_ROLE, 'root'];

        /** @dbxAuthClaimsApp spread-api */
        export interface SpreadAuthClaims {
          /** @dbxAuthClaim */
          m?: 1;
        }

        /** @dbxAuthClaimsService spread-api */
        export const SPREAD_AUTH_CLAIMS_SERVICE = authRoleClaimsService<SpreadAuthClaims>({
          m: { roles: [...ALL_APP_ADMIN_ROLES, APP_WORKER_ROLE] }
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });

    expect(result.warnings).toHaveLength(0);
    expect(result.claims.find((c) => c.key === 'm')?.mapping.roles).toEqual(['admin', 'root', 'worker']);
  });

  it('still warns for an identifier role const that cannot be resolved locally', () => {
    const project = projectWith({
      '/imported/claims.ts': `
        import { authRoleClaimsService } from '@dereekb/util';
        import { SOME_EXTERNAL_ROLE } from '@some/other-package';

        /** @dbxAuthClaimsApp imported-api */
        export interface ImportedAuthClaims {
          /** @dbxAuthClaim */
          x?: 1;
        }

        /** @dbxAuthClaimsService imported-api */
        export const IMPORTED_AUTH_CLAIMS_SERVICE = authRoleClaimsService<ImportedAuthClaims>({
          x: { roles: [SOME_EXTERNAL_ROLE] }
        });
      `
    });

    const result = extractAuthEntries({ project, knownRoles: KNOWN_ROLES });

    const unresolved = result.warnings.filter((w) => w.kind === 'unresolved-role-const');
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({ kind: 'unresolved-role-const', key: 'x', constName: 'SOME_EXTERNAL_ROLE' });
    expect(result.claims.find((c) => c.key === 'x')?.mapping.roles).toEqual(['SOME_EXTERNAL_ROLE']);
  });
});
